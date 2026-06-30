# app/routers/chat.py
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import get_db
from app.graph import factofit_graph
from app.models.auth import CurrentUser
from app.models.company import CompanyContext
from app.state import FactofitState

router = APIRouter()


class ChatRequest(BaseModel):
    company_id: str = ""
    message: str
    chat_history: list[dict] = []
    selected_equipment_id: str = ""
    policy_intent_choice: str = ""
    analysis_id: str = ""
    source: str = ""
    chat_id: str = ""
    session_id: str = ""


class AdvisorSessionCreateRequest(BaseModel):
    company_id: str
    analysis_id: str = ""
    equipment_id: str = ""


def _as_dict(value):
    return value if isinstance(value, dict) else {}


def _as_text(value):
    if value is None:
        return ""
    return str(value).strip()


def _safe_session_id(value: str = "") -> str:
    text = _as_text(value)
    return text or str(uuid4())


def _normalize_chat_history(items: list[dict]) -> list[dict]:
    normalized = []
    for item in items[-60:]:
        row = _as_dict(item)
        role = _as_text(row.get("role")).lower()
        content = _as_text(row.get("content"))
        if role not in {"user", "assistant"} or not content:
            continue
        created_at = _as_text(row.get("created_at"))
        normalized_item = {"role": role, "content": content}
        if created_at:
            normalized_item["created_at"] = created_at
        normalized.append(normalized_item)
    return normalized


def _merge_histories(server_history: list[dict], client_history: list[dict]) -> list[dict]:
    server = _normalize_chat_history(server_history)
    client = _normalize_chat_history(client_history)

    if not server:
        return client
    if not client:
        return server
    if len(client) <= len(server):
        return server
    if client[:len(server)] == server:
        return client
    return server


def _load_company_row(company_id: str):
    return (
        get_db()
        .table("company")
        .select("*")
        .eq("company_id", company_id)
        .limit(1)
        .execute()
    )


def _ensure_company_owner(company_id: str, current_user: CurrentUser):
    company = (
        get_db()
        .table("company")
        .select("company_id,user_id")
        .eq("company_id", company_id)
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )
    if not company.data:
        raise HTTPException(status_code=403, detail="해당 기업 대화 내역 접근 권한이 없습니다.")


def _resolve_equipment_from_analysis(company_id: str, analysis_id: str):
    analysis = (
        get_db()
        .table("roi_output")
        .select("id,company_id,equipment_id")
        .eq("id", analysis_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
    )
    if not analysis.data:
        return ""
    return _as_text(_as_dict(analysis.data[0]).get("equipment_id"))


def _get_session_row(company_id: str, session_id: str):
    return (
        get_db()
        .table("chat_history")
        .select("chat_id,intent,user_query,chat_history,final_response,created_at,roi_result")
        .eq("company_id", company_id)
        .eq("chat_id", session_id)
        .limit(1)
        .execute()
    )


def _session_summary_from_row(row):
    item = _as_dict(row)
    session_id = _as_text(item.get("chat_id"))
    history = item.get("chat_history") if isinstance(item.get("chat_history"), list) else []
    normalized_history = _normalize_chat_history(history)
    first_user = next((msg for msg in normalized_history if msg.get("role") == "user"), {})
    last_message = normalized_history[-1] if normalized_history else {}
    roi_result = _as_dict(item.get("roi_result"))

    title = _as_text(_as_dict(first_user).get("content"))[:64] or _as_text(item.get("user_query"))[:64] or "새 대화"
    preview = (
        _as_text(_as_dict(last_message).get("content"))
        or _as_text(item.get("final_response"))
        or "(미리보기 없음)"
    )
    updated_at = _as_text(_as_dict(last_message).get("created_at")) or _as_text(item.get("created_at"))

    return {
        "session_id": session_id,
        "chat_id": session_id,
        "intent": _as_text(item.get("intent")),
        "title": title,
        "preview": preview[:140],
        "updated_at": updated_at,
        "created_at": _as_text(item.get("created_at")),
        "analysis_id": _as_text(roi_result.get("analysis_id")),
        "equipment_id": _as_text(roi_result.get("equipment_id")),
    }


def _list_sessions(company_id: str, limit: int):
    rows = (
        get_db()
        .table("chat_history")
        .select("chat_id,intent,user_query,chat_history,final_response,created_at,roi_result")
        .eq("company_id", company_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [_session_summary_from_row(row) for row in rows.data or [] if _as_text(_as_dict(row).get("chat_id"))]


@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        if not req.company_id:
            return {
                "intent": "general",
                "response": "로그인 후 이용하실 수 있습니다.",
                "cards": [],
                "next_questions": [],
                "chat_id": "",
                "session_id": "",
            }

        company_info = None
        equipment_info = None
        equipment_id = None
        equipments = []
        selected_equipment_for_policy = None

        supabase = get_db()
        company_data = _load_company_row(req.company_id)

        if company_data.data:
            data = company_data.data[0]
            if isinstance(data.get("industry_code"), str):
                data["industry_code"] = [
                    code.strip() for code in data["industry_code"].split(",") if code.strip()
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

        equipment_data = (
            supabase.table("equipment")
            .select("*")
            .eq("company_id", req.company_id)
            .execute()
        )
        equipments = equipment_data.data if equipment_data.data else []

        requested_equipment_id = _as_text(req.selected_equipment_id)
        if req.analysis_id and not requested_equipment_id:
            requested_equipment_id = _resolve_equipment_from_analysis(req.company_id, req.analysis_id)

        if requested_equipment_id:
            selected = next((eq for eq in equipments if eq.get("equipment_id") == requested_equipment_id), None)
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

        requested_session_id = _as_text(req.session_id) or _as_text(req.chat_id)
        server_history = []
        if requested_session_id:
            session_row = _get_session_row(req.company_id, requested_session_id)
            if not session_row.data:
                raise HTTPException(status_code=404, detail="선택한 대화 세션을 찾을 수 없습니다.")
            server_history = _as_dict(session_row.data[0]).get("chat_history") or []

        merged_history = _merge_histories(server_history, req.chat_history)

        initial_state: FactofitState = {
            "user_query": req.message,
            "intent": "",
            "is_safe": True,
            "company_info": company_info,
            "equipment": equipment_info,
            "equipment_id": equipment_id,
            "equipments": equipments,
            "selected_equipment_id": requested_equipment_id or None,
            "safety_dashboard": None,
            "matched_policies": [],
            "selected_policy": None,
            "selected_equipment_for_policy": selected_equipment_for_policy or None,
            "roi_result": None,
            "draft_result": None,
            "draft_context": None,
            "chat_history": _normalize_chat_history(merged_history),
            "final_response": "",
            "unsupported_equipment": False,
            "chat_id": requested_session_id or None,
            "options": None,
            "policy_intent_choice": req.policy_intent_choice or None,
            "analysis_id": req.analysis_id or None,
        }

        result = await factofit_graph.ainvoke(initial_state)
        intent = result["intent"]

        if intent == "roi":
            cards = [{"type": "roi_result", "data": result.get("roi_result", {})}]
        elif intent == "policy":
            cards = [{"type": "policy_card", "data": p} for p in result.get("matched_policies", [])]
        elif intent == "draft":
            cards = [{"type": "draft_result", "data": result.get("draft_result", "")}]
        elif intent == "info_missing":
            cards = [{
                "type": "equipment_selection",
                "data": [
                    {
                        "equipment_id": eq.get("equipment_id"),
                        "name": eq.get("name"),
                        "category": eq.get("category"),
                        "age_years": eq.get("age_years"),
                    }
                    for eq in result.get("equipments", [])
                ],
            }]
        elif intent == "response":
            if result.get("options"):
                cards = [{"type": "intent_confirmation", "data": result.get("options", [])}]
            elif result.get("matched_policies"):
                cards = [
                    {
                        "type": "policy_card",
                        "data": {
                            "policy_id": p.get("id"),
                            "title": p.get("metadata", {}).get("title", "제목 없음"),
                            "organization": p.get("metadata", {}).get("organization", ""),
                            "deadline": p.get("metadata", {}).get("deadline", "마감일 미정"),
                        },
                    }
                    for p in result.get("matched_policies", [])
                ]
            else:
                cards = []
        else:
            cards = []

        resolved_session_id = _as_text(result.get("chat_id")) or requested_session_id
        return {
            "intent": result["intent"],
            "response": result["final_response"],
            "cards": cards,
            "matched_policies": result.get("matched_policies", []),
            "selected_equipment_for_policy": result.get("selected_equipment_for_policy"),
            "next_questions": [],
            "chat_id": resolved_session_id,
            "session_id": resolved_session_id,
            "resolved_equipment_id": requested_equipment_id,
            "analysis_id": req.analysis_id,
        }

    except HTTPException:
        raise
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
            "session_id": "",
        }


@router.get("/advisor/sessions")
def get_advisor_sessions(
    company_id: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    _ensure_company_owner(company_id, current_user)
    return {"success": True, "data": _list_sessions(company_id, limit)}


@router.get("/advisor/sessions/{session_id}")
def get_advisor_session(
    session_id: str,
    company_id: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    _ensure_company_owner(company_id, current_user)
    row = _get_session_row(company_id, session_id)
    if not row.data:
        raise HTTPException(status_code=404, detail="대화 내역을 찾을 수 없습니다.")

    item = _as_dict(row.data[0])
    history = _normalize_chat_history(
        item.get("chat_history") if isinstance(item.get("chat_history"), list) else []
    )
    summary = _session_summary_from_row(item)
    return {
        "success": True,
        "data": {
            "session_id": summary["session_id"],
            "chat_id": summary["chat_id"],
            "title": summary["title"],
            "preview": summary["preview"],
            "analysis_id": summary["analysis_id"],
            "updated_at": summary["updated_at"],
            "created_at": summary["created_at"],
            "messages": history,
        },
    }


@router.post("/advisor/sessions")
def create_advisor_session(
    req: AdvisorSessionCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    _ensure_company_owner(req.company_id, current_user)

    session_id = _safe_session_id()
    now_iso = datetime.now().isoformat()
    result = (
        get_db()
        .table("chat_history")
        .insert(
            {
                "chat_id": session_id,
                "company_id": req.company_id,
                "intent": "general",
                "user_query": "새 대화",
                "final_response": "",
                "chat_history": [],
                "roi_result": {
                    "analysis_id": _as_text(req.analysis_id),
                    "equipment_id": _as_text(req.equipment_id),
                },
                "created_at": now_iso,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="새 대화 세션 생성에 실패했습니다.")
    row = result.data[0]
    summary = _session_summary_from_row(row)
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
