from langgraph.graph import StateGraph, END
from app.state import FactofitState
from app.agents.guard import safety_node
from app.agents.router import router_node
from app.agents.info_collector import info_collector_node
from app.agents.capex import capex_advisor_node
from app.agents.policy import policy_matching_node
from app.agents.draft import application_draft_node
from app.agents.response import response_node


def build_graph():
    graph = StateGraph(FactofitState)

    # 노드 등록
    graph.add_node("guard_node", safety_node)
    graph.add_node("router_node", router_node)
    graph.add_node("info_collector_node", info_collector_node)
    graph.add_node("capex_advisor_node", capex_advisor_node)
    graph.add_node("policy_matching_node", policy_matching_node)
    graph.add_node("application_draft_node", application_draft_node)
    graph.add_node("response_node", response_node)

    # 엣지 연결
    graph.set_entry_point("guard_node")

    # guard_node → is_safe 여부에 따라 분기
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
            "policy": "policy_matching_node",
            "calendar": "policy_matching_node",
            "draft": "application_draft_node",
            "info_missing": "info_collector_node",
            "general": "response_node",
        }
    )

    # info_collector_node → 정보 다 모였으면 router로, 아니면 END
    graph.add_conditional_edges(
    "info_collector_node",
    lambda state: "router_node" if state["final_response"] == "" else "__end__",
    {"router_node": "router_node", "__end__": END}
    )

    # 각 specialist → response_node
    graph.add_edge("capex_advisor_node", "response_node")
    graph.add_edge("policy_matching_node", "response_node")
    graph.add_edge("application_draft_node", "response_node")

    # response_node → END
    graph.add_edge("response_node", END)

    return graph.compile()

factofit_graph = build_graph()
