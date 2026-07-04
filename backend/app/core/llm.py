from langchain_openai import ChatOpenAI
from app.core.config import settings
# from langchain_ollama import ChatOllama

# llm = ChatOpenAI(
#     model="google/gemini-2.5-flash",
#     openai_api_key=settings.openrouter_api_key,
#     openai_api_base="https://openrouter.ai/api/v1",
#     temperature=0
# )
llm = ChatOpenAI(
    model="gpt-4o-mini",  # OpenAI 실제 모델명으로 변경
    openai_api_key=settings.openrouter_api_key,
    temperature=0
)