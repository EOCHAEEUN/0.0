from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.agents.router import run_agent

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    company_context: dict = {}
    history: list[dict] = []

@router.post("/chat")
async def chat(req: ChatRequest):
    """SSE 스트리밍 채팅 엔드포인트"""
    return StreamingResponse(
        run_agent(req.message, req.company_context, req.history),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no"},
    )
