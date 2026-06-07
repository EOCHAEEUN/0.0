from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.tools.vector_search import search_policies
from app.tools.deadline import sort_by_deadline, is_urgent
from app.core.llm import llm
from datetime import date


def policy_matching_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")

    # 업종 + 지역 필터로 RAG 검색
    where_filter = {}
    if company and company.industry_code:
        where_filter["industry_code"] = company.industry_code

    retrieved = search_policies(
        query=state["user_query"],
        n_results=10,
        where=where_filter if where_filter else None
    )

    # 마감일 기준 정렬 + 마감 지난 공고 제거
    today = date.today()
    valid_policies = [
        p for p in retrieved
        if p.get("metadata", {}).get("deadline", "9999-12-31") >= str(today)
    ]
    sorted_policies = sort_by_deadline(valid_policies)

    # State에 matched_policies 저장
    state["matched_policies"] = sorted_policies

    # 프롬프트 구성
    prompt = POLICY_SYSTEM_PROMPT.format(
        industry_code=company.industry_code if company else "정보 없음",
        region=company.region if company else "정보 없음",
        employee_count=company.employee_count if company else "정보 없음",
        equipment_info=equipment.equipment.name if equipment else "정보 없음",
        retrieved_policies=sorted_policies if sorted_policies else "검색된 공고 없음"
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ])

    state["final_response"] = response.content
    return state
