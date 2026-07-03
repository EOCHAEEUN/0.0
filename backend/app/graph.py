from langgraph.graph import END, StateGraph

from app.agents.chat_orchestrator import (
    analysis_snapshot_loader_node,
    calendar_snapshot_node,
    conversation_fallback_node,
    current_analysis_summary_node,
    db_error_node,
    draft_status_node,
    entry_dispatch_node,
    equipment_selection_node,
    explicit_action_dispatch_node,
    investment_simulation_node,
    missing_data_node,
    new_analysis_node,
    policy_discovery_node,
    policy_snapshot_node,
    reanalysis_request_node,
    roi_snapshot_node,
    safety_preview_generation_node,
    safety_snapshot_node,
)
from app.agents.guard import guard_node
from app.agents.response import response_node
from app.state import FactofitState


def build_graph():
    graph = StateGraph(FactofitState)

    graph.add_node("guard_node", guard_node)
    graph.add_node("entry_dispatch_node", entry_dispatch_node)
    graph.add_node("explicit_action_dispatch_node", explicit_action_dispatch_node)
    graph.add_node("analysis_snapshot_loader_node", analysis_snapshot_loader_node)
    graph.add_node("roi_snapshot_node", roi_snapshot_node)
    graph.add_node("policy_snapshot_node", policy_snapshot_node)
    graph.add_node("calendar_snapshot_node", calendar_snapshot_node)
    graph.add_node("draft_status_node", draft_status_node)
    graph.add_node("safety_snapshot_node", safety_snapshot_node)
    graph.add_node("safety_preview_generation_node", safety_preview_generation_node)
    graph.add_node("investment_simulation_node", investment_simulation_node)
    graph.add_node("reanalysis_request_node", reanalysis_request_node)
    graph.add_node("equipment_selection_node", equipment_selection_node)
    graph.add_node("new_analysis_node", new_analysis_node)
    graph.add_node("policy_discovery_node", policy_discovery_node)
    graph.add_node("missing_data_node", missing_data_node)
    graph.add_node("db_error_node", db_error_node)
    graph.add_node("conversation_fallback_node", conversation_fallback_node)
    graph.add_node("current_analysis_summary_node", current_analysis_summary_node)
    graph.add_node("response_node", response_node)

    graph.set_entry_point("guard_node")

    graph.add_conditional_edges(
        "guard_node",
        lambda state: "entry_dispatch_node" if state.get("is_safe", True) else "response_node",
        {
            "entry_dispatch_node": "entry_dispatch_node",
            "response_node": "response_node",
        },
    )

    graph.add_conditional_edges(
        "entry_dispatch_node",
        lambda state: state.get("route", "db_error"),
        {
            "explicit_action": "explicit_action_dispatch_node",
            "roi_snapshot": "analysis_snapshot_loader_node",
            "policy_snapshot": "analysis_snapshot_loader_node",
            "calendar_snapshot": "analysis_snapshot_loader_node",
            "draft_status": "analysis_snapshot_loader_node",
            "safety_snapshot": "analysis_snapshot_loader_node",
            "safety_preview_generation": "analysis_snapshot_loader_node",
            "investment_simulation": "analysis_snapshot_loader_node",
            "reanalysis_request": "analysis_snapshot_loader_node",
            "current_analysis_summary": "analysis_snapshot_loader_node",
            "new_analysis": "new_analysis_node",
            "equipment_selection": "equipment_selection_node",
            "policy_discovery": "policy_discovery_node",
            "missing_data": "missing_data_node",
            "db_error": "db_error_node",
            "conversation_fallback": "conversation_fallback_node",
        },
    )

    graph.add_conditional_edges(
        "explicit_action_dispatch_node",
        lambda state: state.get("route", "db_error"),
        {
            "roi_snapshot": "analysis_snapshot_loader_node",
            "policy_snapshot": "analysis_snapshot_loader_node",
            "calendar_snapshot": "analysis_snapshot_loader_node",
            "draft_status": "analysis_snapshot_loader_node",
            "safety_snapshot": "analysis_snapshot_loader_node",
            "investment_simulation": "analysis_snapshot_loader_node",
            "current_analysis_summary": "analysis_snapshot_loader_node",
            "db_error": "db_error_node",
        },
    )

    graph.add_conditional_edges(
        "analysis_snapshot_loader_node",
        lambda state: state.get("route", "db_error"),
        {
            "roi_snapshot": "roi_snapshot_node",
            "policy_snapshot": "policy_snapshot_node",
            "calendar_snapshot": "calendar_snapshot_node",
            "draft_status": "draft_status_node",
            "safety_snapshot": "safety_snapshot_node",
            "safety_preview_generation": "safety_preview_generation_node",
            "investment_simulation": "investment_simulation_node",
            "reanalysis_request": "reanalysis_request_node",
            "current_analysis_summary": "current_analysis_summary_node",
            "missing_data": "missing_data_node",
            "db_error": "db_error_node",
        },
    )

    for node in (
        "roi_snapshot_node",
        "policy_snapshot_node",
        "calendar_snapshot_node",
        "draft_status_node",
        "safety_snapshot_node",
        "safety_preview_generation_node",
        "investment_simulation_node",
        "reanalysis_request_node",
        "equipment_selection_node",
        "new_analysis_node",
        "policy_discovery_node",
        "missing_data_node",
        "db_error_node",
        "conversation_fallback_node",
        "current_analysis_summary_node",
    ):
        graph.add_edge(node, "response_node")

    graph.add_edge("response_node", END)
    return graph.compile()


factofit_graph = build_graph()