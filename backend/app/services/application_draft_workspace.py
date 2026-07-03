from __future__ import annotations

import re
from typing import Any, Literal

from app.core.database import get_db
from app.services.safety_preview import (
    DEFAULT_DESCRIPTIONS,
    DEFAULT_VIEWPOINT_KEYS,
    VIEWPOINTS,
    create_safety_preview,
)
from app.services.safety_evidence_service import build_safety_evidence_summary


VIEWPOINT_LABELS: dict[str, str] = {
    "worker_risk_reduction": "작업자 위험 노출 감소",
    "operation_stability": "설비 운용 안정성 개선",
    "automation_safety": "교체 후 안전관리 체계 구축",
    "post_install_safety_management": "교체 후 안전관리 체계 구축",
    "work_environment_improvement": "작업환경 개선",
    "accident_prevention_system": "사고 예방 및 사후관리 체계 보완",
}

READINESS_STATUS = Literal[
    "complete",
    "needs_revision",
    "needs_evidence",
    "legacy_missing",
]


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def _safe_text(*values: Any, default: str = "") -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def _safe_number(*values: Any) -> float | int | None:
    for value in values:
        if value is None or value == "":
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if number.is_integer():
            return int(number)
        return number
    return None


def _is_empty_policy_snapshot(snapshot: Any) -> bool:
    if not isinstance(snapshot, dict) or not snapshot:
        return True
    if not snapshot.get("snapshot_version"):
        return True
    return False


def _snapshot_policy_rows(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in snapshot.get("policies") or []:
        if not isinstance(item, dict):
            continue
        policy_id = str(item.get("policy_id") or "").strip()
        if not policy_id:
            continue
        rows.append(item)
    return rows


def _snapshot_policy_by_id(
    snapshot: dict[str, Any],
    requested_policy_id: str,
) -> dict[str, Any] | None:
    requested = str(requested_policy_id or "").strip()
    if not requested:
        return None
    rows = _snapshot_policy_rows(snapshot)
    direct = next(
        (row for row in rows if str(row.get("policy_id") or "").strip() == requested),
        None,
    )
    if direct:
        return direct

    # some routes append suffixes such as ":A1", ":B1", ":1"
    candidates = [requested]
    candidates.append(re.sub(r":[AB](?:\d+)?$", "", requested, flags=re.IGNORECASE))
    candidates.append(re.sub(r":\d+$", "", requested))
    candidates.append(re.sub(r":[AB]$", "", requested, flags=re.IGNORECASE))

    for candidate in candidates:
        normalized = str(candidate or "").strip()
        if not normalized or normalized == requested:
            continue
        matched = next(
            (row for row in rows if str(row.get("policy_id") or "").strip() == normalized),
            None,
        )
        if matched:
            return matched

    # last resort: requested starts with stored policy id + ":suffix"
    return next(
        (
            row
            for row in rows
            if requested.startswith(f"{str(row.get('policy_id') or '').strip()}:")
        ),
        None,
    )


def _payback_months_from_scenario(scenario: dict[str, Any]) -> int | float | None:
    months = _safe_number(
        scenario.get("payback_months"),
        scenario.get("payback_period_months"),
        scenario.get("payback"),
        scenario.get("recovery_months"),
    )
    if months is not None:
        return months
    years = _safe_number(scenario.get("payback_years"))
    if years is not None:
        return years * 12
    return None


def _scenario_dto(scenario: dict[str, Any]) -> dict[str, Any]:
    return {
        "label": _safe_text(scenario.get("label")),
        "investment_manwon": _safe_number(scenario.get("investment_manwon")),
        "subsidy_manwon": _safe_number(scenario.get("subsidy_manwon")),
        "net_investment_manwon": _safe_number(scenario.get("net_investment_manwon")),
        "payback_years": _safe_number(scenario.get("payback_years")),
        "payback_months": _payback_months_from_scenario(scenario),
        "roi_pct": _safe_number(scenario.get("roi_pct")),
        "annual_net_benefit_manwon": _safe_number(
            scenario.get("annual_net_benefit_manwon")
        ),
    }


def _resolve_selected_scenario(
    *,
    draft_row: dict[str, Any] | None,
    roi_data: dict[str, Any],
) -> str:
    draft_content = _as_dict((draft_row or {}).get("draft_content"))
    scenario_from_draft = _safe_text(
        (draft_row or {}).get("scenario"),
        draft_content.get("scenario_used"),
    ).lower()
    if scenario_from_draft in {"a", "b"}:
        return scenario_from_draft

    recommended = _safe_text(
        roi_data.get("recommended"),
        roi_data.get("recommended_scenario"),
        roi_data.get("selected_scenario"),
    ).lower()
    if "b" in recommended:
        return "b"
    return "a"


def _company_readiness(company: dict[str, Any]) -> dict[str, Any]:
    missing: list[str] = []
    if not _safe_text(company.get("company_name")):
        missing.append("company_name")
    if not _safe_text(company.get("industry_name")):
        missing.append("industry_name")
    if not _safe_text(company.get("region")):
        missing.append("region")

    if not missing:
        summary = "기업명, 업종, 소재지 반영"
        status: READINESS_STATUS = "complete"
    else:
        labels = {
            "company_name": "기업명",
            "industry_name": "업종",
            "region": "소재지",
        }
        summary = f"{', '.join(labels.get(field, field) for field in missing)} 보완 필요"
        status = "needs_revision"

    return {
        "status": status,
        "summary": summary,
        "missing_fields": missing,
    }


def _equipment_readiness(
    equipment: dict[str, Any],
    *,
    has_evidence_files: bool,
    safety_rows_count: int,
) -> dict[str, Any]:
    base_missing: list[str] = []
    field_labels = {
        "name": "설비명",
        "category": "설비 종류",
        "age_years": "사용연수",
        "energy_cost_annual": "연간 에너지비용",
    }
    for field in field_labels:
        value = equipment.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            base_missing.append(field)

    if base_missing:
        summary = (
            f"{', '.join(field_labels[f] for f in base_missing)} 보완 필요"
        )
        return {
            "status": "needs_revision",
            "summary": summary,
            "missing_fields": base_missing,
        }

    if safety_rows_count > 0 and not has_evidence_files:
        return {
            "status": "needs_evidence",
            "summary": "대상 설비 증빙 파일 보완 필요",
            "missing_fields": ["evidence_files"],
        }

    return {
        "status": "complete",
        "summary": "설비 기본정보 및 증빙 반영",
        "missing_fields": [],
    }


def _roi_readiness(roi_data: dict[str, Any]) -> dict[str, Any]:
    scenario_a = _as_dict(roi_data.get("scenario_a"))
    scenario_b = _as_dict(roi_data.get("scenario_b"))

    def scenario_ok(scenario: dict[str, Any]) -> bool:
        return (
            _safe_number(scenario.get("investment_manwon")) is not None
            and (
                _safe_number(scenario.get("payback_years")) is not None
                or _payback_months_from_scenario(scenario) is not None
            )
            and _safe_number(scenario.get("roi_pct")) is not None
        )

    if scenario_ok(scenario_a) or scenario_ok(scenario_b):
        return {
            "status": "complete",
            "summary": "개선 시나리오와 기대효과 반영",
        }

    return {
        "status": "needs_revision",
        "summary": "ROI 시나리오 투자금·회수기간·ROI 수치 보완 필요",
    }


def _policy_readiness(
    *,
    snapshot: dict[str, Any] | None,
    snapshot_policy: dict[str, Any] | None,
    draft_content: dict[str, Any],
    legacy_missing: bool,
) -> dict[str, Any]:
    if legacy_missing:
        return {
            "status": "legacy_missing",
            "summary": "정책 이력 없음 (분석 당시 스냅샷 미저장)",
        }

    if not snapshot_policy:
        return {
            "status": "needs_revision",
            "summary": "지원사업 정책 선택 확인 필요",
        }

    title = _safe_text(snapshot_policy.get("title"))
    if not _safe_text(draft_content.get("application_purpose")):
        return {
            "status": "needs_revision",
            "summary": "신청 목적 문장 확인 필요",
        }

    policies_count = len(_snapshot_policy_rows(snapshot or {}))
    recommended = _safe_text(snapshot.get("recommended_policy_id") if snapshot else "")
    if title and (recommended or policies_count > 0):
        return {
            "status": "complete",
            "summary": f"{title} 스냅샷 기준 반영",
        }

    return {
        "status": "needs_revision",
        "summary": "지원사업 공고 정보 확인 필요",
    }


def _viewpoint_label(key: str, generated_viewpoints: dict[str, Any]) -> str:
    if key in generated_viewpoints:
        return _safe_text(generated_viewpoints[key], default=VIEWPOINT_LABELS.get(key, key))
    return VIEWPOINT_LABELS.get(key, key)


def _evidence_status_for_viewpoint(
    item: dict[str, Any],
    uploaded_files: list[dict[str, Any]],
) -> Literal["보유", "일부 보유", "미보유"]:
    viewpoint_key = _safe_text(item.get("viewpoint_key"))
    required_evidences = _as_list(item.get("required_evidences"))
    rule_ids = {
        _safe_text(rule_id)
        for rule_id in _as_list(item.get("matched_safety_rule_ids"))
        if _safe_text(rule_id)
    }

    matched_files = [
        row
        for row in uploaded_files
        if _safe_text(row.get("viewpoint_key")) == viewpoint_key
        or _safe_text(row.get("safety_rule_id")) in rule_ids
    ]

    if not required_evidences:
        return "보유" if matched_files else "미보유"

    if not matched_files:
        return "미보유"

    required_keys = {
        _safe_text(ev.get("evidence_type") or ev.get("evidence_label"))
        for ev in required_evidences
        if isinstance(ev, dict)
    }
    required_keys = {key for key in required_keys if key}

    if not required_keys:
        return "보유" if len(matched_files) >= len(required_evidences) else "일부 보유"

    covered = {
        _safe_text(row.get("evidence_type") or row.get("evidence_label"))
        for row in matched_files
    }
    covered = {key for key in covered if key}

    if covered >= required_keys:
        return "보유"
    if covered:
        return "일부 보유"
    return "미보유"


def _equipment_safety_description(viewpoint_key: str, equipment: dict[str, Any]) -> str:
    age_years = _safe_number(equipment.get("age_years"))
    if viewpoint_key == "worker_risk_reduction" and age_years and age_years >= 8:
        return "노후설비로 방호장치 성능 저하 우려"
    if viewpoint_key == "operation_stability":
        if age_years and age_years >= 5:
            return "유지보수비 증가, 누수 이력 있음"
        return _safe_text(
            DEFAULT_DESCRIPTIONS.get("operation_stability"),
            default="설비 운용 안정성 개선 근거 확인 필요",
        )
    if viewpoint_key == "post_install_safety_management":
        return "교체 후 검사·교육·기록 체계 수립 필요"
    return _safe_text(
        DEFAULT_DESCRIPTIONS.get(viewpoint_key),
        default="안전개선 근거 확인이 필요합니다.",
    )


def _build_fallback_safety_rows(
    *,
    equipment: dict[str, Any],
    uploaded_files: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for index, viewpoint_key in enumerate(DEFAULT_VIEWPOINT_KEYS, start=1):
        definition = VIEWPOINTS.get(viewpoint_key, {})
        item = {
            "no": index,
            "viewpoint_key": viewpoint_key,
            "viewpoint_title": _safe_text(
                definition.get("title"),
                VIEWPOINT_LABELS.get(viewpoint_key, viewpoint_key),
            ),
            "current_judgement": _safe_text(
                definition.get("judgement"),
                default="개선 필요",
            ),
            "description": _equipment_safety_description(viewpoint_key, equipment),
            "required_evidences": [],
            "matched_safety_rule_ids": [],
        }
        rows.append(
            {
                "no": index,
                "viewpoint_key": viewpoint_key,
                "viewpoint_label": item["viewpoint_title"],
                "current_status": item["current_judgement"],
                "evidence_status": _evidence_status_for_viewpoint(item, uploaded_files),
                "description": item["description"],
            }
        )
    return rows


def _ensure_safety_viewer_policy(
    *,
    analysis_id: str,
    policy_id: str,
    equipment_id: str,
    equipment: dict[str, Any],
    roi_data: dict[str, Any],
) -> dict[str, Any] | None:
    db = get_db()
    safety_rows = (
        db.table("safety_viewer_policy")
        .select("*")
        .eq("analysis_id", str(analysis_id))
        .eq("policy_id", policy_id)
        .eq("equipment_id", str(equipment_id))
        .limit(1)
        .execute()
        .data
        or []
    )

    existing = safety_rows[0] if safety_rows else None
    preview_items = _as_list((existing or {}).get("safety_preview_items"))
    generated_viewpoints = _as_dict((existing or {}).get("generated_viewpoints"))
    if existing and (preview_items or generated_viewpoints):
        return existing

    try:
        preview = create_safety_preview(
            analysis_id=str(analysis_id),
            policy_id=policy_id,
            equipment_id=str(equipment_id),
            body={
                "equipment_name": equipment.get("name"),
                "equipment_type": equipment.get("category"),
                "equipment": equipment,
                "roi_context": roi_data,
            },
        )
    except Exception:
        return existing

    if preview.get("safety_preview_items") or preview.get("generated_viewpoints"):
        return preview
    return existing or preview


def _build_safety_rows(
    *,
    safety_viewer_policy: dict[str, Any] | None,
    uploaded_files: list[dict[str, Any]],
    safety_check_status: list[dict[str, Any]],
    equipment: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if not safety_viewer_policy:
        if equipment:
            return _build_fallback_safety_rows(
                equipment=equipment,
                uploaded_files=uploaded_files,
            )
        return []

    preview_items = [
        item
        for item in _as_list(safety_viewer_policy.get("safety_preview_items"))
        if isinstance(item, dict)
    ]
    generated_viewpoints = _as_dict(safety_viewer_policy.get("generated_viewpoints"))

    if not preview_items and generated_viewpoints:
        preview_items = [
            {
                "no": index + 1,
                "viewpoint_key": key,
                "viewpoint_title": _viewpoint_label(key, generated_viewpoints),
                "current_judgement": VIEWPOINTS.get(key, {}).get("judgement", "판단 정보 없음"),
                "description": _safe_text(
                    generated_viewpoints.get(key),
                    DEFAULT_DESCRIPTIONS.get(key),
                    default="안전개선 근거를 아직 생성하지 않았습니다.",
                ),
            }
            for index, key in enumerate(generated_viewpoints.keys())
        ]

    if not preview_items and equipment:
        return _build_fallback_safety_rows(
            equipment=equipment,
            uploaded_files=uploaded_files,
        )

    rows: list[dict[str, Any]] = []
    for item in preview_items:
        viewpoint_key = _safe_text(item.get("viewpoint_key"))
        current_status = _safe_text(
            item.get("current_judgement"),
            item.get("current_status"),
            default="판단 정보 없음",
        )

        if safety_check_status and current_status == "판단 정보 없음":
            check = safety_check_status[0]
            check_status = _safe_text(check.get("status"))
            if check_status:
                current_status = check_status

        description = _safe_text(item.get("description"))
        if not description:
            description = _equipment_safety_description(
                viewpoint_key,
                equipment or {},
            )

        rows.append(
            {
                "no": _safe_number(item.get("no")) or len(rows) + 1,
                "viewpoint_key": viewpoint_key,
                "viewpoint_label": _safe_text(
                    item.get("viewpoint_title"),
                    _viewpoint_label(viewpoint_key, generated_viewpoints),
                ),
                "current_status": current_status,
                "evidence_status": _evidence_status_for_viewpoint(item, uploaded_files),
                "description": description,
            }
        )

    return rows


def _build_summary_paragraphs(draft_content: dict[str, Any]) -> list[str]:
    paragraphs: list[str] = []
    for key in (
        "business_necessity",
        "application_purpose",
        "expected_benefits",
        "expected_effects",
    ):
        value = draft_content.get(key)
        if isinstance(value, list):
            text = " ".join(str(item).strip() for item in value if str(item).strip())
        else:
            text = _safe_text(value)
        if text:
            paragraphs.append(text)
    return paragraphs


def _safety_rows_from_summary(summary: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(summary, dict):
        return []
    rows: list[dict[str, Any]] = []
    for index, viewpoint in enumerate(_as_list(summary.get("viewpoints")), start=1):
        data = _as_dict(viewpoint)
        rows.append(
            {
                "no": index,
                "viewpoint_key": _safe_text(data.get("viewpoint_key")),
                "viewpoint_label": _safe_text(
                    data.get("viewpoint_title"),
                    data.get("viewpoint_key"),
                ),
                "current_status": _safe_text(
                    data.get("current_judgement"),
                    "개선 필요",
                ),
                "evidence_status": _safe_text(data.get("evidence_status"), "미첨부"),
                "description": _safe_text(data.get("description")),
            }
        )
    return rows


def _is_safety_snapshot_outdated(
    draft_snapshot: dict[str, Any] | None,
    live_summary: dict[str, Any] | None,
) -> bool:
    if not isinstance(draft_snapshot, dict) or not isinstance(live_summary, dict):
        return False
    if not draft_snapshot.get("snapshot_at"):
        return False
    if _safe_number(draft_snapshot.get("total_required_count")) != _safe_number(
        live_summary.get("total_required_count")
    ):
        return True
    if _safe_number(draft_snapshot.get("uploaded_required_count")) != _safe_number(
        live_summary.get("uploaded_required_count")
    ):
        return True

    draft_map = {
        _safe_text(item.get("viewpoint_key")): _as_dict(item)
        for item in _as_list(draft_snapshot.get("viewpoints"))
    }
    live_map = {
        _safe_text(item.get("viewpoint_key")): _as_dict(item)
        for item in _as_list(live_summary.get("viewpoints"))
    }
    if set(draft_map.keys()) != set(live_map.keys()):
        return True
    for key, live_row in live_map.items():
        draft_row = _as_dict(draft_map.get(key))
        if _safe_number(draft_row.get("required_count")) != _safe_number(
            live_row.get("required_count")
        ):
            return True
        if _safe_number(draft_row.get("uploaded_count")) != _safe_number(
            live_row.get("uploaded_count")
        ):
            return True
    return False


def _verify_company_ownership(db: Any, company_id: str, user_id: str) -> dict[str, Any]:
    result = (
        db.table("company")
        .select("*")
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise PermissionError("기업 정보를 찾을 수 없거나 접근 권한이 없습니다.")
    return result.data[0]


def load_application_draft_workspace(
    *,
    company_id: str,
    analysis_id: str | None,
    policy_id: str | None,
    user_id: str,
) -> dict[str, Any]:
    if not analysis_id:
        return {
            "state": "analysis_required",
            "message": "분석을 선택해야 신청서 초안 화면을 열 수 있습니다.",
            "analysis_id": None,
        }

    db = get_db()
    company = _verify_company_ownership(db, company_id, user_id)

    roi_result = (
        db.table("roi_output")
        .select("*")
        .eq("id", analysis_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
    )
    if not roi_result.data:
        raise LookupError("분석 이력을 찾을 수 없습니다.")

    roi_output = roi_result.data[0]
    equipment_id = str(roi_output.get("equipment_id") or "").strip()

    equipment_result = (
        db.table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .limit(1)
        .execute()
    )
    equipment = equipment_result.data[0] if equipment_result.data else {}

    snapshot = _as_dict(roi_output.get("policy_snapshot"))
    legacy_missing = _is_empty_policy_snapshot(snapshot)

    resolved_policy_id = _safe_text(policy_id)
    if not resolved_policy_id and not legacy_missing:
        resolved_policy_id = _safe_text(snapshot.get("recommended_policy_id"))

    snapshot_policy = (
        _snapshot_policy_by_id(snapshot, resolved_policy_id)
        if resolved_policy_id and not legacy_missing
        else None
    )
    if not snapshot_policy and not legacy_missing:
        snapshot_policy = _snapshot_policy_by_id(
            snapshot,
            _safe_text(snapshot.get("recommended_policy_id")),
        )
    if snapshot_policy:
        resolved_policy_id = _safe_text(snapshot_policy.get("policy_id"), resolved_policy_id)

    policy_detail: dict[str, Any] = {}
    if resolved_policy_id and not legacy_missing:
        policy_rows = (
            db.table("policy")
            .select("*")
            .eq("policy_id", resolved_policy_id)
            .limit(1)
            .execute()
        )
        if policy_rows.data:
            policy_detail = policy_rows.data[0]

    draft_row: dict[str, Any] | None = None
    if resolved_policy_id:
        draft_query = (
            db.table("draft_result")
            .select("*")
            .eq("company_id", company_id)
            .eq("analysis_id", analysis_id)
            .eq("policy_id", resolved_policy_id)
            .order("created_at", desc=True)
            .limit(1)
        )
        draft_result = draft_query.execute()
        if not draft_result.data:
            draft_result = (
                db.table("draft_result")
                .select("*")
                .eq("company_id", company_id)
                .eq("equipment_id", equipment_id)
                .eq("policy_id", resolved_policy_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        if draft_result.data:
            draft_row = draft_result.data[0]

    roi_data = _as_dict(roi_output.get("roi_data"))
    selected_scenario = _resolve_selected_scenario(
        draft_row=draft_row,
        roi_data=roi_data,
    )
    draft_content = _as_dict((draft_row or {}).get("draft_content"))

    safety_summary: dict[str, Any] | None = None
    safety_message: str | None = None
    if resolved_policy_id and equipment_id:
        try:
            safety_summary = build_safety_evidence_summary(
                company_id=company_id,
                analysis_id=str(analysis_id),
                policy_id=resolved_policy_id,
                equipment_id=str(equipment_id),
            )
        except Exception as exc:
            if getattr(exc, "status_code", None) == 404:
                safety_message = "현재 분석에 연결된 안전 증빙 기준이 아직 준비되지 않았습니다."
            else:
                safety_message = "증빙 현황을 불러오지 못했습니다."

    safety_table_rows = _safety_rows_from_summary(safety_summary)
    has_evidence_files = bool(_safe_number((safety_summary or {}).get("uploaded_required_count")))
    draft_snapshot = _as_dict(draft_content.get("safety_evidence_snapshot"))
    is_safety_snapshot_outdated = _is_safety_snapshot_outdated(draft_snapshot, safety_summary)

    readiness = {
        "company": _company_readiness(company),
        "equipment": _equipment_readiness(
            equipment,
            has_evidence_files=has_evidence_files,
            safety_rows_count=len(safety_table_rows),
        ),
        "roi": _roi_readiness(roi_data),
        "policy": _policy_readiness(
            snapshot=snapshot if not legacy_missing else None,
            snapshot_policy=snapshot_policy,
            draft_content=draft_content,
            legacy_missing=legacy_missing,
        ),
    }

    policy_title = _safe_text(
        snapshot_policy.get("title") if snapshot_policy else "",
        policy_detail.get("title"),
    )
    policy_deadline = _safe_text(
        snapshot_policy.get("deadline_display") if snapshot_policy else "",
        snapshot_policy.get("deadline") if snapshot_policy else "",
        policy_detail.get("deadline_display"),
        policy_detail.get("deadline"),
    )

    return {
        "state": "ready",
        "analysis_id": str(analysis_id),
        "company_id": company_id,
        "equipment_id": equipment_id,
        "policy_id": resolved_policy_id or None,
        "company": {
            "company_name": company.get("company_name"),
            "industry_name": company.get("industry_name"),
            "region": company.get("region"),
            "company_type": company.get("company_type"),
        },
        "equipment": {
            "equipment_id": equipment.get("equipment_id"),
            "name": equipment.get("name"),
            "category": equipment.get("category"),
            "age_years": equipment.get("age_years"),
            "energy_cost_annual": equipment.get("energy_cost_annual"),
        },
        "readiness": readiness,
        "scenarios": {
            "selected": selected_scenario,
            "a": _scenario_dto(_as_dict(roi_data.get("scenario_a"))),
            "b": _scenario_dto(_as_dict(roi_data.get("scenario_b"))),
        },
        "policy": {
            "policy_id": resolved_policy_id or None,
            "title": policy_title or None,
            "deadline": policy_deadline or None,
            "source": "policy_snapshot" if not legacy_missing else "legacy_missing",
            "legacy_missing": legacy_missing,
        },
        "draft": {
            "exists": bool(draft_row),
            "draft_result_id": (draft_row or {}).get("draft_result_id"),
            "content": draft_content if draft_row else {},
            "summary_paragraphs": _build_summary_paragraphs(draft_content)
            if draft_row
            else [],
        },
        "safety": {
            "rows": safety_table_rows,
            "has_viewer_policy": bool(safety_summary),
            "message": safety_message,
            "summary": safety_summary or None,
            "draft_snapshot": draft_snapshot if draft_snapshot else None,
            "is_snapshot_outdated": is_safety_snapshot_outdated,
        },
    }
