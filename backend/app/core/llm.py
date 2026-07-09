from langchain_openai import ChatOpenAI

from app.core.config import settings

llm_fast = ChatOpenAI(
    model=settings.openrouter_fast_model,
    openai_api_key=settings.openrouter_api_key,
    openai_api_base=settings.openrouter_base_url,
    temperature=0,
    request_timeout=12,
)

llm_advanced = ChatOpenAI(
    model=settings.openrouter_advanced_model,
    openai_api_key=settings.openrouter_api_key,
    openai_api_base=settings.openrouter_base_url,
    temperature=0,
    request_timeout=20,
)

# Backward-compatible aliases (기존 소비처: llm / llm_pro / llm_advisor)
llm = llm_fast
llm_pro = llm_advanced
llm_advisor = llm_advanced
