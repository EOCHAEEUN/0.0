from fastapi import APIRouter
from pydantic import BaseModel
from app.graph import factofit_graph
from app.state import FactofitState

router = APIRouter()

class ChatRequest(BaseModel):
    company_id: str = ""
    message: str
    chat_history: list[dict] = []

@router.post("/chat")
async def chat(req: ChatRequest):
    initial_state: FactofitState = {
        "user_query": req.message,
        "intent": "",
        "is_safe": False,
        "company_info": None,
        "equipment": None,
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
        "chat_id": ""
    }
