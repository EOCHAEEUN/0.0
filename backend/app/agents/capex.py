from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from app.state import FactofitState
from app.prompts.capex import CAPEX_SYSTEM_PROMPT
from app.tools.roi_calc_tool import calculate_equipment_roi
from app.core.llm import llm

import json
import re


def normalize_equipment_category(*values) -> str:
    """
    ROI 계산기가 지원하는 설비 카테고리로 정규화합니다.
    category, name 등 여러 값을 받아 합쳐서 판단합니다.

    주의:
    - industry_code(C21, C24 등), company_type(제조업, 제조 등)은 ROI category가 아닙니다.
    - ROI category는 반드시 press/cnc/injection 중 하나여야 합니다.
    - industry_code, company_type은 판단에 사용하지 않습니다.
    """
    text = " ".join(str(v or "") for v in values).strip().lower()

    if "프레스" in text or "press" in text:
        return "press"

    if any(k in text for k in ("cnc", "공작기계", "머시닝", "가공기", "가공설비")):
        return "cnc"

    if any(k in text for k in ("사출", "injection", "사출성형")):
        return "injection"

    # TODO: MVP 시연용 임시 fallback — 추후 설비명 확장 시 제거
    if any(k in text for k in ("제조설비", "제조 장비", "기계설비")):
        return "cnc"

    return "unsupported"


def _safe_int(value, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _fmt_int(value) -> str:
    return f"{_safe_int(value):,}"


def _fmt_float(value, digits: int = 1) -> str:
    return f"{_safe_float(value):.{digits}f}"


def _scenario_values(roi_data: dict, key: str) -> dict:
    scenario = roi_data.get(key, {}) if isinstance(roi_data, dict) else {}
    scenario = scenario if isinstance(scenario, dict) else {}
    breakdown = scenario.get("breakdown", {})
    breakdown = breakdown if isinstance(breakdown, dict) else {}
    return {
        "investment_manwon": _safe_int(scenario.get("investment_manwon")),
        "annual_net_benefit_manwon": _safe_int(scenario.get("annual_net_benefit_manwon")),
        "payback_years": _safe_float(scenario.get("payback_years")),
        "roi_pct": _safe_float(scenario.get("roi_pct")),
        "energy_saving_manwon": _safe_int(breakdown.get("energy_saving_manwon")),
        "defect_saving_manwon": _safe_int(breakdown.get("defect_saving_manwon")),
        "maintenance_saving_manwon": _safe_int(breakdown.get("maintenance_saving_manwon")),
    }


def format_roi_result(roi_data: dict) -> str:
    """ROI 결과를 사용자 친화적인 요약 문장으로 포맷합니다."""
    scenario_a = _scenario_values(roi_data, "scenario_a")
    scenario_b = _scenario_values(roi_data, "scenario_b")
    recommended = str(roi_data.get("recommended") or "A").upper()
    ai_recommendation = roi_data.get("ai_recommendation", {})
    ai_recommendation = ai_recommendation if isinstance(ai_recommendation, dict) else {}
    summary = str(ai_recommendation.get("summary") or "").strip()
    reason_bullets = ai_recommendation.get("reason_bullets")
    reason_bullets = reason_bullets if isinstance(reason_bullets, list) else []

    lines = [
        "- ROI 분석 결과",
        "",
        f"추천: 시나리오 {recommended}",
    ]
    if summary:
        lines.append(summary)
    lines.append("")
    lines.append("- 주요 이유:")
    if reason_bullets:
        for reason in reason_bullets[:3]:
            lines.append(f"• {str(reason).strip()}")
    else:
        lines.append("• A/B 시나리오의 실투자금, 회수기간, 연간 순편익을 종합 비교했습니다.")
    lines.extend(
        [
            "",
            "A (전체교체):",
            f"  투자금: {_fmt_int(scenario_a['investment_manwon'])}만원",
            f"  회수기간: {_fmt_float(scenario_a['payback_years'])}년",
            "",
            "B (부분개선):",
            f"  투자금: {_fmt_int(scenario_b['investment_manwon'])}만원",
            f"  회수기간: {_fmt_float(scenario_b['payback_years'])}년",
            "",
            "더 궁금한 점이 있으신가요? (상세 설명, 비교, 시뮬레이션)",
        ]
    )
    return "\n".join(lines)


def show_roi_detail(roi_data: dict, user_query: str) -> str:
    """사용자 질문에 맞춰 A/B 시나리오 상세를 반환합니다."""
    query = str(user_query or "").lower()
    if any(keyword in query for keyword in ("b", "부분", "부분개선", "b안", "b 시나리오")):
        scenario = _scenario_values(roi_data, "scenario_b")
        label = "B (부분개선)"
    elif any(keyword in query for keyword in ("a", "전체", "전체교체", "a안", "a 시나리오")):
        scenario = _scenario_values(roi_data, "scenario_a")
        label = "A (전체교체)"
    else:
        return (
            "어떤 시나리오를 상세히 보고 싶으신가요?\n\n"
            "A: 전체교체 - 기존 설비 전면 교체\n"
            "B: 부분개선 - 핵심 부품/공정 위주 개선\n\n"
            "예) 'A 설명해줘' 또는 '부분개선은?'"
        )

    return "\n".join(
        [
            f"- {label} 시나리오 상세",
            "",
            f"투자금: {_fmt_int(scenario['investment_manwon'])}만원",
            f"연간 순편익: {_fmt_int(scenario['annual_net_benefit_manwon'])}만원",
            f"회수기간: {_fmt_float(scenario['payback_years'])}년",
            f"ROI: {_fmt_float(scenario['roi_pct'])}%",
            "",
            "연간 효과:",
            f"- 에너지 절감: {_fmt_int(scenario['energy_saving_manwon'])}만원",
            f"- 불량비 절감: {_fmt_int(scenario['defect_saving_manwon'])}만원",
            f"- 유지보수 절감: {_fmt_int(scenario['maintenance_saving_manwon'])}만원",
        ]
    )


def compare_scenarios(roi_data: dict) -> str:
    """A/B 시나리오 비교 텍스트를 생성합니다."""
    scenario_a = _scenario_values(roi_data, "scenario_a")
    scenario_b = _scenario_values(roi_data, "scenario_b")
    recommended = str(roi_data.get("recommended") or "A").upper()
    return "\n".join(
        [
            "- 시나리오 A vs B 비교",
            "",
            "                 A (전체교체)           B (부분개선)",
            f"투자금:          {_fmt_int(scenario_a['investment_manwon'])}만원         {_fmt_int(scenario_b['investment_manwon'])}만원",
            f"연간 순편익:     {_fmt_int(scenario_a['annual_net_benefit_manwon'])}만원         {_fmt_int(scenario_b['annual_net_benefit_manwon'])}만원",
            f"회수기간:        {_fmt_float(scenario_a['payback_years'])}년            {_fmt_float(scenario_b['payback_years'])}년",
            f"ROI:            {_fmt_float(scenario_a['roi_pct'])}%            {_fmt_float(scenario_b['roi_pct'])}%",
            "",
            f"- 추천: 시나리오 {recommended}",
        ]
    )


def compare_roi_results(original_roi: dict, new_roi: dict) -> str:
    """기존 ROI와 시뮬레이션 ROI를 비교해 보여줍니다."""
    original_a = _scenario_values(original_roi, "scenario_a")
    new_a = _scenario_values(new_roi, "scenario_a")
    return "\n".join(
        [
            "- 투자금 변경 시뮬레이션",
            "",
            "                 기존 A                신규 A",
            f"투자금:          {_fmt_int(original_a['investment_manwon'])}만원         {_fmt_int(new_a['investment_manwon'])}만원",
            f"회수기간:        {_fmt_float(original_a['payback_years'])}년            {_fmt_float(new_a['payback_years'])}년",
            f"ROI:            {_fmt_float(original_a['roi_pct'])}%            {_fmt_float(new_a['roi_pct'])}%",
            "",
            "- 이 시뮬레이션은 임시 계산이며 DB에 저장되지 않습니다.",
        ]
    )


def _extract_json_object(text: str) -> dict:
    raw = str(text or "").strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}


def _extract_new_investment(user_query: str) -> int | None:
    text = str(user_query or "").replace(",", "").replace(" ", "")
    if not text:
        return None
    total = 0.0
    matched = False
    for value in re.findall(r"(\d+(?:\.\d+)?)억", text):
        total += float(value) * 10000
        matched = True
    for value in re.findall(r"(\d+(?:\.\d+)?)천(?:만)?", text):
        total += float(value) * 1000
        matched = True
    if matched and total > 0:
        return int(round(total))
    direct = re.search(r"(\d+(?:\.\d+)?)(?:만원|만)?", text)
    if not direct:
        return None
    amount = float(direct.group(1))
    if "만원" in text or "만" in text or amount >= 1000:
        return int(round(amount))
    return None


def analyze_roi_followup(user_query: str, roi_result: dict) -> dict:
    """
    ROI 후속 질문을 detail/compare/simulate로 분류합니다.
    1) 규칙 기반 우선
    2) 필요 시 LLM 보조
    """
    query = str(user_query or "").lower()
    new_investment = _extract_new_investment(query)
    if any(keyword in query for keyword in ("비교", "a vs b", "a와 b", "차이")):
        return {"intent": "compare", "new_investment": None}
    if any(keyword in query for keyword in ("상세", "자세", "설명", "왜", "근거")):
        return {"intent": "detail", "new_investment": None}
    if new_investment is not None and any(
        keyword in query for keyword in ("투자금", "변경", "재계산", "시뮬", "바꾸")
    ):
        return {"intent": "simulate", "new_investment": new_investment}

    scenario_a = _scenario_values(roi_result, "scenario_a")
    scenario_b = _scenario_values(roi_result, "scenario_b")
    prompt = f"""
사용자 질문: "{user_query}"
현재 ROI 결과:
- A 투자금: {scenario_a.get("investment_manwon")}
- B 투자금: {scenario_b.get("investment_manwon")}
- 추천: {roi_result.get("recommended")}

아래 JSON만 반환하세요.
{{"intent":"detail|compare|simulate|other","new_investment":null_or_number}}
"""
    try:
        response = llm.invoke([SystemMessage(content=prompt)])
        parsed = _extract_json_object(response.content)
        intent = str(parsed.get("intent") or "other").lower()
        amount = parsed.get("new_investment")
        if amount is None:
            amount = _extract_new_investment(user_query)
        return {
            "intent": intent if intent in {"detail", "compare", "simulate"} else "other",
            "new_investment": _safe_int(amount) if amount is not None else None,
        }
    except Exception:
        return {"intent": "other", "new_investment": None}


def capex_advisor_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])
    user_query = str(state.get("user_query") or "")
    roi_result = state.get("roi_result")

    # 이미 ROI가 있으면 후속 질문을 우선 처리해 불필요한 재계산을 줄입니다.
    if isinstance(roi_result, dict) and roi_result:
        followup = analyze_roi_followup(user_query, roi_result)
        intent = followup.get("intent")
        if intent == "detail":
            state["final_response"] = show_roi_detail(roi_result, user_query)
            return state
        if intent == "compare":
            state["final_response"] = compare_scenarios(roi_result)
            return state
        if intent == "simulate":
            new_investment = followup.get("new_investment")
            if not equipment or new_investment is None:
                state["final_response"] = (
                    "시뮬레이션하려는 투자금(만원 단위)을 함께 알려주세요. "
                    "예: 'A안 투자금 6000만원으로 재계산'"
                )
                return state
            if hasattr(equipment, "model_copy"):
                simulation_equipment = equipment.model_copy(
                    update={"scenario_a_investment_manwon": _safe_int(new_investment)}
                )
            else:
                data = equipment.dict()
                data["scenario_a_investment_manwon"] = _safe_int(new_investment)
                simulation_equipment = type(equipment)(**data)
            if hasattr(simulation_equipment, "model_dump"):
                equipment_data = simulation_equipment.model_dump()
            else:
                equipment_data = simulation_equipment.dict()
            new_roi = calculate_equipment_roi.invoke({"equipment": equipment_data})
            state["final_response"] = compare_roi_results(roi_result, new_roi)
            return state

    # equipment가 없으면 user_query에서 설비 정보를 추출합니다.
    if not equipment:
        extract_prompt = """
아래 텍스트에서 설비 정보를 추출해서 JSON으로만 반환하세요. 설명 금지.
주의: 금액은 반드시 만원 단위로 변환하세요. (예: 4800만원 -> 4800)
{{
  "equipment_name": "설비명",
  "age_years": 숫자,
  "energy_cost_annual": 숫자 (만원 단위),
  "industry_code": "코드",
  "region": "지역"
}}
텍스트: {user_query}
""".format(user_query=state["user_query"])

        extract_response = llm.invoke([SystemMessage(content=extract_prompt)])

        try:
            content = extract_response.content.strip()

            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            data = json.loads(content.strip())

            category = normalize_equipment_category(
                data.get("equipment_category", ""),
                data.get("equipment_name", ""),
            )

            from app.models.equipment import EquipmentInput
            from app.models.company import CompanyContext

            state["equipment"] = EquipmentInput(
                name=data.get("equipment_name", ""),
                category=category,
                age_years=int(data.get("age_years", 0)),
                energy_cost_annual=int(data.get("energy_cost_annual", 0)),
            )

            if not company:
                state["company_info"] = CompanyContext(
                    company_name="",
                    industry_code=[data.get("industry_code", "")]
                    if data.get("industry_code")
                    else [],
                    region=data.get("region", ""),
                )

            equipment = state["equipment"]
            company = state["company_info"]

        except Exception as e:
            print(f"정보 추출 실패: {e}")
            state["final_response"] = (
                "설비 정보를 이해하지 못했어요. "
                "설비 종류, 연식, 에너지 비용을 다시 알려주세요."
            )
            return state

    # equipment가 이미 state에 있어도 category를 다시 정규화합니다.
    # Supabase 값 또는 LLM 추출값이 섞여 들어와도 ROI 계산기에는 press/cnc/injection만 넘기기 위함입니다.
    if equipment:
        normalized_category = normalize_equipment_category(
            getattr(equipment, "category", ""),
            getattr(equipment, "name", ""),
        )
        equipment.category = normalized_category
        state["equipment"] = equipment

    # 지원하지 않는 카테고리는 ROI 계산기로 보내지 않고 여기서 종료합니다.
    supported = ["press", "cnc", "injection"]
    if not equipment or equipment.category not in supported:
        state["final_response"] = (
            "현재 ROI 계산은 프레스, CNC, 사출성형기 설비만 지원합니다. "
            "설비명을 프레스/CNC/사출기 중 하나로 입력해주세요."
        )
        return state

    # LLM에 ROI 계산 Tool을 바인딩합니다.
    llm_with_tools = llm.bind_tools([calculate_equipment_roi])

    if matched_policies:
        policy_summary = [
            {
                "title": p.get("metadata", {}).get("title", ""),
                "max_amount": p.get("metadata", {}).get("max_amount", 0),
            }
            for p in matched_policies[:3]
        ]
        matched_policies_text = str(policy_summary)
    else:
        matched_policies_text = "매칭된 지원사업 없음"

    prompt = CAPEX_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code)
        if company and company.industry_code
        else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.name if equipment else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        energy_cost=equipment.energy_cost_annual if equipment else 0,
        defect_rate=equipment.defect_rate
        if equipment and equipment.defect_rate
        else "정보 없음",
        roi_result="Tool을 호출해서 계산하세요.",
        matched_policies=matched_policies_text,
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"]),
    ]

    response = llm_with_tools.invoke(messages)
    messages.append(response)

    if response.tool_calls:
        for tool_call in response.tool_calls:
            # 중요:
            # LLM이 만든 tool_call["args"]는 신뢰하지 않습니다.
            # LLM이 industry_code(C21)나 company_type(제조업)을 equipment.category로 잘못 넣을 수 있기 때문입니다.
            # 따라서 서버에서 검증/정규화한 state["equipment"]만 ROI 계산기에 전달합니다.
            if hasattr(state["equipment"], "model_dump"):
                equipment_data = state["equipment"].model_dump()
            else:
                equipment_data = state["equipment"].dict()

            safe_tool_args = {"equipment": equipment_data}

            print("=== safe ROI tool args ===")
            print(safe_tool_args)

            tool_result = calculate_equipment_roi.invoke(safe_tool_args)

            messages.append(
                ToolMessage(
                    content=json.dumps(tool_result, ensure_ascii=False),
                    tool_call_id=tool_call["id"],
                )
            )

            state["roi_result"] = tool_result

        final_response = llm.invoke(messages)
        state["final_response"] = final_response.content

        if matched_policies:
            title = matched_policies[0]["metadata"].get("title", "")
            amount = matched_policies[0]["metadata"].get("max_amount", 0)

            if title and amount:
                state["final_response"] += (
                    f"\n\n💡 매칭 지원사업: [{title}] "
                    f"최대 {amount}만원 활용 가능"
                )

    else:
        state["final_response"] = response.content

    return state
