from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.agents.capex import capex_advisor_node
from app.state import FactofitState
from datetime import datetime
from app.core.auth import get_current_user
from app.models.auth import CurrentUser

router = APIRouter()

@router.post("/analyze")
async def analyze(
    company_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    # 1. DB에서 기업 정보 조회
    company_data = (
        db.table("company")
        .select("*")
        .eq("company_id", company_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    if not company_data.data:
        return {"success": False, "message": "기업 정보를 찾을 수 없습니다."}

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
        energy_cost_annual=data.get("energy_cost_annual"),
    )

    # 2. DB에서 설비 정보 조회
    equipment_data = db.table("equipment").select("*").eq("company_id", company_id).execute()
    if not equipment_data.data:
        return {"success": False, "message": "설비 정보를 찾을 수 없습니다."}

    eq = equipment_data.data[0]
    equipment_id = eq.get("equipment_id") 
    
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

    # 3. FactofitState 만들어서 capex_advisor_node 실행
    state: FactofitState = {
        "user_query": f"{eq.get('name', '')} ROI 분석",
        "intent": "roi",
        "is_safe": True,
        "company_info": company,
        "equipment": equipment,
        "matched_policies": [],
        "roi_result": None,
        "draft_result": None,
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None
    }
    
    try:
        db.table("roi_output").delete().eq("company_id", company_id).eq("equipment_id", equipment_id).execute()
        db.table("matched_policy").delete().eq("company_id", company_id).eq("equipment_id", equipment_id).execute()
        db.table("draft_result").delete().eq("company_id", company_id).eq("equipment_id", equipment_id).execute()
    except Exception as e:
        print(f"기존 데이터 삭제 실패: {e}")

    result_state = capex_advisor_node(state)

    # 4. roi_output 저장
    if result_state.get("roi_result"):
        try:
            db.table("roi_output").insert({
                "company_id": company_id,
                "equipment_id": equipment_id,
                "roi_data": result_state["roi_result"],
                "created_at": datetime.now().isoformat()
            }).execute()
        except Exception as e:
            print(f"roi_output 저장 실패: {e}")

    # 5. matched_policy 저장
    if result_state.get("matched_policies"):
        try:
            for policy in result_state.get("matched_policies", []):
                db.table("matched_policy").insert({
                    "company_id": company_id,
                    "equipment_id": equipment_id,
                    "policy_id": policy.get("id", ""),
                    "title": policy.get("metadata", {}).get("title", ""),
                    "match_score": round(1 - policy.get("distance", 1), 3),
                    "eligible": policy.get("eligible", True),
                    "reason": policy.get("reason", "RAG 유사도 기반 매칭"),
                    "llm_score": policy.get("llm_score", ""),
                    "created_at": datetime.now().isoformat()
                }).execute()
        except Exception as e:
            print(f"matched_policy 저장 실패: {e}")

    return {
        "success": True,
        "data": {
            "roi_result": result_state.get("roi_result"),
            "matched_policies": result_state.get("matched_policies", []),
            "response": result_state.get("final_response", "")
        }
    }