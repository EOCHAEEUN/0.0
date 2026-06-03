"""Router Agent — 의도 분류 후 전문 에이전트로 라우팅"""
from typing import AsyncGenerator
from langchain_openai import ChatOpenAI
from app.core.config import settings

llm = ChatOpenAI(
    model="qwen/qwen3-235b-a22b",
    openai_api_key=settings.openrouter_api_key,
    openai_api_base="https://openrouter.ai/api/v1",
    streaming=True,
)

async def run_agent(
    message: str,
    company_context: dict,
    history: list[dict],
) -> AsyncGenerator[bytes, None]:
    """SSE 스트리밍 응답 생성 — TODO: LangGraph Router 패턴으로 교체"""
    async for chunk in llm.astream(message):
        if chunk.content:
            yield f"data: {chunk.content}\n\n".encode()
