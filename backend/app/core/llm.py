from langchain_openai import ChatOpenAI
from app.core.config import settings
# from langchain_ollama import ChatOllama

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

# Backward-compatible alias
llm = llm_fast
