from langchain_core.messages import SystemMessage

from app.core.llm import llm
from app.prompts.router import ROUTER_SYSTEM_PROMPT
from app.state import FactofitState


VALID_INTENTS = ["roi", "roi_followup", "policy", "draft", "safety", "info_missing", "general"]

ROI_ANALYSIS_KEYWORDS = [
    "roi", "분석", "투자", "교체", "검토",
    "회수", "절감", "비용", "효율", "수익",
    "생산성", "노후", "유지보수",
]

GENERAL_CONVERSATION_KEYWORDS = [
    "안녕", "반가", "고마워", "고민", "싫", "나중", "무슨", "무엇", "도움",
    "할 수 있어", "소개", "서비스", "가능", "설명해줘",
]


def _equipment_name(equipment) -> str:
    if not equipment:
        return "정보 없음"
    nested = getattr(equipment, "equipment", None)
    if nested is not None:
        return getattr(nested, "name", "정보 없음")
    return getattr(equipment, "name", "정보 없음")


def router_node(state: FactofitState) -> FactofitState:
    if state.get("policy_intent_choice"):
        state["intent"] = "policy"
        return state

    company = state.get("company_info")
    equipment = state.get("equipment")
    equipments = state.get("equipments", [])
    equipment_count = len(equipments)
    roi_result = state.get("roi_result")

    industry_codes = company.industry_code if company else "정보 없음"
    region = company.region if company else "정보 없음"
    equipment_info = _equipment_name(equipment)

    # 설비가 이미 선택된 상태면 equipment_count를 1로 표시
    # → router가 "설비 특정됨"으로 판단해서 info_missing으로 안 빠짐
    if equipment:
        equipment_count_for_prompt = 1
    else:
        equipment_count_for_prompt = equipment_count

    history_text = ""
    for msg in state.get("chat_history", []):
        role = "사용자" if msg["role"] == "user" else "AI"
        history_text += f"{role}: {msg['content']}\n"

    prompt = ROUTER_SYSTEM_PROMPT.format(
        industry_codes=industry_codes,
        region=region,
        equipment_info=equipment_info,
        equipment_count=equipment_count_for_prompt,
        chat_history=history_text if history_text else "없음",
        user_message=state["user_query"],
    )

    response = llm.invoke([SystemMessage(content=prompt)])
    intent = response.content.strip().lower()
    query = (state.get("user_query") or "").lower()

    if intent not in VALID_INTENTS:
        intent = "general"

    # 일반 상담/인사/감정 표현은 설비 선택 강제 없이 general로 처리한다.
    if intent == "info_missing" and any(keyword in query for keyword in GENERAL_CONVERSATION_KEYWORDS):
        intent = "general"

    # 선택 설비가 이미 확정된 뒤에는 다중 설비 선택 요청을 반복하지 않도록,
    # 분석/ROI 계열 질문의 info_missing을 roi로 보정한다.
    has_selected_equipment = equipment is not None

    if (
        intent == "info_missing"
        and has_selected_equipment
        and any(keyword in query for keyword in ROI_ANALYSIS_KEYWORDS)
    ):
        intent = "roi"

    # ✅ 추가! ROI 결과가 있으면 roi_followup으로 분류
    # (후속질문: 상세, 비교, 시뮬레이션 등이 들어올 수 있음)
    if roi_result and intent in ["roi", "policy", "draft"]:
        intent = "roi_followup"

    state["intent"] = intent
    return state
