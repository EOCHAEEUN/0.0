from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.tools.vector_search import search_policies
from app.tools.deadline import sort_by_deadline, is_urgent
from app.core.llm import llm
from datetime import date


def match_policies(company_context: dict, query: str) -> list[dict]:
    """
    기업 컨텍스트(업종코드, 지역 등)를 고려한 지원사업 매칭

    Args:
        company_context: 기업 정보 (industry_code, region 등)
        query: 사용자 검색 쿼리

    Returns:
        매칭된 공고 리스트 (RAG 유사도 기반 정렬)
    """
    where_filters = []

    # 업종코드 필터 (optional)
    if company_context.get("industry_code"):
        where_filters.append({
            "industry_codes": {"$contains": company_context["industry_code"]}
        })

    # 지역 필터 — 전국 공고(region="") 또는 해당 지역 포함 공고
    if company_context.get("region"):
        where_filters.append({
            "$or": [
                {"region": ""},
                {"region": {"$contains": company_context["region"]}}
            ]
        })

    if len(where_filters) == 0:
        where = None
    elif len(where_filters) == 1:
        where = where_filters[0]
    else:
        where = {"$and": where_filters}

    return search_policies(query, n_results=10, where=where)


def policy_matching_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")

    # match_policies로 RAG 검색 + 업종·지역 필터
    company_context = {
        "industry_code": company.industry_code if company else None,
        "region": company.region if company else None,
    }
    retrieved = match_policies(company_context, state["user_query"])

    # 마감 지난 공고 제거 + 마감일 기준 정렬
    today = date.today()
    valid_policies = [
        p for p in retrieved
        if p.get("metadata", {}).get("deadline", "9999-12-31") >= str(today)
    ]
    sorted_policies = sort_by_deadline(valid_policies)

    state["matched_policies"] = sorted_policies

    # 프롬프트 구성
    prompt = POLICY_SYSTEM_PROMPT.format(
        industry_codes=company.industry_code if company else "정보 없음",
        region=company.region if company else "정보 없음",
        employee_count=company.employee_count if company else "정보 없음",
        annual_revenue=company.annual_revenue or "정보 없음" if company else "정보 없음",
        equipment_info=equipment.equipment.name if equipment else "정보 없음",
        retrieved_policies=sorted_policies if sorted_policies else "검색된 공고 없음",
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ])

    state["final_response"] = response.content
    return state
