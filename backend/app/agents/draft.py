from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.draft import APPLICATION_DRAFT_SYSTEM_PROMPT
from app.core.llm import llm
import json


def application_draft_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    roi_result = state.get("roi_result")
    draft_context = state.get("draft_context") or {}
    safety_management = draft_context.get("safety_management")

    # selected_policy 받기 (chat이든 routers/draft든 있음)
    selected_policy = state.get("selected_policy")
    if not selected_policy:
        selected_policy = "선택된 공고 없음"

    # draft_context에 정보 없으면 roi_result에서 추출
    if not draft_context.get("scenario_used") and roi_result:
        draft_context["scenario_used"] = roi_result.get("recommended", "a").lower()
        draft_context["scenario_label"] = f"{draft_context['scenario_used'].upper()}안 추천"

    # 프롬프트 구성
    prompt = APPLICATION_DRAFT_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company and company.industry_code else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.name if equipment else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        selected_policy=selected_policy,
        roi_result=roi_result if roi_result else "ROI 계산 결과 없음",
        safety_management=(
            json.dumps(safety_management, ensure_ascii=False)
            if safety_management
            else "안전점검 이력 데이터 없음"
        ),
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ])

    # JSON 파싱
    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        state["draft_result"] = result
        state["final_response"] = json.dumps(result, ensure_ascii=False)
    except:
        state["draft_result"] = response.content
        state["final_response"] = response.content

    return state

def generate_final_recommendation(
    *,
    company_name: str,
    equipment_name: str,
    payback_months: float,
    annual_benefit: float,
    investment: float,
    subsidy: float,
    policy_title: str,
    match_score: float,
    additional_info: str = "",
) -> str:
    """
    신청서 "종합 결론" 문단 생성
    회사 상황 + 정책 적합성 = 지원금 수혜 적격 논리로 마무리
    """
    investment_str = f"{round(investment):,}만원"
    subsidy_str = f"{round(subsidy):,}만원"
    benefit_str = f"{round(annual_benefit):,}만원"
    self_funding_str = f"{round(max(0, investment - subsidy)):,}만원"

    prompt = f"""
    신청서의 "종합 결론" 섹션을 작성해주세요.

    [기업 및 설비 현황]
    - 기업명: {company_name}
    - 대상 설비: {equipment_name}
    - 예상 회수기간: {payback_months:.1f}개월
    - 연간 편익: {benefit_str}

    [투자 계획]
    - 총 투자금: {investment_str}
    - 예상 지원금: {subsidy_str}
    - 자기부담금: {self_funding_str}

    [정책 정보]
    - 정책명: {policy_title}
    - 정책 적합도: {match_score:.1f}점

    [사용자 추가 의견]
    {additional_info if additional_info else "(추가 의견 없음)"}

    ===== 결론 작성 방향 =====

    다음과 같은 논리로 결론을 작성하세요:

    1. {company_name}은 {{설비 현황과 투자 필요성}}을 가지고 있습니다.
    2. {{설비 특성}}은 {{정책명}}의 지원 대상 조건(업종, 기업 규모, 지역)을 충족합니다.
    3. {{투자 규모 + 기대효과}}를 고려할 때, 본 사업은 정책 적합도 {match_score:.1f}점으로 평가됩니다.
    4. {{사용자 의견이 있으면 자연스럽게 포함}}
    5. 따라서 {{정책명}}의 지원금을 받기에 적합한 사업입니다.

    ===== 작성 요구사항 =====
    - 문체: 경어체, 전문적
    - 길이: 4~6문장
    - 톤: 신청서 최종 결론으로 적합한 격식
    - 결과: 자신감 있고 논리적인 결론
    """

    response = llm.invoke(prompt)
    return response.content.strip()