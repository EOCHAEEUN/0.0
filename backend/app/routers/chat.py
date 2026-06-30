from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.advisor_chat_service import AdvisorChatService

router = APIRouter()


class ChatRequest(BaseModel):
    company_id: str = ""
    message: str
    chat_history: list[dict] = []
    selected_equipment_id: str = ""
    policy_intent_choice: str = ""
    analysis_id: str = ""
    source: str = ""
    action: str = ""
    chat_id: str = ""
    session_id: str = ""


class AdvisorSessionCreateRequest(BaseModel):
    company_id: str
    analysis_id: str = ""
    equipment_id: str = ""


@router.post("/chat")
async def chat(req: ChatRequest):
    return await AdvisorChatService.handle_chat(req)


@router.get("/advisor/sessions")
def get_advisor_sessions(
    company_id: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    AdvisorChatService.ensure_company_owner(company_id, current_user.id)
    return {"success": True, "data": AdvisorChatService.list_sessions(company_id, limit)}


@router.get("/advisor/sessions/{session_id}")
def get_advisor_session(
    session_id: str,
    company_id: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    AdvisorChatService.ensure_company_owner(company_id, current_user.id)
    return {"success": True, "data": AdvisorChatService.get_session(company_id, session_id)}


@router.post("/advisor/sessions")
def create_advisor_session(
    req: AdvisorSessionCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    AdvisorChatService.ensure_company_owner(req.company_id, current_user.id)
    summary = AdvisorChatService.create_session(req.company_id, req.analysis_id, req.equipment_id)
    return {"success": True, "data": summary}


@router.get("/chat/sessions")
def get_chat_sessions(
    company_id: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    return get_advisor_sessions(company_id=company_id, limit=limit, current_user=current_user)


@router.get("/chat/sessions/{chat_id}")
def get_chat_session(
    chat_id: str,
    company_id: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    return get_advisor_session(session_id=chat_id, company_id=company_id, current_user=current_user)
