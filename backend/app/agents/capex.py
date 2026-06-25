from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from app.state import FactofitState
from app.prompts.capex import CAPEX_SYSTEM_PROMPT
from app.tools.roi_calc_tool import calculate_equipment_roi
from app.core.llm import llm
from app.core.database import get_db
import json

def format_roi_result(roi_data: dict) -> str:
    """ROI 결과를 사용자 친화적으로 포맷"""
    scenario_a = roi_data.get("scenario_a", {})
    scenario_b = roi_data.get("scenario_b", {})
    recommended = roi_data.get("recommended", "")
    ai_rec = roi_data.get("ai_recommendation", {})

    summary = ai_rec.get("summary", "")
    reason = ai_rec.get("reason_bullets", [])

    result = f"""
- ROI 분석 결과

추천: 시나리오 {recommended}
{summary}

- 주요 이유:
"""
    for r in reason[:3]:
        result += f"• {r}\n"

    result += f"""
A (전체교체):
  투자금: {scenario_a.get('investment_manwon'):,}만원
  회수기간: {scenario_a.get('payback_period_yr')}년

B (부분교체):
  투자금: {scenario_b.get('investment_manwon'):,}만원
  회수기간: {scenario_b.get('payback_period_yr')}년

더 궁금한 점이 있으신가요? (상세 설명, 비교, 시뮬레이션)
"""
    return result

def analyze_roi_followup(user_query: str, roi_result: dict) -> dict:
    scenario_a = roi_result.get("scenario_a", {})
    scenario_b = roi_result.get("scenario_b", {})
    recommended = roi_result.get("recommended", "")

    prompt = f"""
    사용자: "{user_query}"
    현재 ROI 결과:
    - A 시나리오: 투자금 {scenario_a.get('investment_manwon')}
    - B 시나리오: 투자금 {scenario_b.get('investment_manwon')}
    - 추천: {recommended}

    의도 분류:
    - detail: A/B 시나리오 상세 설명
    - compare: A vs B 비교
    - simulate: 새로운 투자금으로 재계산

    JSON: {{"intent": "...", "new_investment": 숫자}}
    """

    response = llm.invoke([SystemMessage(content=prompt)])
    return json.loads(response.content)

def show_roi_detail(roi_data: dict, user_query: str) -> str:
    """시나리오 상세 설명"""
    scenario_a = roi_data.get("scenario_a", {})
    scenario_b = roi_data.get("scenario_b", {})

    query = user_query.lower()

    # A 키워드 확인
    if any(k in query for k in ("a", "전체", "전체교체", "a 시나리오")):
        scenario = scenario_a
        label = "A (전체교체)"
    # B 키워드 확인
    elif any(k in query for k in ("b", "부분", "부분교체", "b 시나리오")):
        scenario = scenario_b
        label = "B (부분교체)"
    else:
        # 명확하지 않음 - 사용자에게 물어보기
        return """
어떤 시나리오를 상세히 알고 싶으신가요?

A: 전체교체 - 기존 설비를 완전히 교체
B: 부분교체 - 주요 부품만 교체

예) "A 설명해줘" 또는 "부분교체는?"
"""

    result = f"""
- {label} 시나리오 상세

투자금: {scenario.get('investment_manwon'):,}만원
연간 절감액: {scenario.get('annual_saving_manwon'):,}만원
회수기간: {scenario.get('payback_period_yr')}년
ROI: {scenario.get('roi_pct')}%

연간 효과:
- 에너지 절감: {scenario.get('annual_energy_saving_manwon'):,}만원
- 불량비 절감: {scenario.get('annual_defect_saving_manwon'):,}만원
- 유지보수비: {scenario.get('maintenance_cost_annual'):,}만원
"""
    return result

def compare_scenarios(roi_data: dict) -> str:
    """A vs B 비교"""
    scenario_a = roi_data.get("scenario_a", {})
    scenario_b = roi_data.get("scenario_b", {})
    recommended = roi_data.get("recommended", "")

    result = f"""
- 시나리오 A vs B 비교

                 A (전체교체)    B (부분교체)
투자금:          {scenario_a.get('investment_manwon'):,}만원      {scenario_b.get('investment_manwon'):,}만원
연간 절감액:     {scenario_a.get('annual_saving_manwon'):,}만원      {scenario_b.get('annual_saving_manwon'):,}만원
회수기간:        {scenario_a.get('payback_period_yr')}년           {scenario_b.get('payback_period_yr')}년
ROI:            {scenario_a.get('roi_pct')}%           {scenario_b.get('roi_pct')}%

- 추천: 시나리오 {recommended}
"""
    return result

def compare_roi_results(original_roi: dict, new_roi: dict) -> str:
    """기존 ROI vs 새로운 투자금 ROI 비교"""
    orig_a = original_roi.get("scenario_a", {})
    new_a = new_roi.get("scenario_a", {})

    result = f"""
- 투자금 변경 시뮬레이션

                 기존 A          신규 A
투자금:          {orig_a.get('investment_manwon'):,}만원      {new_a.get('investment_manwon'):,}만원
회수기간:        {orig_a.get('payback_period_yr')}년           {new_a.get('payback_period_yr')}년
ROI:            {orig_a.get('roi_pct')}%           {new_a.get('roi_pct')}%

- 이 시뮬레이션은 임시 계산이며 DB에 저장되지 않습니다.
"""
    return result


def capex_advisor_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    roi_result = state.get("roi_result")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])
    user_query = state.get("user_query", "")

    # equipment는 무조건 있다고 가정!
    if not equipment:
        state["final_response"] = "설비 정보가 필요합니다."
        return state

    # 상태 2: roi_result 없음 → DB에서 조회
    if not roi_result:
        # DB에서 roi_output 조회
        db = get_db()
        roi_output = db.table("roi_output").select("*").eq(
            "company_id", company.company_id
        ).eq(
            "equipment_id", equipment.equipment_id
        ).execute()

        if not roi_output.data:
            # DB에 저장된 결과 없음
            state["final_response"] = "분석하기를 먼저 진행해주세요."
            return state

        # roi_output 있음
        roi_data = roi_output.data[0].get("roi_data", {})
        state["roi_result"] = roi_data
        state["final_response"] = format_roi_result(roi_data)
        return state

    # 상태 3: roi_result 있음 → 후속질문 처리
    else:
        followup_info = analyze_roi_followup(user_query, roi_result)
        intent = followup_info.get("intent")

        if intent == "detail":
            # 상세 설명
            state["final_response"] = show_roi_detail(roi_result, user_query)

        elif intent == "compare":
            # A vs B 비교
            state["final_response"] = compare_scenarios(roi_result)

        elif intent == "simulate":
            # 새로운 투자금으로 재계산
            new_investment = followup_info.get("new_investment")
            # equipment 복사해서 투자금 변경
            equipment.scenario_a_investment_manwon = new_investment
            new_roi = calculate_equipment_roi(equipment)
            state["final_response"] = compare_roi_results(roi_result, new_roi)

        return state
