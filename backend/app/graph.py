from langgraph.graph import StateGraph, END
from app.state import FactofitState
from app.agents.guard import safety_node
from app.agents.router import router_node

# TODO: 노드 완성되면 아래 주석 해제
# from app.agents.info_collector import info_collector_node
# from app.agents.capex import capex_advisor_node
# from app.agents.policy import policy_matching_node
# from app.agents.application_draft import application_draft_node
# from app.agents.response import response_node

def build_graph():
    graph = StateGraph(FactofitState)

    # 노드 등록
    graph.add_node("guard_node", safety_node)
    graph.add_node("router_node", router_node)

    # TODO: 노드 완성되면 아래 주석 해제
    # graph.add_node("info_collector_node", info_collector_node)
    # graph.add_node("capex_advisor_node", capex_advisor_node)
    # graph.add_node("policy_matching_node", policy_matching_node)
    # graph.add_node("application_draft_node", application_draft_node)
    # graph.add_node("response_node", response_node)

    # 엣지 연결
    graph.set_entry_point("guard_node")

    # guard_node → is_safe 여부에 따라 분기
    graph.add_conditional_edges(
        "guard_node",
        lambda state: "router_node" if state["is_safe"] else END
    )

    # router_node → intent에 따라 분기 (TODO: 노드 완성되면 수정)
    graph.add_conditional_edges(
        "router_node",
        lambda state: state["intent"],
        {
            "investment_advice": END,    # TODO: "capex_advisor_node"로 변경
            "subsidy_search": END,       # TODO: "policy_matching_node"로 변경
            "application_help": END,     # TODO: "application_draft_node"로 변경
            "info_missing": END,         # TODO: "info_collector_node"로 변경
        }
    )

    return graph.compile()

factofit_graph = build_graph()
