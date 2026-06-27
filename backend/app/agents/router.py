from langchain_core.messages import SystemMessage

from app.core.llm import llm
from app.prompts.router import ROUTER_SYSTEM_PROMPT
from app.state import FactofitState


VALID_INTENTS = ["roi", "policy", "calendar", "draft", "info_missing", "general"]


def _equipment_name(equipment) -> str:
    if not equipment:
        return "정보 없음"
    nested = getattr(equipment, "equipment", None)
    if nested is not None:
        return getattr(nested, "name", "정보 없음")
    return getattr(equipment, "name", "정보 없음")


def router_node(state: FactofitState) -> FactofitState:
    company = state.get("company_info")
    equipment = state.get("equipment")

    industry_codes = company.industry_code if company else "정보 없음"
    region = company.region if company else "정보 없음"
    equipment_info = _equipment_name(equipment)

    history_text = ""
    for msg in state.get("chat_history", []):
        role = "사용자" if msg["role"] == "user" else "AI"
        history_text += f"{role}: {msg['content']}\n"

    prompt = ROUTER_SYSTEM_PROMPT.format(
        industry_codes=industry_codes,
        region=region,
        equipment_info=equipment_info,
        chat_history=history_text if history_text else "없음",
        user_message=state["user_query"],
    )

    response = llm.invoke([SystemMessage(content=prompt)])
    intent = response.content.strip().lower()

    if intent not in VALID_INTENTS:
        intent = "info_missing"

    state["intent"] = intent
    return state
