from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.tools.vector_search import search_policies
from app.tools.deadline import sort_by_deadline, is_urgent
from app.core.llm import llm
from datetime import date


def match_policies(company_context: dict, query: str) -> list[dict]:
    industry_code = company_context.get("industry_code", "")
    if isinstance(industry_code, list):
        industry_code = ",".join(industry_code)
    
    region = company_context.get("region", "")
    region_short = region.split()[0] if region else ""  # "경기도 안산시" → "경기도"

    # ChromaDB에서 필터 없이 많이 가져옴
    results = search_policies(query, n_results=20, where=None)

    # 코드로 필터링
    filtered = []
    for p in results:
        meta = p["metadata"]
        
        # 업종 필터
        code_match = (
            not industry_code  # 업종 없으면 통과
            or industry_code in meta.get("industry_code", "")  # C24 포함
            or industry_code[:1] in meta.get("industry_code", "")  # C 포함
        )
        
        # 지역 필터
        region_match = (
            not region  # 지역 없으면 통과
            or not meta.get("region")  # 전국 공고
            or region_short in meta.get("region", "")  # 경기도 포함
        )
        
        if code_match and region_match:
            filtered.append(p)

    print("=== retrieved ===")
    print(filtered[:10])
    return filtered[:10]


def policy_matching_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")

    # match_policies로 RAG 검색 + 업종·지역 필터
    company_context = {
        "industry_code": company.industry_code if company else None,
        "region": company.region if company else None,
    }
    retrieved = match_policies(company_context, state["user_query"])
    print("=== retrieved ===")
    print(retrieved)

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
        industry_code=", ".join(company.industry_code) if company and isinstance(company.industry_code, list) else company.industry_code if company else "정보 없음",
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

    # JSON 파싱
    import json
    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        
        response_text = result.get("response", "")
        
        # LLM이 선택한 공고만 matched_policies에 저장
        matched_ids = result.get("matched_policy_ids", [])
        state["matched_policies"] = [
            p for p in sorted_policies
            if p["id"] in matched_ids
        ]
    except:
        response_text = response.content

    prefix = ""
    if state.get("unsupported_equipment"):
        prefix = "현재 해당 설비의 ROI 계산은 지원하지 않지만, 관련 지원사업을 찾아드릴게요!\n\n"

    state["final_response"] = prefix + response_text

    return state
