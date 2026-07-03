from app.state import FactofitState


def response_node(state: FactofitState) -> FactofitState:
    response = str(state.get("response") or state.get("final_response") or "").strip()
    cards = state.get("cards") if isinstance(state.get("cards"), list) else []

    metadata = {
        "answer_source": state.get("answer_source") or "database",
        "used_graph": True,
        "used_llm": bool(state.get("used_llm")),
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
