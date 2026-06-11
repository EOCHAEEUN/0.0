from fastapi import APIRouter
from pydantic import BaseModel
from app.graph import factofit_graph
from app.state import FactofitState
from app.core.database import get_db
from app.models.company import CompanyContext

router = APIRouter()

class ChatRequest(BaseModel):
    company_id: str = ""
    message: str
    chat_history: list[dict] = []

@router.post("/chat")
async def chat(req: ChatRequest):
    # company_id로 DB에서 기업 정보 불러오기
    company_info = None
    equipment_info = None
    if req.company_id:
        supabase = get_db()
        # company 테이블 조회
        company_data = supabase.table("company").select("*").eq("company_id", req.company_id).execute()
        if company_data.data:
            company_info = CompanyContext(**company_data.data[0])

         # equipment 테이블 조회
        equipment_data = supabase.table("equipment").select("*").eq("company_id", req.company_id).execute()
        if equipment_data.data:
            from app.models.roi_input import RoiInput
            from app.models.equipment import EquipmentInput
            eq = equipment_data.data[0]
            equipment_info = RoiInput(
                equipment=EquipmentInput(
                    name=eq.get("name", ""),
                    category=eq.get("category", ""),
                    age_years=eq.get("age_years", 0),
                    energy_cost_annual=eq.get("energy_cost_annual", 0),
                    defect_rate=eq.get("defect_rate"),
                    capacity_value=eq.get("capacity_value")
                )
            )

    initial_state: FactofitState = {
        "user_query": req.message,
        "intent": "",
        "is_safe": False,
        "company_info": company_info,
        "equipment": equipment_info,
        "matched_policies": [],
        "roi_result": None,
        "draft_result": None,
        "chat_history": req.chat_history[-10:],  # 최근 10개만
        "final_response": ""
    }

    result = await factofit_graph.ainvoke(initial_state)

    intent = result["intent"]
    if intent == "roi":
        cards = [{"type": "roi_result", "data": result.get("roi_result", {})}]
    elif intent == "policy":
        cards = [{"type": "policy_card", "data": p} for p in result.get("matched_policies", [])]
    elif intent == "draft":
        cards = [{"type": "draft_result", "data": result.get("draft_result", "")}]
    else:
        cards = []

    return {
        "intent": result["intent"],
        "response": result["final_response"],
        "cards": cards,
        "next_questions": [],
        "chat_id": result.get("chat_id", "")
    }
