from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents.draft import application_draft_node
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.auth import CurrentUser
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.state import FactofitState


router = APIRouter()


class DraftRequest(BaseModel):
    company_id: str
    equipment_id: str
    policy_id: str


def _normalize_industry_code(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(code).strip() for code in value if str(code).strip()]
    return [code.strip() for code in str(value).split(",") if code.strip()]


def _normalize_scenario_match(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).lower() for item in value if str(item).strip()]
    return [str(value).lower()]


def _resolve_draft_scenario(policy: dict, roi_data: dict) -> tuple[str, dict]:
    """
    Pick the ROI scenario used for the draft.

    A: use scenario_a
    B: use scenario_b
    C: common-fit policy, but agreed draft basis is recommended A -> scenario_a
    """
    scenario_match = _normalize_scenario_match(policy.get("scenario_match"))

    if "c" in scenario_match or set(scenario_match) == {"a", "b"}:
        return "a", roi_data.get("scenario_a", {})
    if "a" in scenario_match:
        return "a", roi_data.get("scenario_a", {})
    if "b" in scenario_match:
        return "b", roi_data.get("scenario_b", {})

    return "a", roi_data.get("scenario_a", {})


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None
    return None


def _status_period_date(row: dict) -> date | None:
    for key in (
        "due_date",
        "due_at",
        "scheduled_at",
        "target_date",
        "check_date",
        "checked_at",
        "completed_at",
        "updated_at",
        "created_at",
    ):
        parsed = _parse_date(row.get(key))
        if parsed:
            return parsed
    return None


def _build_safety_management_context(
    db: Any,
    company_id: str,
    equipment_id: str,
    today: date | None = None,
) -> dict[str, Any]:
    if today is None:
        today = date.today()

    since = today - timedelta(days=183)
    try:
        status_result = (
            db.table("safety_check_status")
            .select("*")
            .eq("company_id", company_id)
            .eq("equipment_id", equipment_id)
            .execute()
        )
    except Exception as exc:
        return {
            "completion_rate_6m": None,
            "grade": "unknown",
            "severe_overdue_count": 0,
            "sentence": "안전점검 이력 데이터 확인이 필요합니다.",
            "error": str(exc),
        }

    status_rows = status_result.data or []
    rule_ids = sorted({row.get("rule_id") for row in status_rows if row.get("rule_id")})
    legal_by_rule_id: dict[str, dict] = {}

    if rule_ids:
        try:
            legal_result = (
                db.table("safety_rule_legal")
                .select("rule_id, penalty_type")
                .in_("rule_id", rule_ids)
                .execute()
            )
            legal_by_rule_id = {
                row.get("rule_id"): row
                for row in (legal_result.data or [])
                if row.get("rule_id")
            }
        except Exception:
            legal_by_rule_id = {}

    completed_statuses = {"done", "completed", "complete", "normal"}
    severe_penalties = {"direct_fine", "criminal_liability"}
    recent_rows = [
        row
        for row in status_rows
        if (period_date := _status_period_date(row)) and since <= period_date <= today
    ]
    completed_count = sum(
        1
        for row in recent_rows
        if str(row.get("status", "")).lower() in completed_statuses
    )
    total_count = len(recent_rows)
    completion_rate = round((completed_count / total_count) * 100) if total_count else None
    severe_overdue_count = sum(
        1
        for row in status_rows
        if str(row.get("status", "")).lower() == "overdue"
        and legal_by_rule_id.get(row.get("rule_id"), {}).get("penalty_type")
        in severe_penalties
    )

    if severe_overdue_count > 0 or (completion_rate is not None and completion_rate < 70):
        grade = "needs_improvement"
        sentence = (
            f"최근 6개월 안전점검 이행률은 {completion_rate}%이며, "
            f"과태료·형사책임 대상 지연 항목이 {severe_overdue_count}건 확인되어 "
            "안전관리 보완이 필요합니다."
            if completion_rate is not None
            else (
                f"과태료·형사책임 대상 지연 항목이 {severe_overdue_count}건 확인되어 "
                "안전관리 보완이 필요합니다."
            )
        )
    elif completion_rate is not None and completion_rate >= 90:
        grade = "excellent"
        sentence = (
            f"최근 6개월 안전점검 이행률이 {completion_rate}%이며, "
            "과태료·형사책임 대상 지연 항목이 없어 안전관리 체계가 우수합니다."
        )
    elif completion_rate is not None:
        grade = "normal"
        sentence = (
            f"최근 6개월 안전점검 이행률이 {completion_rate}%로 보통 수준이며, "
            "주요 법정 안전점검 항목을 지속적으로 관리하고 있습니다."
        )
    else:
        grade = "unknown"
        sentence = "최근 6개월 안전점검 이력 데이터 확인이 필요합니다."

    return {
        "completion_rate_6m": completion_rate,
        "grade": grade,
        "severe_overdue_count": severe_overdue_count,
        "sentence": sentence,
        "completed_count_6m": completed_count,
        "total_count_6m": total_count,
    }


@router.post("/draft")
async def generate_draft(
    body: DraftRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    company_result = (
        db.table("company")
        .select("*")
        .eq("company_id", body.company_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    if not company_result.data:
        raise HTTPException(status_code=404, detail="기업 정보를 찾을 수 없습니다.")

    company_data = company_result.data[0]
    company = CompanyContext(
        company_id=company_data.get("company_id"),
        company_name=company_data.get("company_name", ""),
        industry_code=_normalize_industry_code(company_data.get("industry_code")),
        industry_name=company_data.get("industry_name"),
        region=company_data.get("region", ""),
        company_type=company_data.get("company_type"),
        primary_purpose=company_data.get("primary_purpose") or [],
        employee_count=company_data.get("employee_count"),
        annual_revenue=company_data.get("annual_revenue"),
        revenue_2y_ago_manwon=company_data.get("revenue_2y_ago_manwon"),
        revenue_3y_ago_manwon=company_data.get("revenue_3y_ago_manwon"),
        total_assets_manwon=company_data.get("total_assets_manwon"),
        established_year=company_data.get("established_year"),
        workplace_type=company_data.get("workplace_type"),
    )

    equipment_result = (
        db.table("equipment")
        .select("*")
        .eq("company_id", body.company_id)
        .eq("equipment_id", body.equipment_id)
        .execute()
    )
    if not equipment_result.data:
        raise HTTPException(status_code=404, detail="설비 정보를 찾을 수 없습니다.")

    equipment_data = equipment_result.data[0]
    equipment = EquipmentInput(
        name=equipment_data.get("name", ""),
        category=equipment_data.get("category", ""),
        age_years=equipment_data.get("age_years", 0),
        energy_cost_annual=equipment_data.get("energy_cost_annual", 0),
        defect_rate=equipment_data.get("defect_rate"),
        maintenance_cost_annual=equipment_data.get("maintenance_cost_annual"),
        current_capacity_value=equipment_data.get("current_capacity_value"),
        production_qty=equipment_data.get("production_qty"),
        process=equipment_data.get("process"),
        contribution_margin_won=equipment_data.get("contribution_margin_won"),
        scenario_a_investment_manwon=equipment_data.get("scenario_a_investment_manwon"),
        scenario_b_investment_manwon=equipment_data.get("scenario_b_investment_manwon"),
    )

    roi_result = (
        db.table("roi_output")
        .select("*")
        .eq("company_id", body.company_id)
        .eq("equipment_id", body.equipment_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not roi_result.data:
        raise HTTPException(status_code=404, detail="ROI 분석 결과를 찾을 수 없습니다.")

    roi_data = roi_result.data[0].get("roi_data") or {}

    top_policy_result = (
        db.table("matched_policy")
        .select("*")
        .eq("company_id", body.company_id)
        .eq("equipment_id", body.equipment_id)
        .order("match_score", desc=True)
        .limit(5)
        .execute()
    )
    top_policies = top_policy_result.data or []
    selected_policy = next(
        (policy for policy in top_policies if policy.get("policy_id") == body.policy_id),
        None,
    )

    if not selected_policy:
        raise HTTPException(
            status_code=400,
            detail="신청서 초안은 추천 TOP 5 정책에 대해서만 생성할 수 있습니다.",
        )

    scenario_used, selected_roi_scenario = _resolve_draft_scenario(
        selected_policy,
        roi_data,
    )
    scenario_label = selected_policy.get("scenario_label") or (
        "A안 전체교체 적합" if scenario_used == "a" else "B안 부분개선 적합"
    )

    safety_management = _build_safety_management_context(
        db,
        body.company_id,
        body.equipment_id,
    )

    state: FactofitState = {
        "user_query": f"{equipment.name} {selected_policy.get('title', '')} 신청서 초안 작성",
        "intent": "draft",
        "is_safe": True,
        "company_info": company,
        "equipment": equipment,
        "equipment_id": body.equipment_id,
        "matched_policies": [selected_policy],
        "roi_result": selected_roi_scenario,
        "draft_result": None,
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None,
        "draft_context": {
            "scenario_used": scenario_used,
            "scenario_label": scenario_label,
            "policy": selected_policy,
            "roi_recommended": roi_data.get("recommended"),
            "safety_management": safety_management,
        },
    }

    result_state = application_draft_node(state)
    draft_content = result_state.get("draft_result")

    if not draft_content:
        raise HTTPException(status_code=500, detail="신청서 초안 생성에 실패했습니다.")

    if isinstance(draft_content, dict):
        draft_content = {
            **draft_content,
            "scenario_used": scenario_used,
            "scenario_label": scenario_label,
            "policy_id": body.policy_id,
            "safety_management": safety_management,
        }

    draft_payload = {
        "company_id": body.company_id,
        "equipment_id": body.equipment_id,
        "policy_id": body.policy_id,
        "draft_content": draft_content,
        "created_at": datetime.now().isoformat(),
    }

    saved_draft = db.table("draft_result").insert(draft_payload).execute()

    return {
        "success": True,
        "data": {
            "draft_result_id": (
                saved_draft.data[0].get("draft_result_id")
                if saved_draft.data
                else None
            ),
            "policy_id": body.policy_id,
            "company_id": body.company_id,
            "equipment_id": body.equipment_id,
            "scenario_used": scenario_used,
            "scenario_label": scenario_label,
            "draft_result": draft_content,
        },
    }
