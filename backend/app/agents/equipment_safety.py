from __future__ import annotations

from typing import Any

from app.core.database import get_db
from app.state import FactofitState


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _as_text(value: Any) -> str:
    return str(value or "").strip()


def _evidence_status_for_item(item: dict[str, Any], uploaded_files: list[dict[str, Any]]) -> str:
    viewpoint_key = _as_text(item.get("viewpoint_key"))
    required = _as_list(item.get("required_evidences"))
    matched = [
        row for row in uploaded_files if _as_text(row.get("viewpoint_key")) == viewpoint_key
    ]
    if not required:
        return "보유" if matched else "미보유"
    if not matched:
        return "미보유"
    required_count = len(required)
    return "보유" if len(matched) >= required_count else "일부 보유"


def build_safety_snapshot(
    *,
    company_id: str,
    analysis_id: str,
    equipment_id: str,
    policy_id: str,
) -> dict[str, Any]:
    db = get_db()
    if not (company_id and analysis_id and equipment_id):
        return {
            "analysis_id": analysis_id,
            "equipment_id": equipment_id,
            "policy_id": policy_id,
            "rows": [],
            "summary": {"total": 0, "need_improvement": 0, "missing_evidence": 0},
            "has_viewer_policy": False,
        }

    resolved_policy_id = policy_id
    viewer_query = (
        db.table("safety_viewer_policy")
        .select("*")
        .eq("analysis_id", analysis_id)
        .eq("equipment_id", equipment_id)
    )
    if resolved_policy_id:
        viewer_rows = (
            viewer_query.eq("policy_id", resolved_policy_id).limit(1).execute().data or []
        )
    else:
        viewer_rows = viewer_query.limit(1).execute().data or []
    viewer_policy = _as_dict(viewer_rows[0]) if viewer_rows else {}
    if not resolved_policy_id:
        resolved_policy_id = _as_text(viewer_policy.get("policy_id"))

    file_query = (
        db.table("user_safety_files")
        .select("*")
        .eq("analysis_id", analysis_id)
        .eq("equipment_id", equipment_id)
    )
    if resolved_policy_id:
        file_rows = file_query.eq("policy_id", resolved_policy_id).execute().data or []
    else:
        file_rows = file_query.execute().data or []
    check_rows = (
        db.table("safety_check_status")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .execute()
        .data
        or []
    )

    def _load_rule_rows(table_name: str) -> list[dict[str, Any]]:
        try:
            return (
                db.table(table_name)
                .select("rule_id,inspection_type,inspection_purpose")
                .execute()
                .data
                or []
            )
        except Exception:
            return (
                db.table(table_name)
                .select("rule_id,inspection_type,purpose")
                .execute()
                .data
                or []
            )

    legal_rule_rows = _load_rule_rows("safety_rule_legal")
    voluntary_rule_rows = _load_rule_rows("safety_rule_voluntary")

    preview_items = [
        item
        for item in _as_list(viewer_policy.get("safety_preview_items"))
        if isinstance(item, dict)
    ]
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(preview_items, start=1):
        judgement = _as_text(item.get("current_judgement")) or "개선 필요"
        if judgement == "판단 정보 없음" and check_rows:
            judgement = _as_text(_as_dict(check_rows[0]).get("status")) or judgement
        rows.append(
            {
                "no": item.get("no") or index,
                "viewpoint_key": _as_text(item.get("viewpoint_key")),
                "viewpoint_label": _as_text(item.get("viewpoint_title")) or "안전개선 항목",
                "current_status": judgement,
                "evidence_status": _evidence_status_for_item(item, file_rows),
                "description": _as_text(item.get("description")) or "안전개선 근거 확인이 필요합니다.",
            }
        )

    if not rows and check_rows:
        for index, check in enumerate(check_rows, start=1):
            row = _as_dict(check)
            has_evidence = bool(
                _as_text(row.get("pdf_file_url") or row.get("inspection_pdf_file"))
            )
            rows.append(
                {
                    "no": index,
                    "viewpoint_key": _as_text(row.get("inspection_rule_id")),
                    "viewpoint_label": _as_text(row.get("check_item"))
                    or _as_text(row.get("inspection_purpose_label"))
                    or "안전점검 항목",
                    "current_status": _as_text(row.get("status")) or "상태 미기재",
                    "evidence_status": "보유" if has_evidence else "미보유",
                    "description": _as_text(row.get("check_content"))
                    or _as_text(row.get("current_safety_measures"))
                    or "점검 내용 확인이 필요합니다.",
                }
            )

    summary = {
        "total": len(rows),
        "need_improvement": sum(1 for row in rows if "개선" in _as_text(row.get("current_status"))),
        "missing_evidence": sum(1 for row in rows if _as_text(row.get("evidence_status")) == "미보유"),
    }

    return {
        "analysis_id": analysis_id,
        "equipment_id": equipment_id,
        "policy_id": resolved_policy_id or policy_id,
        "rows": rows,
        "summary": summary,
        "rule_sources": {
            "legal_count": len(legal_rule_rows),
            "voluntary_count": len(voluntary_rule_rows),
        },
        "has_viewer_policy": bool(viewer_policy),
    }


def equipment_safety_node(state: FactofitState) -> FactofitState:
    snapshot = build_safety_snapshot(
        company_id=_as_text(state.get("company_id")),
        analysis_id=_as_text(state.get("analysis_id")),
        equipment_id=_as_text(state.get("equipment_id")),
        policy_id=_as_text(state.get("policy_id")),
    )
    state["safety_snapshot"] = snapshot
    state["response"] = "현재 분석 기준 안전 상태입니다."
    state["cards"] = [{"type": "safety_status", "data": snapshot}]
    state["intent"] = "safety"
    state["answer_source"] = "database"
    return state
