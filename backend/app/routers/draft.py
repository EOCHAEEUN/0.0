from datetime import datetime
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