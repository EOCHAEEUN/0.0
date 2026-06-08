from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.router import ROUTER_SYSTEM_PROMPT
from app.core.config import settings
from app.core.llm import llm

VALID_INTENTS = ["roi", "policy", "draft", "calendar", "info_missing", "general"]


def _format_industry_codes(industry_code) -> str:
    if not industry_code:
        return "정보 없음"
    if isinstance(industry_code, list):
        return ", ".join(industry_code)
    return str(industry_code)

def router_node(state: FactofitState) -> FactofitState:
    # 기업 컨텍스트 꺼내기
    company = state.get("company_info")
    equipment = state.get("equipment")

    industry_codes = _format_industry_codes(company.industry_code if company else None)
    region = company.region if company else "정보 없음"
    equipment_info = equipment.equipment.name if equipment else "정보 없음"
    history_text = ""
    for msg in state.get("chat_history", []):
        role = "사용자" if msg.get("role") == "user" else "AI"
        history_text += f"{role}: {msg.get('content', '')}\n"

    # 프롬프트에 컨텍스트 주입
    prompt = ROUTER_SYSTEM_PROMPT.format(
        industry_codes=industry_codes,
        region=region,
        equipment_info=equipment_info,
        chat_history=history_text if history_text else "없음",
        user_message=state["user_query"]
    )

    response = llm.invoke([
        SystemMessage(content=prompt)
    ])

    print("=== ROUTER 응답 ===")
    print(response.content)

    intent = response.content.strip().lower()

    # 유효하지 않은 intent면 info_missing으로 fallback
    if intent not in VALID_INTENTS:
        intent = "info_missing"

    state["intent"] = intent
    return state
