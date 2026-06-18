from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.draft import APPLICATION_DRAFT_SYSTEM_PROMPT
from app.core.llm import llm
import json


def _json_dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, default=str, indent=2)


def application_draft_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])
    roi_result = state.get("roi_result")
    draft_context = state.get("draft_context", {})

    selected_policy = matched_policies[0] if matched_policies else {}
    if not isinstance(selected_policy, dict):
        selected_policy = {}

    scenario_used = draft_context.get("scenario_used", "")
    scenario_label = draft_context.get("scenario_label", "")
    policy_title = selected_policy.get("title") or selected_policy.get("policy_title") or ""
    policy_reason = selected_policy.get("reason") or ""
    match_score = selected_policy.get("match_score")

    prompt = APPLICATION_DRAFT_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company and company.industry_code else "정보 없음",
        company_name=company.company_name if company else "정보 없음",
        company_type=company.company_type if company else "정보 없음",
        annual_revenue=company.annual_revenue if company else "정보 없음",
        employee_count=company.employee_count if company else "정보 없음",
        primary_purpose=", ".join(company.primary_purpose) if company and company.primary_purpose else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.name if equipment else "정보 없음",
        equipment_category=equipment.category if equipment else "정보 없음",
        equipment_process=equipment.process if equipment else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        energy_cost_annual=equipment.energy_cost_annual if equipment else "정보 없음",
        defect_rate=equipment.defect_rate if equipment else "정보 없음",
        maintenance_cost_annual=equipment.maintenance_cost_annual if equipment else "정보 없음",
        selected_policy=_json_dumps(selected_policy) if selected_policy else "선택된 공고 없음",
        policy_title=policy_title or "정보 없음",
        policy_reason=policy_reason or "정보 없음",
        match_score=match_score if match_score is not None else "정보 없음",
        scenario_used=scenario_used or "정보 없음",
        scenario_label=scenario_label or "정보 없음",
        roi_result=_json_dumps(roi_result) if roi_result else "ROI 계산 결과 없음",
    )

    response = llm.invoke([
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
        state["draft_result"] = result
        state["final_response"] = json.dumps(result, ensure_ascii=False)
    except Exception:
        state["draft_result"] = {"content": response.content}
        state["final_response"] = response.content

    return state
