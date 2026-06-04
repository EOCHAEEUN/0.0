from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.router import ROUTER_SYSTEM_PROMPT
from app.core.config import settings
from app.core.llm import llm

VALID_INTENTS = ["investment_advice", "subsidy_search", "application_help", "info_missing"]

def router_node(state: FactofitState) -> FactofitState:
    # 기업 컨텍스트 꺼내기
    company = state.get("company_info")
    equipment = state.get("equipment")

    industry_code = company.industry_code if company else "정보 없음"
    region = company.region if company else "정보 없음"
    equipment_info = equipment.equipment.name if equipment else "정보 없음"

    # 프롬프트에 컨텍스트 주입
    prompt = ROUTER_SYSTEM_PROMPT.format(
        industry_code=industry_code,
        region=region,
        equipment_info=equipment_info,
        user_message=state["user_query"]
    )

    response = llm.invoke([
        SystemMessage(content=prompt)
    ])

    intent = response.content.strip().lower()

    # 유효하지 않은 intent면 info_missing으로 fallback
    if intent not in VALID_INTENTS:
        intent = "info_missing"

    state["intent"] = intent
    return state
