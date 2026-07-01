import os
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException

from app.core.database import get_db
from app.graph import factofit_graph
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput

EXPLICIT_DB_ACTIONS = {
    "roi_detail",
    "roi_compare",
    "matched_policies",
    "policy_calendar",
    "application_draft_status",
    "safety_status",
    "current_analysis_summary",
}
EXPLICIT_SIMULATION_ACTIONS = {"investment_simulation"}
EXPLICIT_NEW_ANALYSIS_ACTIONS = {"start_analysis", "new_analysis", "roi_analyze"}


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
    if client[: len(server)] == server:
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


def _load_company_context(company_id: str):
    company_data = _load_company_row(company_id)
    if not company_data.data:
        return None
    data = _as_dict(company_data.data[0])
    industry_code = data.get("industry_code")
    if isinstance(industry_code, str):
        industry_code = [code.strip() for code in industry_code.split(",") if code.strip()]
    return CompanyContext(
        company_id=data.get("company_id"),
        company_name=data.get("company_name", ""),
        business_registration_no=data.get("business_registration_no"),
        industry_name=data.get("industry_name"),
        industry_code=industry_code or [],
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


def _load_company_equipments(company_id: str):
    result = (
        get_db()
        .table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .execute()
    )
    return result.data or []


def _build_equipment_input(equipment_row: dict):
    return EquipmentInput(
        name=equipment_row.get("name", ""),
        category=equipment_row.get("category", ""),
        age_years=equipment_row.get("age_years", 0),
        energy_cost_annual=equipment_row.get("energy_cost_annual", 0),
        defect_rate=equipment_row.get("defect_rate"),
        maintenance_cost_annual=equipment_row.get("maintenance_cost_annual"),
        current_capacity_value=equipment_row.get("current_capacity_value"),
        production_qty=equipment_row.get("production_qty"),
        process=equipment_row.get("process"),
        contribution_margin_won=equipment_row.get("contribution_margin_won"),
        scenario_a_investment_manwon=equipment_row.get("scenario_a_investment_manwon"),
        scenario_b_investment_manwon=equipment_row.get("scenario_b_investment_manwon"),
    )


def _resolve_equipment_from_analysis(company_id: str, analysis_id: str):
    result = (
        get_db()
        .table("roi_output")
        .select("id,company_id,equipment_id")
        .eq("id", analysis_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return ""
    return _as_text(_as_dict(result.data[0]).get("equipment_id"))


def _ensure_company_owner(company_id: str, current_user_id: str):
    company = (
        get_db()
        .table("company")
        .select("company_id,user_id")
        .eq("company_id", company_id)
        .eq("user_id", current_user_id)
        .limit(1)
        .execute()
    )
    if not company.data:
        raise HTTPException(status_code=403, detail="해당 기업 대화 내역 접근 권한이 없습니다.")


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
    preview = _as_text(_as_dict(last_message).get("content")) or _as_text(item.get("final_response")) or "(미리보기 없음)"
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


def _is_dev_mode() -> bool:
    env = _as_text(os.getenv("APP_ENV") or os.getenv("ENV") or os.getenv("FASTAPI_ENV")).lower()
    if not env:
        return True
    return env not in {"prod", "production"}


def _latest_analysis_id(company_id: str) -> str:
    result = (
        get_db()
        .table("roi_output")
        .select("id")
        .eq("company_id", company_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return ""
    return _as_text(_as_dict(result.data[0]).get("id"))


def _upsert_session(
    *,
    company_id: str,
    session_id: str,
    analysis_id: str,
    equipment_id: str,
    intent: str,
    user_message: str,
    assistant_message: str,
    server_history: list[dict],
    client_history: list[dict],
):
    db = get_db()
    existing_row = _get_session_row(company_id, session_id)
    base_history = _merge_histories(server_history, client_history)
    history = _normalize_chat_history(base_history)
    now_iso = datetime.now().isoformat()
    history.append({"role": "user", "content": user_message, "created_at": now_iso})
    history.append({"role": "assistant", "content": assistant_message, "created_at": datetime.now().isoformat()})
    title = ""
    for item in history:
        if item.get("role") == "user":
            title = _as_text(item.get("content"))[:64]
            if title:
                break
    if not title:
        title = "새 대화"
    payload = {
        "company_id": company_id,
        "chat_id": session_id,
        "intent": intent,
        "user_query": title,
        "final_response": assistant_message,
        "chat_history": history[-80:],
        "roi_result": {"analysis_id": analysis_id, "equipment_id": equipment_id},
        "created_at": datetime.now().isoformat(),
    }
    if existing_row.data:
        db.table("chat_history").update(payload).eq("company_id", company_id).eq("chat_id", session_id).execute()
        return True
    db.table("chat_history").insert(payload).execute()
    return True


class AdvisorChatService:
    @staticmethod
    def ensure_company_owner(company_id: str, current_user_id: str):
        _ensure_company_owner(company_id, current_user_id)

    @staticmethod
    def list_sessions(company_id: str, limit: int):
        return _list_sessions(company_id, limit)

    @staticmethod
    def get_session(company_id: str, session_id: str):
        row = _get_session_row(company_id, session_id)
        if not row.data:
            raise HTTPException(status_code=404, detail="대화 내역을 찾을 수 없습니다.")
        item = _as_dict(row.data[0])
        history = _normalize_chat_history(item.get("chat_history") if isinstance(item.get("chat_history"), list) else [])
        summary = _session_summary_from_row(item)
        return {
            "session_id": summary["session_id"],
            "chat_id": summary["chat_id"],
            "title": summary["title"],
            "preview": summary["preview"],
            "analysis_id": summary["analysis_id"],
            "updated_at": summary["updated_at"],
            "created_at": summary["created_at"],
            "messages": history,
        }

    @staticmethod
    def create_session(company_id: str, analysis_id: str = "", equipment_id: str = ""):
        session_id = _safe_session_id()
        now_iso = datetime.now().isoformat()
        result = (
            get_db()
            .table("chat_history")
            .insert(
                {
                    "chat_id": session_id,
                    "company_id": company_id,
                    "intent": "response",
                    "user_query": "새 대화",
                    "final_response": "",
                    "chat_history": [],
                    "roi_result": {"analysis_id": _as_text(analysis_id), "equipment_id": _as_text(equipment_id)},
                    "created_at": now_iso,
                }
            )
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=500, detail="새 대화 세션 생성에 실패했습니다.")
        return _session_summary_from_row(result.data[0])

    @staticmethod
    async def handle_chat(req):
        try:
            if not req.company_id:
                return {"intent": "response", "response": "로그인 후 이용하실 수 있습니다.", "cards": [], "next_questions": [], "chat_id": "", "session_id": ""}

            requested_session_id = _as_text(req.session_id) or _as_text(req.chat_id)
            session_row = None
            server_history = []
            if requested_session_id:
                session_row = _get_session_row(req.company_id, requested_session_id)
                if not session_row.data:
                    raise HTTPException(status_code=404, detail="선택한 대화 세션을 찾을 수 없습니다.")
                server_history = _as_dict(session_row.data[0]).get("chat_history") or []

            session_id = _safe_session_id(requested_session_id)
            action = _as_text(req.action).lower()
            analysis_id = _as_text(req.analysis_id)
            if not analysis_id and requested_session_id and session_row and session_row.data:
                analysis_id = _as_text(_as_dict(_as_dict(session_row.data[0]).get("roi_result")).get("analysis_id"))
            if not analysis_id and action in (EXPLICIT_DB_ACTIONS | EXPLICIT_SIMULATION_ACTIONS):
                analysis_id = _latest_analysis_id(req.company_id)
            company_info = _load_company_context(req.company_id)
            equipments = _load_company_equipments(req.company_id)
            requested_equipment_id = _as_text(req.selected_equipment_id)
            if analysis_id and not requested_equipment_id:
                requested_equipment_id = _resolve_equipment_from_analysis(req.company_id, analysis_id)
            selected_equipment = next(
                (item for item in equipments if _as_text(item.get("equipment_id")) == requested_equipment_id),
                None,
            ) if requested_equipment_id else None
            selected_equipment_input = _build_equipment_input(selected_equipment) if selected_equipment else None
            selected_equipment_name = _as_text((selected_equipment or {}).get("name"))

            initial_state = {
                "user_query": req.message,
                "message": req.message,
                "action": action,
                "source": _as_text(req.source),
                "intent": "response",
                "is_safe": True,
                "company_id": req.company_id,
                "analysis_id": analysis_id,
                "session_id": session_id,
                "chat_id": session_id,
                "company_info": company_info,
                "company_equipments": equipments,
                "equipment": selected_equipment_input,
                "equipment_id": _as_text((selected_equipment or {}).get("equipment_id")) or None,
                "selected_equipment_id": requested_equipment_id or None,
                "policy_intent_choice": _as_text(req.policy_intent_choice) or None,
                "selected_equipment_for_policy": selected_equipment_name or None,
                "policy_id": _as_text(getattr(req, "policy_id", "")),
                "simulation_input": _as_dict(getattr(req, "simulation_input", None)),
                "matched_policies": [],
                "selected_policy": None,
                "roi_result": None,
                "draft_result": None,
                "draft_context": None,
                "chat_history": _merge_histories(server_history, req.chat_history),
                "final_response": "",
                "response": "",
                "cards": [],
                "unsupported_equipment": False,
                "safety_dashboard": None,
                "options": None,
                "used_graph": True,
                "used_llm": False,
                "used_roi_recalculation": False,
                "used_policy_matching": False,
                "persistence_status": "pending",
            }
            graph_result = await factofit_graph.ainvoke(initial_state)

            response_text = _as_text(graph_result.get("response") or graph_result.get("final_response"))
            cards = graph_result.get("cards") if isinstance(graph_result.get("cards"), list) else []
            intent_value = _as_text(graph_result.get("intent")) or "response"
            resolved_analysis_id = _as_text(graph_result.get("analysis_id")) or analysis_id
            resolved_equipment_id = _as_text(graph_result.get("equipment_id")) or _as_text((selected_equipment or {}).get("equipment_id"))
            metadata = _as_dict(graph_result.get("metadata"))

            persisted = _upsert_session(
                company_id=req.company_id,
                session_id=session_id,
                analysis_id=resolved_analysis_id,
                equipment_id=resolved_equipment_id,
                intent=intent_value,
                user_message=req.message,
                assistant_message=response_text,
                server_history=server_history,
                client_history=req.chat_history,
            )
            persistence_status = "success" if persisted else "failed"
            metadata["persistence_status"] = persistence_status
            metadata["session_id"] = session_id
            metadata["analysis_id"] = resolved_analysis_id
            if "used_graph" not in metadata:
                metadata["used_graph"] = True

            payload = {
                "intent": intent_value,
                "action": action,
                "response": response_text,
                "cards": cards,
                "next_questions": [],
                "chat_id": session_id,
                "session_id": session_id,
                "resolved_equipment_id": resolved_equipment_id,
                "analysis_id": resolved_analysis_id,
                "metadata": metadata,
            }
            return payload
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ 채팅 에러: {e}")
            import traceback
            traceback.print_exc()
            return {"intent": "response", "response": f"에러 발생: {str(e)}", "cards": [], "next_questions": [], "chat_id": "", "session_id": ""}
