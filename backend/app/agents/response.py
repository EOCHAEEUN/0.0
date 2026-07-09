import json

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import llm_advanced
from app.state import FactofitState


ADVANCED_INTENTS = {"roi", "policy", "draft", "safety"}


def _should_use_advanced(state: FactofitState, response: str) -> bool:
    intent = str(state.get("intent") or "").strip().lower()
    answer_source = str(state.get("answer_source") or "").strip().lower()
    if intent not in ADVANCED_INTENTS:
        return False
    if answer_source in {"missing_data", "db_error", "conversation", "reanalysis"}:
        return False
    return len(response) >= 40


def _render_with_advanced(state: FactofitState, response: str) -> str:
    cards = state.get("cards") if isinstance(state.get("cards"), list) else []
    facts_payload = {
        "intent": state.get("intent") or "response",
        "response_text": response,
        "cards": cards,
    }
    prompt = """
당신은 제조업 AI Advisor 응답을 문장만 다듬는 편집기입니다.
반드시 아래 제약을 지키세요.

제약:
1) 제공된 사실(Facts)만 사용
2) 숫자(ROI, 지원금, 실부담금, 회수기간) 절대 변경 금지
3) 정책명/설비명 절대 변경 금지
4) 새로운 사실/추정/권고를 추가하지 말 것
5) 출력은 한국어 최종 답변 본문 텍스트만 반환 (JSON 금지)
"""
    messages = [
        SystemMessage(content=prompt.strip()),
        HumanMessage(content=f"Facts:\n{json.dumps(facts_payload, ensure_ascii=False)}"),
    ]
    try:
        rewritten = llm_advanced.invoke(messages).content
        text = str(rewritten or "").strip()
        return text or response
    except Exception:
        return response


def response_node(state: FactofitState) -> FactofitState:
    response = str(state.get("response") or state.get("final_response") or "").strip()
    cards = state.get("cards") if isinstance(state.get("cards"), list) else []
    used_advanced = False

    if response and _should_use_advanced(state, response):
        rewritten = _render_with_advanced(state, response)
        used_advanced = rewritten != response
        response = rewritten

    metadata = {
        "answer_source": state.get("answer_source") or "database",
        "used_graph": True,
        "used_llm": bool(state.get("used_llm")) or used_advanced,
        "used_llm_advanced": used_advanced,
        "used_roi_recalculation": bool(state.get("used_roi_recalculation")),
        "used_policy_matching": bool(state.get("used_policy_matching")),
        "action": state.get("action") or "",
        "analysis_id": state.get("analysis_id") or "",
        "policy_id": state.get("policy_id") or "",
        "session_id": state.get("session_id") or "",
        "persistence_status": state.get("persistence_status") or "pending",
        "route": state.get("route") or "",
    }

    state["response"] = response
    state["final_response"] = response
    state["cards"] = cards
    state["metadata"] = metadata
    state["intent"] = state.get("intent") or "response"
    return state
