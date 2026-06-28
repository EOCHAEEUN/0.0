# app/routers/chat.py
from fastapi import APIRouter
from pydantic import BaseModel

from app.graph import factofit_graph
from app.state import FactofitState
from app.core.database import get_db
from app.models.company import CompanyContext
from app.agents.policy import policy_chat_node

router = APIRouter()


class ChatRequest(BaseModel):
    company_id: str = ""
    message: str
    chat_history: list[dict] = []
    selected_equipment_id: str = ""
    policy_intent_choice: str = ""


@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        # 로그인 필수 — company_id 없으면 바로 차단
        if not req.company_id:
            return {
                "intent": "general",
                "response": "로그인 후 이용하실 수 있습니다.",
                "cards": [],
                "next_questions": [],
                "chat_id": "",
            }

        company_info = None
        equipment_info = None
        equipment_id = None
        equipments = []
        selected_equipment_for_policy = None

        supabase = get_db()

        # company 테이블 조회
        company_data = (
            supabase.table("company")
            .select("*")
            .eq("company_id", req.company_id)
            .execute()
        )

        if company_data.data:
            data = company_data.data[0]

            if isinstance(data.get("industry_code"), str):
                data["industry_code"] = [
                    code.strip()
                    for code in data["industry_code"].split(",")
                    if code.strip()
                ]

            company_info = CompanyContext(
                company_id=data.get("company_id"),
                company_name=data.get("company_name", ""),
                business_registration_no=data.get("business_registration_no"),
                industry_name=data.get("industry_name"),
                industry_code=data.get("industry_code", []),
                region=data.get("region", ""),
                company_type=data.get("company_type"),
                primary_purpose=data.get("primary_purpose") or [],
                employee_count=data.get("employee_count"),
                annual_revenue=data.get("annual_revenue"),
                revenue_2y_ago_manwon=data.get("revenue_2y_ago_manwon"),
                revenue_3y_ago_manwon=data.get("revenue_3y_ago_manwon"),
                total_assets_manwon=data.get("total_assets_manwon"),
                is_disclosure_group_member=data.get("is_disclosure_group_member"),
                independence_check_passed=data.get("independence_check_passed"),
                energy_cost_annual=data.get("energy_cost_annual"),
                user_id=data.get("user_id"),
                created_at=data.get("created_at"),
                updated_at=data.get("updated_at"),
            )

        # equipment 테이블 조회 - 전체 목록 가져오기
        equipment_data = (
            supabase.table("equipment")
            .select("*")
            .eq("company_id", req.company_id)
            .execute()
        )

        equipments = equipment_data.data if equipment_data.data else []

        # 설비 선택 로직
        # 우선순위 1: selected_equipment_id 직접 넘겨준 경우 (버튼 클릭)
        # 우선순위 2: 설비가 1개인 경우 자동 선택
        # 우선순위 3: 여러 개이고 선택 안 된 경우 → info_collector에서 선택 요청

        if req.selected_equipment_id:
            selected = next(
                (eq for eq in equipments if eq.get("equipment_id") == req.selected_equipment_id),
                None
            )
            if selected:
                from app.models.equipment import EquipmentInput
                equipment_id = selected.get("equipment_id")
                equipment_info = EquipmentInput(
                    name=selected.get("name", ""),
                    category=selected.get("category", ""),
                    age_years=selected.get("age_years", 0),
                    energy_cost_annual=selected.get("energy_cost_annual", 0),
                    defect_rate=selected.get("defect_rate"),
                    current_capacity_value=selected.get("current_capacity_value"),
                    scenario_a_investment_manwon=selected.get("scenario_a_investment_manwon"),
                    scenario_b_investment_manwon=selected.get("scenario_b_investment_manwon"),
                )
                selected_equipment_for_policy = selected.get("name")

        elif len(equipments) == 1:
            from app.models.equipment import EquipmentInput
            eq = equipments[0]
            equipment_id = eq.get("equipment_id")
            equipment_info = EquipmentInput(
                name=eq.get("name", ""),
                category=eq.get("category", ""),
                age_years=eq.get("age_years", 0),
                energy_cost_annual=eq.get("energy_cost_annual", 0),
                defect_rate=eq.get("defect_rate"),
                current_capacity_value=eq.get("current_capacity_value"),
                scenario_a_investment_manwon=eq.get("scenario_a_investment_manwon"),
                scenario_b_investment_manwon=eq.get("scenario_b_investment_manwon"),
            )
            selected_equipment_for_policy = eq.get("name")

        initial_state: FactofitState = {
            "user_query": req.message,
            "intent": "",
            "is_safe": True,
            "company_info": company_info,
            "equipment": equipment_info,
            "equipment_id": equipment_id,
            "equipments": equipments,
            "selected_equipment_id": req.selected_equipment_id or None,
            "safety_dashboard": None,
            "matched_policies": [],
            "selected_policy": None,
            "selected_equipment_for_policy": selected_equipment_for_policy or None, 
            "roi_result": None,
            "draft_result": None,
            "draft_context": None,
            "chat_history": req.chat_history[-10:],
            "final_response": "",
            "unsupported_equipment": False,
            "chat_id": None,
            "options": None,
            "policy_intent_choice": req.policy_intent_choice or None,
        }

        result = await factofit_graph.ainvoke(initial_state)

        intent = result["intent"]

        if intent == "roi":
            cards = [{"type": "roi_result", "data": result.get("roi_result", {})}]
        elif intent == "policy":
            cards = [
                {"type": "policy_card", "data": p}
                for p in result.get("matched_policies", [])
            ]
        elif intent == "draft":
            cards = [{"type": "draft_result", "data": result.get("draft_result", "")}]
        elif intent == "info_missing":
            cards = [
                {
                    "type": "equipment_selection",
                    "data": [
                        {
                            "equipment_id": eq.get("equipment_id"),
                            "name": eq.get("name"),
                            "category": eq.get("category"),
                            "age_years": eq.get("age_years"),
                        }
                        for eq in result.get("equipments", [])
                    ]
                }
            ]
        elif intent == "response":
            # options가 있으면 intent_confirmation (버튼)
            if result.get("options"):
                cards = [{
                    "type": "intent_confirmation",
                    "data": result.get("options", [])
                }]
            # matched_policies가 있으면 정책 카드
            elif result.get("matched_policies"):
                cards = [
                    {
                        "type": "policy_card",
                        "data": {
                            "policy_id": p.get("id"),
                            "title": p.get("metadata", {}).get("title", "제목 없음"),
                            "organization": p.get("metadata", {}).get("organization", ""),
                            "deadline": p.get("metadata", {}).get("deadline", "마감일 미정")
                        }
                    }
                    for p in result.get("matched_policies", [])
                ]
            else:
                cards = []
                
        else:
            cards = []

        return {
            "intent": result["intent"],
            "response": result["final_response"],
            "cards": cards,
            "matched_policies": result.get("matched_policies", []),
            "selected_equipment_for_policy": result.get("selected_equipment_for_policy"),
            "next_questions": [],
            "chat_id": result.get("chat_id", ""),
        }
    
    except Exception as e:
        print(f"❌ 채팅 에러: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "intent": "general",
            "response": f"에러 발생: {str(e)}",
            "cards": [],
            "next_questions": [],
            "chat_id": "",
        }