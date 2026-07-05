from langchain_openai import ChatOpenAI
from app.core.config import settings

llm = ChatOpenAI(
    model=settings.llm_model,
    openai_api_key=settings.openrouter_api_key,
    openai_api_base=settings.llm_api_base,
    temperature=0
)
