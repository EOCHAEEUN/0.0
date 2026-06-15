from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.draft import APPLICATION_DRAFT_SYSTEM_PROMPT
from app.core.llm import llm


def application_draft_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])
    roi_result = state.get("roi_result")

    # 매칭된 공고 중 첫 번째 선택 (가장 적합한 공고)
    selected_policy = matched_policies[0] if matched_policies else "선택된 공고 없음"

    # 프롬프트 구성
    prompt = APPLICATION_DRAFT_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company and company.industry_code else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.name if equipment else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        selected_policy=selected_policy,
        roi_result=roi_result if roi_result else "ROI 계산 결과 없음"
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ])

    # State에 draft_result 저장
    state["draft_result"] = response.content
    state["final_response"] = response.content
    return state
