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


def load_company_context(company_id: str):
    if not company_id:
        return None

    try:
        db = get_db()

        result = (
            db.table("company")
            .select("*")
            .eq("id", company_id)
            .single()
            .execute()
        )

        data = result.data
        if not data:
            return None

        industry_code = data.get("industry_code") or ""

        if isinstance(industry_code, str):
            industry_code = [
                code.strip()
                for code in industry_code.split(",")
                if code.strip()
            ]

        return CompanyContext(
            company_id=data.get("id"),
            company_name=data.get("name", ""),
            industry_code=industry_code,
            employee_count=data.get("employee_count") or 0,
            region=data.get("region", ""),
            annual_revenue=data.get("annual_revenue"),
            energy_cost_annual=data.get("energy_cost_annual"),
        )

    except Exception as e:
        print(f"company 조회 실패: {e}")
        return None


@router.post("/chat")
async def chat(req: ChatRequest):
    company_info = load_company_context(req.company_id)

    initial_state: FactofitState = {
        "user_query": req.message,
        "intent": "",
        "is_safe": False,
        "company_info": company_info,
        "equipment": None,
        "matched_policies": [],
        "roi_result": None,
        "draft_result": None,
        "chat_history": req.chat_history[-10:],
        "final_response": "",
        "chat_id": None
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
        "chat_id": result.get("chat_id")
    }
