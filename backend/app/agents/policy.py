from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.tools.vector_search import search_policies
from app.tools.deadline import sort_by_deadline, is_urgent
from app.core.llm import llm
from datetime import date


def match_policies(company_context: dict, query: str) -> list[dict]:
    industry_code = company_context.get("industry_code", [])
    if isinstance(industry_code, list):
        industry_code = ",".join(industry_code)

    region = company_context.get("region", "")
    region_short = region.split()[0] if region else ""

    policy_query = query
    print(f"=== policy_query ===: {policy_query}")

    results = search_policies(policy_query, n_results=20, where=None)
    print(f"=== search 결과 수 ===: {len(results)}")

    filtered = []
    for p in results:
        meta = p["metadata"]
        print(f"=== 정책 ===: {meta.get('title', '')} / region: {meta.get('region')} / industry_code: {meta.get('industry_code')}")
        # 업종 필터
        meta_code = meta.get("industry_code", "")
        codes = [c.strip() for c in meta_code.split(",")]
        code_match = (
            not industry_code
            or industry_code in codes
            or "C" in codes
        )

        # 지역 필터
        meta_region = meta.get("region", "")
        region_match = (
            not region              # 기업 지역 없으면 통과
            or not meta_region      # 전국 공고면 통과
            or region_short in meta_region  # 지역 일치하면 통과
            or "서울" in meta_region        # 중앙부처/스마트공장 계열 서울 공고 통과
            or "전국" in meta_region        # 전국 명시된 공고 통과
)

        # 기업유형 필터
        company_type = company_context.get("company_type", "")
        eligible_types = meta.get("eligible_company_types", [])
        type_match = (
            not eligible_types  # 정책의 eligible_company_types가 없으면 통과 (제한 없는 정책)
            or not company_type  # 기업의 company_type이 없으면 통과 (기업 정보 부족)
            or company_type in eligible_types  # 기업 유형이 정책 조건에 포함되면 통과
        )

        # 직원수 필터 (일단 주석처리)
        # employee_count = company_context.get("employee_count")
        # employee_min = meta.get("employee_min")
        # employee_max = meta.get("employee_max")
        # employee_match = (
        #     not employee_count
        #     or (employee_min is None or employee_count >= employee_min)
        #     and (employee_max is None or employee_count <= employee_max)
        # )

        # 매출 필터 (일단 주석처리)
        # annual_revenue = company_context.get("annual_revenue")
        # revenue_min = meta.get("revenue_min_manwon")
        # revenue_max = meta.get("revenue_max_manwon")
        # revenue_match = (
        #     not annual_revenue
        #     or (revenue_min is None or annual_revenue >= revenue_min)
        #     and (revenue_max is None or annual_revenue <= revenue_max)
        # )

        if code_match and region_match and type_match:
            filtered.append(p)

    return filtered[:10]


def policy_matching_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")

    company_context = {
        "industry_code": company.industry_code if company else None,
        "region": company.region if company else None,
        "company_type": company.company_type if company else None,
        # "employee_count": company.employee_count if company else None,
        # "annual_revenue": company.annual_revenue if company else None,
    }
    retrieved = match_policies(company_context, state["user_query"])

    today = date.today()
    valid_policies = [
        p for p in retrieved
        if p.get("metadata", {}).get("deadline", "9999-12-31") >= str(today)
    ]
    sorted_policies = sort_by_deadline(valid_policies)

    state["matched_policies"] = sorted_policies

    prompt = POLICY_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company else "정보 없음",
        region=company.region if company else "정보 없음",
        company_type=company.company_type if company else "정보 없음",
        employee_count=company.employee_count if company else "정보 없음",
        annual_revenue=company.annual_revenue or "정보 없음" if company else "정보 없음",
        equipment_info=equipment.equipment.name if equipment else "정보 없음",
        retrieved_policies=sorted_policies if sorted_policies else "검색된 공고 없음",
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ])

    import json
    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        
        response_text = result.get("response", "")
        print(f"=== response_text ===: {response_text}") 
        # LLM이 선택한 공고 + reason + llm_score 저장
        matched_ids_info = result.get("matched_policies", [])
        reason_map = {p["id"]: p for p in matched_ids_info}

        state["matched_policies"] = [
            {
                **p,
                "eligible": True,
                "reason": reason_map.get(p["id"], {}).get("reason", "RAG 유사도 기반 매칭"),
                "llm_score": reason_map.get(p["id"], {}).get("score", "")
            }
            for p in sorted_policies
            if p["id"] in reason_map
        ]

        prefix = ""
        if state.get("unsupported_equipment"):
            prefix = "현재 해당 설비의 ROI 계산은 지원하지 않지만, 관련 지원사업을 찾아드릴게요!\n\n"
        state["final_response"] = prefix + response_text

    except Exception as e:
        print(f"=== 파싱 에러 ===: {e}")
        state["final_response"] = response.content

    return state