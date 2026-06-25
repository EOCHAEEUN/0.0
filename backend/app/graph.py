# app/graph.py
from langgraph.graph import StateGraph, END
from app.state import FactofitState
from app.agents.guard import guard_node
from app.agents.router import router_node
from app.agents.info_collector import info_collector_node
from app.agents.capex import capex_advisor_node
from app.agents.policy import policy_chat_node
from app.agents.draft import application_draft_node
from app.agents.response import response_node
from app.agents.equipment_safety import equipment_safety_node

def build_graph():
    graph = StateGraph(FactofitState)

    graph.add_node("guard_node", guard_node)
    graph.add_node("router_node", router_node)
    graph.add_node("info_collector_node", info_collector_node)
    graph.add_node("capex_advisor_node", capex_advisor_node)
    graph.add_node("policy_chat_node", policy_chat_node)
    graph.add_node("application_draft_node", application_draft_node)
    graph.add_node("equipment_safety_node", equipment_safety_node)
    graph.add_node("response_node", response_node)

    graph.set_entry_point("guard_node")

    graph.add_conditional_edges(
        "guard_node",
        lambda state: "router_node" if state["is_safe"] else "__end__",
        {"router_node": "router_node", "__end__": END}
    )

    # router_node → intent에 따라 분기
    graph.add_conditional_edges(
        "router_node",
        lambda state: state["intent"],
        {
            "roi": "capex_advisor_node",
            "policy": "policy_chat_node",
            "calendar": "policy_chat_node",
            "safety": "equipment_safety_node",
            "draft": "application_draft_node",
            "info_missing": "info_collector_node",
            "general": "response_node"
        }
    )

    # info_collector_node → 설비 선택 후 분기
    graph.add_conditional_edges(
        "info_collector_node",
        lambda state: state["intent"] if state["final_response"] == "" else "__end__",
        {
            "roi": "capex_advisor_node",
            "policy": "policy_chat_node",
            "calendar": "policy_chat_node",
            "safety": "equipment_safety_node",
            "__end__": END
        }
    )

    graph.add_edge("capex_advisor_node", "response_node")
    graph.add_conditional_edges(
        "policy_chat_node",
        lambda state: state["intent"],
        {
            "draft": "application_draft_node",
            "general": "response_node",
            "policy": "response_node",
            "calendar": "response_node",
        }
    )
    graph.add_edge("application_draft_node", "response_node")
    graph.add_edge("equipment_safety_node", "response_node")

    graph.add_edge("response_node", END)

    return graph.compile()

factofit_graph = build_graph()
