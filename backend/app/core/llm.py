from langchain_openai import ChatOpenAI

from app.core.config import settings


def _resolve_api_key() -> str:
    api_key = (settings.openrouter_api_key or "").strip()
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is missing. Set it in backend/.env")
    return api_key


def _create_llm(model: str, *, temperature: float = 0) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        api_key=_resolve_api_key(),
        base_url=settings.llm_api_base,
        temperature=temperature,
    )


llm_fast = _create_llm(settings.llm_fast_model)
llm_advisor = _create_llm(settings.llm_advisor_model, temperature=0.4)
llm_pro = _create_llm(settings.llm_pro_model)

# 기존 import 호환
llm = _create_llm(settings.llm_model)
