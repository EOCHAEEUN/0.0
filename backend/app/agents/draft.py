from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.draft import APPLICATION_DRAFT_SYSTEM_PROMPT
from app.core.llm import llm_pro
from app.services.draft_content import normalize_llm_draft_payload
import json


def application_draft_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    roi_result = state.get("roi_result")
    draft_context = state.get("draft_context") or {}
    safety_management = draft_context.get("safety_management")
    must_include_text = draft_context.get("must_include_text")

    selected_policy = state.get("selected_policy")
    if not selected_policy:
        selected_policy = "선택된 공고 없음"
    elif isinstance(selected_policy, dict):
        selected_policy_text = json.dumps(selected_policy, ensure_ascii=False)
        selected_policy_title = (
            selected_policy.get("title")
            or selected_policy.get("policy_title")
            or "선택된 공고"
        )
    else:
        selected_policy_text = str(selected_policy)
        selected_policy_title = str(selected_policy)

    if not draft_context.get("scenario_used") and roi_result:
        draft_context["scenario_used"] = roi_result.get("recommended", "a").lower()
        draft_context["scenario_label"] = f"{draft_context['scenario_used'].upper()}안 추천"

    scenario_label = draft_context.get("scenario_label") or "추천 시나리오"
    company_name = company.company_name if company else "정보 없음"
    equipment_name = equipment.name if equipment else "정보 없음"

    prompt = APPLICATION_DRAFT_SYSTEM_PROMPT.format(
        company_name=company_name,
        equipment_name=equipment_name,
        selected_policy_title=selected_policy_title,
        industry_code=", ".join(company.industry_code) if company and company.industry_code else "정보 없음",
        region=company.region if company else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        scenario_label=scenario_label,
        selected_policy=selected_policy_text,
        roi_result=json.dumps(roi_result, ensure_ascii=False) if roi_result else "ROI 계산 결과 없음",
        safety_management=(
            json.dumps(safety_management, ensure_ascii=False)
            if safety_management
            else "안전점검 이력 데이터 없음"
        ),
        must_include_text=must_include_text or "사용자 추가 반영 요청 없음",
    )

    response = llm_pro.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ])

    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        state["draft_result"] = normalize_llm_draft_payload(
            result,
            company_name=company_name,
            equipment_name=equipment_name,
            policy_title=selected_policy_title,
        )
        state["final_response"] = json.dumps(state["draft_result"], ensure_ascii=False)
    except Exception:
        state["draft_result"] = response.content
        state["final_response"] = response.content

    return state
