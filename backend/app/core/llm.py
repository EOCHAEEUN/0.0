from langchain_openai import ChatOpenAI
from app.core.config import settings
# from langchain_ollama import ChatOllama

llm = ChatOpenAI(
    model="nvidia/nemotron-3-super-120b-a12b:free",
    openai_api_key=settings.openrouter_api_key,
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0
)
