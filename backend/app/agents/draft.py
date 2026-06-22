import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import llm
from app.core.llm_security import UNTRUSTED_DATA_INSTRUCTION, serialize_untrusted
from app.prompts.draft import APPLICATION_DRAFT_SYSTEM_PROMPT
from app.state import FactofitState


LLM_DRAFT_TIMEOUT_SECONDS = 8


def _get_attr(value, key, default=None):
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _number(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _make_fallback_draft(state: FactofitState) -> dict:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])
    roi_result = state.get("roi_result") or {}
    draft_context = state.get("draft_context") or {}
    selected_policy = matched_policies[0] if matched_policies else {}

    company_name = _get_attr(company, "company_name") or "기업명 미입력"
    equipment_name = _get_attr(equipment, "name") or "설비명 미입력"
    policy_title = (
        _get_attr(selected_policy, "title")
        or _get_attr(selected_policy, "policy_title")
        or "추천 지원사업 미선택"
    )
    scenario_label = draft_context.get("scenario_label") or _get_attr(
        selected_policy,
        "scenario_label",
        "A안 전체교체 적합",
    )

    breakdown = roi_result.get("breakdown") if isinstance(roi_result, dict) else {}
    breakdown = breakdown or {}
    investment = _number(roi_result.get("investment_manwon"), None)
    subsidy = _number(roi_result.get("subsidy_manwon"), None)
    payback_years = _number(roi_result.get("payback_years"), None)
    payback_months = round(payback_years * 12, 1) if payback_years is not None else None

    energy = _number(breakdown.get("energy_saving_manwon"))
    maintenance = _number(breakdown.get("maintenance_saving_manwon"))
    defect = _number(breakdown.get("defect_saving_manwon"))

    expected_benefits = [
        f"연간 에너지 비용 절감 {round(energy):,}만원",
        f"연간 유지보수 비용 절감 {round(maintenance):,}만원",
        f"불량 손실 감소 효과 {round(defect):,}만원",
    ]

    return {
        "company_name": company_name,
        "equipment_name": equipment_name,
        "selected_policy": policy_title,
        "application_purpose": (
            f"{equipment_name} 설비의 노후도와 ROI 분석 결과를 바탕으로 "
            f"{scenario_label} 방향의 설비투자 및 생산성 개선을 추진합니다."
        ),
        "investment_manwon": investment,
        "subsidy_manwon": subsidy,
        "payback_months": payback_months,
        "expected_benefits": expected_benefits,
        "readiness_score": 76,
        "ai_reasons": [
            "ROI 분석 결과를 기준으로 설비투자 타당성을 확인했습니다.",
            f"{policy_title}의 지원 방향과 설비 개선 목적을 함께 검토했습니다.",
            "기업 기본정보, 설비현황, 정책 매칭 결과를 초안 생성 기준으로 반영했습니다.",
        ],
        "business_necessity": (
            f"{company_name}은 {equipment_name} 설비의 운영 비용, 유지보수 부담, "
            "품질 개선 필요성을 고려하여 설비 개선 투자가 필요합니다."
        ),
        "expected_effects": (
            "설비 개선을 통해 에너지 비용 절감, 유지보수 비용 절감, "
            "불량률 감소 및 생산 안정성 향상을 기대할 수 있습니다."
        ),
        "required_documents": [
            "사업자등록증",
            "최근 재무제표",
            "설비 견적서",
            "기존 설비 사진",
            "에너지 사용 내역",
            "지원사업 공고문",
        ],
        "generation_mode": "fallback",
    }


def _invoke_llm_with_timeout(messages):
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(llm.invoke, messages)
    try:
        return future.result(timeout=LLM_DRAFT_TIMEOUT_SECONDS)
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def application_draft_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])
    roi_result = state.get("roi_result")

    selected_policy = matched_policies[0] if matched_policies else "선택된 공고 없음"

    prompt = UNTRUSTED_DATA_INSTRUCTION + "\n\n" + APPLICATION_DRAFT_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company and company.industry_code else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.name if equipment else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        selected_policy=serialize_untrusted(selected_policy),
        roi_result=serialize_untrusted(
            roi_result if roi_result else "ROI calculation result unavailable"
        ),
    )

    fallback_draft = _make_fallback_draft(state)

    try:
        response = _invoke_llm_with_timeout(
            [
                SystemMessage(content=prompt),
                HumanMessage(content="Generate the application draft from the supplied data."),
            ]
        )
    except TimeoutError:
        state["draft_result"] = fallback_draft
        state["final_response"] = json.dumps(fallback_draft, ensure_ascii=False)
        return state
    except Exception as exc:
        fallback_draft["generation_error"] = str(exc)
        state["draft_result"] = fallback_draft
        state["final_response"] = json.dumps(fallback_draft, ensure_ascii=False)
        return state

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
        fallback_draft["llm_raw_content"] = response.content
        state["draft_result"] = fallback_draft
        state["final_response"] = json.dumps(fallback_draft, ensure_ascii=False)

    return state
