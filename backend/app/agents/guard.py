from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.guard import SAFETY_SYSTEM_PROMPT
from app.core.llm import llm_fast
import json

def guard_node(state: FactofitState) -> FactofitState:
    # Guard 모델이 일시적으로 실패해도 서비스 전체를 막지 않도록 fail-open 처리합니다.
    try:
        response = llm_fast.invoke([
            SystemMessage(content=SAFETY_SYSTEM_PROMPT),
            HumanMessage(content=state["user_query"])
        ])

        content = str(response.content).strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        result = json.loads(content.strip())
        is_safe = bool(result.get("is_safe", True))
        reason = str(result.get("reason", "")).strip()
    except Exception:
        is_safe = True
        reason = "guard_unavailable"

    if not is_safe:
        state["final_response"] = f"죄송해요, 해당 질문은 답변드리기 어렵습니다. ({reason})"

    state["is_safe"] = is_safe
    return state
