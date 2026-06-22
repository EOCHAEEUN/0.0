from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.draft import APPLICATION_DRAFT_SYSTEM_PROMPT
from app.core.llm import llm
from app.core.llm_security import UNTRUSTED_DATA_INSTRUCTION, serialize_untrusted
import json


def application_draft_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])
    roi_result = state.get("roi_result")

    # 매칭된 공고 중 첫 번째 선택 (가장 적합한 공고)
    selected_policy = matched_policies[0] if matched_policies else "선택된 공고 없음"

    # 프롬프트 구성
    prompt = UNTRUSTED_DATA_INSTRUCTION + "\n\n" + APPLICATION_DRAFT_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company and company.industry_code else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.name if equipment else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        selected_policy=serialize_untrusted(selected_policy),
        roi_result=serialize_untrusted(
            roi_result if roi_result else "ROI calculation result unavailable"
        )
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content="Generate the application draft from the supplied data.")
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
