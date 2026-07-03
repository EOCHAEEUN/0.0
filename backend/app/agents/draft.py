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
