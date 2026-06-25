# app/agents/router.py
from langchain_core.messages import SystemMessage
from app.state import FactofitState
from app.prompts.router import ROUTER_SYSTEM_PROMPT
from app.core.llm import llm

VALID_INTENTS = ["roi", "policy", "calendar", "draft", "safety", "info_missing", "general"]

def router_node(state: FactofitState) -> FactofitState:
    company = state.get("company_info")
    equipment = state.get("equipment")
    equipments = state.get("equipments", [])
    equipment_count = len(equipments)

    industry_codes = company.industry_code if company else "정보 없음"
    region = company.region if company else "정보 없음"
    equipment_info = equipment.name if equipment else "정보 없음"

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
        user_message=state["user_query"]
    )

    response = llm.invoke([SystemMessage(content=prompt)])
    intent = response.content.strip().lower()
    if intent == "calendar":
        intent = "policy"

    if intent not in VALID_INTENTS:
        intent = "info_missing"

    state["intent"] = intent
    return state
