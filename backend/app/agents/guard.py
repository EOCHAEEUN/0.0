from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.guard import SAFETY_SYSTEM_PROMPT
from app.core.config import settings
from app.core.llm import llm
import json

def safety_node(state: FactofitState) -> FactofitState:
    response = llm.invoke([
        SystemMessage(content=SAFETY_SYSTEM_PROMPT),
        HumanMessage(content=state["user_query"])
    ])

    try:
        result = json.loads(response.content)
        is_safe = result.get("is_safe", False)
        reason = result.get("reason", "")
    except json.JSONDecodeError:
        is_safe = False
        reason = "응답 파싱 실패"

    if not is_safe:
        state["final_response"] = f"죄송해요, 해당 질문은 답변드리기 어렵습니다. ({reason})"

    state["is_safe"] = is_safe
    return state
