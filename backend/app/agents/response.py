from datetime import datetime

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.database import get_db
from app.state import FactofitState

def response_node(state: FactofitState) -> FactofitState:
    if state.get("intent") == "general" and not state.get("final_response"):
        from app.core.llm import llm
        from langchain_core.messages import SystemMessage
        
        user_query = state.get("user_query", "")
        
        prompt = f"""
        사용자의 일반 질문에 답변해주세요.
        질문: {user_query}
        """
        
        response = llm.invoke([SystemMessage(content=prompt)])
        state["final_response"] = response.content
    # Chat용: chat_history만 저장
    supabase = get_db()
    company = state.get("company_info")
    company_id = str(company.company_id) if company and company.company_id else None

    try:
        insert_result = supabase.table("chat_history").insert({
            "company_id": company_id,
            "intent": state.get("intent", ""),
            "user_query": state.get("user_query", ""),
            "chat_history": state.get("chat_history", []),
            "final_response": state.get("final_response", ""),
            "created_at": datetime.now().isoformat(),
        }).execute()

        if insert_result.data:
            state["chat_id"] = insert_result.data[0].get("chat_id")
    except Exception as e:
        print(f"chat_history save failed: {e}")

    return state