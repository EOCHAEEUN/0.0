from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.agents.draft import application_draft_node
from app.state import FactofitState
from fastapi import Depends
from datetime import datetime

router = APIRouter()


class DraftRequest(BaseModel):
    company_id: str
    equipment_id: str
    scenario: str  # "a" 또는 "b"


@router.post("/draft")
async def generate_draft(
    body: DraftRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    # 1. company 조회
    company_data = db.table("company").select("*").eq("company_id", body.company_id).eq("user_id", current_user.id).execute()
    if not company_data.data:
        return JSONResponse(status_code=404, content={"success": False, "message": "기업 정보를 찾을 수 없습니다."})

    data = company_data.data[0]
    if isinstance(data.get("industry_code"), str):
        data["industry_code"] = [c.strip() for c in data["industry_code"].split(",")]

    company = CompanyContext(
        company_id=data.get("company_id"),
        company_name=data.get("company_name", ""),
        industry_code=data.get("industry_code", []),
        region=data.get("region", ""),
        company_type=data.get("company_type"),
        employee_count=data.get("employee_count"),
        annual_revenue=data.get("annual_revenue"),
    )

    # 2. equipment 조회
    equipment_data = db.table("equipment").select("*").eq("equipment_id", body.equipment_id).execute()
    if not equipment_data.data:
        return JSONResponse(status_code=404, content={"success": False, "message": "설비 정보를 찾을 수 없습니다."})

    eq = equipment_data.data[0]
    equipment = EquipmentInput(
        name=eq.get("name", ""),
        category=eq.get("category", ""),
        age_years=eq.get("age_years", 0),
        energy_cost_annual=eq.get("energy_cost_annual", 0),
        defect_rate=eq.get("defect_rate"),
        maintenance_cost_annual=eq.get("maintenance_cost_annual"),
        current_capacity_value=eq.get("current_capacity_value"),
        production_qty=eq.get("production_qty"),
        contribution_margin_won=eq.get("contribution_margin_won"),
        scenario_a_investment_manwon=eq.get("scenario_a_investment_manwon"),
        scenario_b_investment_manwon=eq.get("scenario_b_investment_manwon"),
    )

    # 3. roi_output 조회
    roi_data = db.table("roi_output").select("*").eq("company_id", body.company_id).eq("equipment_id", body.equipment_id).execute()
    if not roi_data.data:
        return JSONResponse(status_code=404, content={"success": False, "message": "ROI 결과를 찾을 수 없습니다."})

    roi_result = roi_data.data[0].get("roi_data", {})

    # 4. 시나리오 선택
    scenario_key = f"scenario_{body.scenario.lower()}"
    selected_scenario = roi_result.get(scenario_key, {})

    # 5. matched_policy 조회
    policy_data = db.table("matched_policy").select("*").eq("company_id", body.company_id).execute()
    matched_policies = policy_data.data if policy_data.data else []

    # 6. state 만들어서 draft 노드 실행
    state: FactofitState = {
        "user_query": f"{eq.get('name', '')} {body.scenario.upper()}안 신청서 초안 작성",
        "intent": "draft",
        "is_safe": True,
        "company_info": company,
        "equipment": equipment,
        "equipment_id": body.equipment_id,
        "matched_policies": matched_policies,
        "roi_result": selected_scenario,
        "draft_result": None,
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None,
    }

    result_state = application_draft_node(state)

    # 7. draft_result 저장
    draft_content = result_state.get("draft_result")
    if draft_content:
        policy_id = matched_policies[0].get("policy_id", "") if matched_policies else ""
        db.table("draft_result").insert({
            "company_id": body.company_id,
            "equipment_id": body.equipment_id,
            "scenario": body.scenario,
            "policy_id": policy_id,
            "draft_content": draft_content,
            "created_at": datetime.now().isoformat()
        }).execute()

    return {
        "success": True,
        "data": {
            "scenario": body.scenario,
            "draft_result": draft_content,
        }
    }