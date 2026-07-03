from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status

from app.core.database import get_db
from app.services.safety_preview import create_safety_preview


SAFETY_EVIDENCE_BUCKET = "safety-evidence"
MAX_PDF_BYTES = 20 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _safe_text(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _sanitize_storage_segment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", str(value or "").strip()) or "unknown"


def _normalize_evidence_type(value: str) -> str:
    return _sanitize_storage_segment(value).lower()


def _is_missing_user_safety_files_column_error(exc: Exception) -> bool:
    message = str(exc or "").lower()
    return (
        "user_safety_files" in message
        and "column" in message
        and "does not exist" in message
    )


def _normalize_policy_id(value: str) -> str:
    policy_id = str(value or "").strip()
    if not policy_id:
        return ""
    normalized = re.sub(r":[AB](?:\d+)?$", "", policy_id, flags=re.IGNORECASE)
    normalized = re.sub(r":\d+$", "", normalized)
    normalized = re.sub(r":[AB]$", "", normalized, flags=re.IGNORECASE)
    return normalized


def _resolve_snapshot_policy_id(roi_output: dict[str, Any], requested_policy_id: str) -> str:
    snapshot = _as_dict(roi_output.get("policy_snapshot"))
    requested = _normalize_policy_id(requested_policy_id) or requested_policy_id
    if not snapshot:
        return requested
    policies = _as_list(snapshot.get("policies"))
    if not policies:
        return requested
    for item in policies:
        row = _as_dict(item)
        policy_id = _safe_text(row.get("policy_id"))
        if policy_id == requested:
            return policy_id
    for item in policies:
        row = _as_dict(item)
        policy_id = _safe_text(row.get("policy_id"))
        if requested.startswith(f"{policy_id}:") or policy_id.startswith(f"{requested}:"):
            return policy_id
    return requested


def _assert_company_ownership(company_id: str, user_id: str) -> dict[str, Any]:
    db = get_db()
    row = (
        db.table("company")
        .select("*")
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="기업 정보를 찾을 수 없거나 접근 권한이 없습니다.",
        )
    return row[0]


def _load_analysis(company_id: str, analysis_id: str) -> dict[str, Any]:
    db = get_db()
    rows = (
        db.table("roi_output")
        .select("*")
        .eq("id", analysis_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="분석 이력을 찾을 수 없습니다.",
        )
    return rows[0]


def _load_safety_viewer_policy(
    *,
    analysis_id: str,
    policy_id: str,
    equipment_id: str,
) -> dict[str, Any]:
    db = get_db()
    requested_policy_id = _normalize_policy_id(policy_id) or policy_id
    rows = (
        db.table("safety_viewer_policy")
        .select("*")
        .eq("analysis_id", analysis_id)
        .eq("policy_id", requested_policy_id)
        .eq("equipment_id", equipment_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        candidates = (
            db.table("safety_viewer_policy")
            .select("*")
            .eq("analysis_id", analysis_id)
            .eq("equipment_id", equipment_id)
            .execute()
            .data
            or []
        )
        rows = [
            row
            for row in candidates
            if str(row.get("policy_id") or "").strip().startswith(f"{requested_policy_id}:")
            or requested_policy_id.startswith(f"{str(row.get('policy_id') or '').strip()}:")
        ][:1]
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="현재 분석에 연결된 안전 증빙 기준이 아직 준비되지 않았습니다.",
        )
    return rows[0]


def _assert_analysis_policy_equipment_integrity(
    *,
    company_id: str,
    analysis_id: str,
    policy_id: str,
    equipment_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    roi_output = _load_analysis(company_id, analysis_id)
    analysis_equipment_id = _safe_text(roi_output.get("equipment_id"))
    if analysis_equipment_id and analysis_equipment_id != equipment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="analysis_id와 equipment_id가 일치하지 않습니다.",
        )
    safety_viewer_policy = _load_safety_viewer_policy(
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )
    return roi_output, safety_viewer_policy


def _collect_required_evidence_tuples(
    safety_viewer_policy: dict[str, Any],
) -> list[dict[str, str]]:
    preview_items = _as_list(safety_viewer_policy.get("safety_preview_items"))
    tuples: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str]] = set()

    for item_index, item in enumerate(preview_items, start=1):
        if not isinstance(item, dict):
            continue
        viewpoint_key = _safe_text(item.get("viewpoint_key"))
        for ev_index, raw_ev in enumerate(_as_list(item.get("required_evidences")), start=1):
            ev = _as_dict(raw_ev)
            evidence_label = _safe_text(
                ev.get("label"),
                ev.get("evidence_label"),
                ev.get("base_label"),
                ev.get("base_evidence_label"),
            )
            evidence_type = _safe_text(ev.get("evidence_type"))
            if not evidence_type:
                evidence_type = f"evidence_{ev_index}"
            safety_rule_id = _safe_text(ev.get("safety_rule_id"))
            if not safety_rule_id:
                safety_rule_id = f"derived-rule-{item_index}-{ev_index}"
            if not (viewpoint_key and evidence_type and evidence_label):
                continue
            key = (viewpoint_key, safety_rule_id, evidence_type, evidence_label)
            if key in seen:
                continue
            seen.add(key)
            tuples.append(
                {
                    "viewpoint_key": viewpoint_key,
                    "safety_rule_id": safety_rule_id,
                    "evidence_type": evidence_type,
                    "evidence_label": evidence_label,
                    "base_evidence_label": _safe_text(
                        ev.get("base_label"),
                        ev.get("base_evidence_label"),
                        evidence_label,
                    ),
                    "viewpoint_title": _safe_text(item.get("viewpoint_title"), viewpoint_key),
                    "current_judgement": _safe_text(
                        item.get("current_judgement"),
                        "개선 필요",
                    ),
                    "description": _safe_text(item.get("description")),
                }
            )

    return tuples


def _assert_evidence_tuple_exists(
    *,
    required_tuples: list[dict[str, str]],
    viewpoint_key: str,
    safety_rule_id: str,
    evidence_type: str,
    evidence_label: str,
) -> dict[str, str]:
    for item in required_tuples:
        if (
            _safe_text(item.get("viewpoint_key")) == viewpoint_key
            and _safe_text(item.get("safety_rule_id")) == safety_rule_id
            and _safe_text(item.get("evidence_type")) == evidence_type
            and _safe_text(item.get("evidence_label")) == evidence_label
        ):
            return item
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="요청한 증빙 항목이 현재 분석의 required_evidences에 존재하지 않습니다.",
    )


def _assert_pdf_upload(file_name: str, content_type: str, content_bytes: bytes) -> None:
    if content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF 파일만 업로드할 수 있습니다.",
        )
    if not file_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일 확장자는 .pdf 여야 합니다.",
        )
    if len(content_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="파일 크기는 20MB 이하만 업로드할 수 있습니다.",
        )
    if not content_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효한 PDF 헤더를 찾지 못했습니다.",
        )


def _query_active_uploaded_files(
    *,
    company_id: str,
    analysis_id: str,
    policy_id: str,
    equipment_id: str,
) -> list[dict[str, Any]]:
    db = get_db()
    try:
        return (
            db.table("user_safety_files")
            .select("*")
            .eq("company_id", company_id)
            .eq("analysis_id", analysis_id)
            .eq("policy_id", policy_id)
            .eq("equipment_id", equipment_id)
            .is_("deleted_at", "null")
            .eq("upload_status", "uploaded")
            .order("uploaded_at", desc=True)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        if not _is_missing_user_safety_files_column_error(exc):
            raise

    # Backward compatibility: migration may not be applied yet in some environments.
    # Retry with minimal legacy columns, then filter rows in Python.
    rows = (
        db.table("user_safety_files")
        .select("*")
        .eq("analysis_id", analysis_id)
        .eq("policy_id", policy_id)
        .eq("equipment_id", equipment_id)
        .order("uploaded_at", desc=True)
        .execute()
        .data
        or []
    )
    filtered: list[dict[str, Any]] = []
    for row in rows:
        if _safe_text(row.get("upload_status")) == "deleted":
            continue
        if row.get("deleted_at"):
            continue
        filtered.append(row)
    return filtered


def build_safety_evidence_summary(
    *,
    company_id: str,
    analysis_id: str,
    policy_id: str,
    equipment_id: str,
) -> dict[str, Any]:
    _assert_analysis_policy_equipment_integrity(
        company_id=company_id,
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )
    safety_viewer_policy = _load_safety_viewer_policy(
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )
    required_tuples = _collect_required_evidence_tuples(safety_viewer_policy)
    files = _query_active_uploaded_files(
        company_id=company_id,
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )

    files_by_tuple: dict[tuple[str, str, str, str], list[dict[str, Any]]] = {}
    for row in files:
        key = (
            _safe_text(row.get("viewpoint_key")),
            _safe_text(row.get("safety_rule_id")),
            _safe_text(row.get("evidence_type")),
            _safe_text(row.get("evidence_label")),
        )
        files_by_tuple.setdefault(key, []).append(row)

    viewpoint_map: dict[str, dict[str, Any]] = {}
    for item in _as_list(safety_viewer_policy.get("safety_preview_items")):
        row = _as_dict(item)
        viewpoint_key = _safe_text(row.get("viewpoint_key"))
        if not viewpoint_key:
            continue
        viewpoint_map.setdefault(
            viewpoint_key,
            {
                "viewpoint_key": viewpoint_key,
                "viewpoint_title": _safe_text(row.get("viewpoint_title"), viewpoint_key),
                "current_judgement": _safe_text(row.get("current_judgement"), "개선 필요"),
                "description": _safe_text(row.get("description")),
                "required_count": 0,
                "uploaded_count": 0,
                "evidence_status": "미첨부",
                "verification_status": "검토 필요",
                "required_evidences": [],
            },
        )

    for required in required_tuples:
        viewpoint_key = required["viewpoint_key"]
        viewpoint = viewpoint_map.setdefault(
            viewpoint_key,
            {
                "viewpoint_key": viewpoint_key,
                "viewpoint_title": required.get("viewpoint_title") or viewpoint_key,
                "current_judgement": required.get("current_judgement") or "개선 필요",
                "description": required.get("description") or "",
                "required_count": 0,
                "uploaded_count": 0,
                "evidence_status": "미첨부",
                "verification_status": "검토 필요",
                "required_evidences": [],
            },
        )
        viewpoint["required_count"] += 1

        key = (
            required["viewpoint_key"],
            required["safety_rule_id"],
            required["evidence_type"],
            required["evidence_label"],
        )
        matched = files_by_tuple.get(key, [])
        is_uploaded = len(matched) > 0
        if is_uploaded:
            viewpoint["uploaded_count"] += 1
        viewpoint["required_evidences"].append(
            {
                "evidence_label": required["evidence_label"],
                "base_evidence_label": required.get("base_evidence_label")
                or required["evidence_label"],
                "safety_rule_id": required["safety_rule_id"],
                "evidence_type": required["evidence_type"],
                "is_uploaded": is_uploaded,
                "files": [
                    {
                        "file_id": _safe_text(row.get("id")),
                        "file_name": _safe_text(row.get("file_name")),
                        "uploaded_at": row.get("uploaded_at"),
                        "verification_status": _safe_text(
                            row.get("verification_status"),
                            "not_reviewed",
                        ),
                    }
                    for row in matched
                ],
            }
        )

    viewpoints = list(viewpoint_map.values())
    for viewpoint in viewpoints:
        required_count = int(viewpoint.get("required_count") or 0)
        uploaded_count = int(viewpoint.get("uploaded_count") or 0)
        if required_count <= 0:
            viewpoint["evidence_status"] = "증빙 대상 없음"
        elif uploaded_count <= 0:
            viewpoint["evidence_status"] = "미첨부"
        elif uploaded_count < required_count:
            viewpoint["evidence_status"] = "일부 첨부"
        else:
            viewpoint["evidence_status"] = "첨부됨"

    total_required_count = len(required_tuples)
    uploaded_required_count = sum(
        1 for required in required_tuples
        if files_by_tuple.get(
            (
                required["viewpoint_key"],
                required["safety_rule_id"],
                required["evidence_type"],
                required["evidence_label"],
            )
        )
    )

    return {
        "analysis_id": analysis_id,
        "policy_id": policy_id,
        "equipment_id": equipment_id,
        "total_required_count": total_required_count,
        "uploaded_required_count": uploaded_required_count,
        "viewpoints": viewpoints,
        "safety_viewer_policy_id": _safe_text(safety_viewer_policy.get("id")),
        "summary_updated_at": _now_iso(),
    }


def build_safety_evidence_snapshot(
    *,
    company_id: str,
    analysis_id: str,
    policy_id: str,
    equipment_id: str,
) -> dict[str, Any]:
    summary = build_safety_evidence_summary(
        company_id=company_id,
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )
    viewpoints_snapshot: list[dict[str, Any]] = []
    for viewpoint in summary.get("viewpoints") or []:
        required = _as_list(viewpoint.get("required_evidences"))
        missing_labels = [
            _safe_text(item.get("evidence_label"))
            for item in required
            if isinstance(item, dict) and not item.get("is_uploaded")
        ]
        uploaded_files: list[dict[str, str]] = []
        for item in required:
            if not isinstance(item, dict):
                continue
            for file_row in _as_list(item.get("files")):
                file_obj = _as_dict(file_row)
                uploaded_files.append(
                    {
                        "file_name": _safe_text(file_obj.get("file_name")),
                        "evidence_label": _safe_text(item.get("evidence_label")),
                    }
                )
        viewpoints_snapshot.append(
            {
                "viewpoint_key": _safe_text(viewpoint.get("viewpoint_key")),
                "viewpoint_title": _safe_text(viewpoint.get("viewpoint_title")),
                "required_count": int(viewpoint.get("required_count") or 0),
                "uploaded_count": int(viewpoint.get("uploaded_count") or 0),
                "evidence_status": _safe_text(viewpoint.get("evidence_status"), "미첨부"),
                "missing_labels": [label for label in missing_labels if label],
                "uploaded_files": [
                    item
                    for item in uploaded_files
                    if item.get("file_name") and item.get("evidence_label")
                ],
            }
        )
    return {
        "snapshot_at": _now_iso(),
        "analysis_id": analysis_id,
        "policy_id": policy_id,
        "equipment_id": equipment_id,
        "total_required_count": int(summary.get("total_required_count") or 0),
        "uploaded_required_count": int(summary.get("uploaded_required_count") or 0),
        "viewpoints": viewpoints_snapshot,
    }


def bootstrap_safety_evidence_baseline(
    *,
    current_user_id: str,
    company_id: str,
    analysis_id: str,
    policy_id: str,
    equipment_id: str | None = None,
) -> dict[str, Any]:
    _assert_company_ownership(company_id, current_user_id)
    roi_output: dict[str, Any] = {}
    resolved_policy_id = _normalize_policy_id(policy_id) or policy_id
    resolved_equipment_id = _safe_text(equipment_id)

    try:
        roi_output = _load_analysis(company_id, analysis_id)
        resolved_policy_id = _resolve_snapshot_policy_id(roi_output, policy_id)
        resolved_equipment_id = _safe_text(
            roi_output.get("equipment_id"),
            resolved_equipment_id,
        )
    except HTTPException as exc:
        # If analysis lookup fails, keep going with explicit equipment_id from workspace.
        if exc.status_code != status.HTTP_404_NOT_FOUND:
            raise

    if not resolved_equipment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="equipment_id를 확인할 수 없어 안전 기준을 생성할 수 없습니다.",
        )

    preview = create_safety_preview(
        analysis_id=analysis_id,
        policy_id=resolved_policy_id,
        equipment_id=resolved_equipment_id,
        body={},
    )
    if preview.get("can_run_safety_logic") is False:
        return {
            "created": False,
            "can_run_safety_logic": False,
            "message": preview.get("message")
            or "이 정책은 안전 증빙 기준 생성 대상이 아닙니다.",
            "analysis_id": analysis_id,
            "policy_id": resolved_policy_id,
            "equipment_id": resolved_equipment_id,
        }

    summary = build_safety_evidence_summary(
        company_id=company_id,
        analysis_id=analysis_id,
        policy_id=resolved_policy_id,
        equipment_id=resolved_equipment_id,
    )
    return {
        "created": True,
        "can_run_safety_logic": True,
        "analysis_id": analysis_id,
        "policy_id": resolved_policy_id,
        "equipment_id": resolved_equipment_id,
        "summary": summary,
    }


def upload_safety_evidence_file(
    *,
    current_user_id: str,
    company_id: str,
    analysis_id: str,
    policy_id: str,
    equipment_id: str,
    viewpoint_key: str,
    safety_rule_id: str,
    evidence_type: str,
    evidence_label: str,
    memo: str | None,
    file_name: str,
    file_mime_type: str,
    file_bytes: bytes,
) -> dict[str, Any]:
    _assert_company_ownership(company_id, current_user_id)
    _assert_pdf_upload(file_name, file_mime_type, file_bytes)
    _, safety_viewer_policy = _assert_analysis_policy_equipment_integrity(
        company_id=company_id,
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )
    required_tuples = _collect_required_evidence_tuples(safety_viewer_policy)
    matched_required = _assert_evidence_tuple_exists(
        required_tuples=required_tuples,
        viewpoint_key=viewpoint_key,
        safety_rule_id=safety_rule_id,
        evidence_type=evidence_type,
        evidence_label=evidence_label,
    )

    file_id = str(uuid4())
    storage_path = "/".join(
        [
            _sanitize_storage_segment(company_id),
            _sanitize_storage_segment(analysis_id),
            _sanitize_storage_segment(policy_id),
            _sanitize_storage_segment(equipment_id),
            _sanitize_storage_segment(viewpoint_key),
            _sanitize_storage_segment(safety_rule_id),
            _normalize_evidence_type(evidence_type),
            f"{file_id}.pdf",
        ]
    )

    db = get_db()
    try:
        db.storage.from_(SAFETY_EVIDENCE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={
                "content-type": "application/pdf",
                "upsert": "false",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"안전 증빙 파일 업로드에 실패했습니다: {exc}",
        ) from exc

    payload = {
        "company_id": company_id,
        "analysis_id": analysis_id,
        "safety_viewer_policy_id": safety_viewer_policy.get("id"),
        "policy_id": policy_id,
        "equipment_id": equipment_id,
        "viewpoint_key": viewpoint_key,
        "safety_rule_id": safety_rule_id,
        "evidence_type": evidence_type,
        "evidence_label": evidence_label,
        "base_evidence_label": matched_required.get("base_evidence_label"),
        "file_url": "",
        "file_name": file_name,
        "file_mime_type": "application/pdf",
        "file_size_bytes": len(file_bytes),
        "uploaded_by": current_user_id,
        "uploaded_at": _now_iso(),
        "memo": memo or None,
        "storage_bucket": SAFETY_EVIDENCE_BUCKET,
        "storage_path": storage_path,
        "upload_status": "uploaded",
        "verification_status": "not_reviewed",
    }

    try:
        result = db.table("user_safety_files").insert(payload).execute()
        file_row = (result.data or [payload])[0]
    except Exception as exc:
        try:
            db.storage.from_(SAFETY_EVIDENCE_BUCKET).remove([storage_path])
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"안전 증빙 메타데이터 저장에 실패했습니다: {exc}",
        ) from exc

    summary = build_safety_evidence_summary(
        company_id=company_id,
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )
    return {
        "file": {
            "file_id": _safe_text(file_row.get("id")),
            "file_name": _safe_text(file_row.get("file_name"), file_name),
            "file_mime_type": "application/pdf",
            "file_size_bytes": int(file_row.get("file_size_bytes") or len(file_bytes)),
            "uploaded_at": file_row.get("uploaded_at"),
            "verification_status": _safe_text(
                file_row.get("verification_status"),
                "not_reviewed",
            ),
            "storage_bucket": _safe_text(
                file_row.get("storage_bucket"),
                SAFETY_EVIDENCE_BUCKET,
            ),
            "storage_path": _safe_text(file_row.get("storage_path"), storage_path),
        },
        "summary": summary,
    }


def create_safety_evidence_download_url(
    *,
    file_id: str,
    current_user_id: str,
    signed_url_ttl_seconds: int = 300,
) -> dict[str, Any]:
    db = get_db()
    file_rows = (
        db.table("user_safety_files")
        .select("*")
        .eq("id", file_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
        .data
        or []
    )
    if not file_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다.",
        )
    row = file_rows[0]
    company_id = _safe_text(row.get("company_id"))
    _assert_company_ownership(company_id, current_user_id)

    bucket = _safe_text(row.get("storage_bucket"), SAFETY_EVIDENCE_BUCKET)
    storage_path = _safe_text(row.get("storage_path"))
    if not storage_path:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="storage_path가 없어 다운로드할 수 없습니다.",
        )

    try:
        signed = db.storage.from_(bucket).create_signed_url(
            storage_path,
            signed_url_ttl_seconds,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"다운로드 URL 생성에 실패했습니다: {exc}",
        ) from exc

    signed_url = _safe_text((signed or {}).get("signedURL"), (signed or {}).get("signedUrl"))
    if not signed_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서명 URL 생성 결과가 비어 있습니다.",
        )
    return {
        "file_id": file_id,
        "file_name": _safe_text(row.get("file_name")),
        "signed_url": signed_url,
        "expires_in_seconds": signed_url_ttl_seconds,
    }


def delete_safety_evidence_file(
    *,
    file_id: str,
    current_user_id: str,
) -> dict[str, Any]:
    db = get_db()
    file_rows = (
        db.table("user_safety_files")
        .select("*")
        .eq("id", file_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
        .data
        or []
    )
    if not file_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="삭제할 파일을 찾을 수 없습니다.",
        )
    row = file_rows[0]
    company_id = _safe_text(row.get("company_id"))
    analysis_id = _safe_text(row.get("analysis_id"))
    policy_id = _safe_text(row.get("policy_id"))
    equipment_id = _safe_text(row.get("equipment_id"))
    _assert_company_ownership(company_id, current_user_id)

    bucket = _safe_text(row.get("storage_bucket"), SAFETY_EVIDENCE_BUCKET)
    storage_path = _safe_text(row.get("storage_path"))
    if storage_path:
        try:
            db.storage.from_(bucket).remove([storage_path])
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"스토리지 파일 삭제에 실패했습니다: {exc}",
            ) from exc

    try:
        db.table("user_safety_files").update(
            {
                "upload_status": "deleted",
                "deleted_at": _now_iso(),
            }
        ).eq("id", file_id).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 삭제 상태 저장에 실패했습니다: {exc}",
        ) from exc

    summary = build_safety_evidence_summary(
        company_id=company_id,
        analysis_id=analysis_id,
        policy_id=policy_id,
        equipment_id=equipment_id,
    )
    return {
        "deleted_file_id": file_id,
        "summary": summary,
    }
