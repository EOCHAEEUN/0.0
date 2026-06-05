from fastapi import APIRouter
from pydantic import BaseModel
from app.graph import factofit_graph
from app.state import FactofitState

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    company_id: str = ""

@router.post("/chat")
async def chat(req: ChatRequest):
    # 초기 State 세팅
    initial_state: FactofitState = {
        "user_query": req.message,
        "intent": "",
        "is_safe": False,
        "company_info": None,
        "equipment": None,
        "matched_policies": [],
        "roi_result": None,
        "draft_result": None,
        "final_response": ""
    }

    result = await factofit_graph.ainvoke(initial_state)

    return {
        "intent": result["intent"],
        "is_safe": result["is_safe"],
        "response": result["final_response"]
    }
