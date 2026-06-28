from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.draft import APPLICATION_DRAFT_SYSTEM_PROMPT
from app.core.llm import llm
import json


def application_draft_node(state: FactofitState) -> FactofitState:
    if not state.get("selected_equipment_for_policy"):
        state["final_response"] = "계획서 초안 작성에는 등록된 설비 정보가 필요합니다. 설비를 등록해주세요."
        state["intent"] = "response"
        return state
    
    # 추가 텍스트 가공
    additional_text = state.get("additional_text_for_draft")
    if additional_text:
        refined_text = refine_additional_text(additional_text)
        state["additional_text_for_draft"] = refined_text
    
    equipment = state.get("equipment")
    company = state.get("company_info")
    roi_result = state.get("roi_result")
    draft_context = state.get("draft_context") or {}
    safety_management = (
        draft_context.get("safety_improvement")
        or draft_context.get("safety_management")
    )

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

def refine_additional_text(raw_text: str) -> str:
    """
    사용자 입력 문장을 신청서에 적합하도록 가공
    """
    prompt = f"""
    사용자가 다음 문장을 신청서에 추가하고 싶어합니다:
    "{raw_text}"
    
    이 문장을 신청서에 적합하도록 다듬어주세요.
    - 자연스러운 한국어
    - 존댓말 유지
    - 핵심 의도 보존
    - 200자 이내
    
    다듬은 문장만 반환하세요.
    """

    from langchain_core.messages import SystemMessage
    response = llm.invoke([SystemMessage(content=prompt)])
    return response.content