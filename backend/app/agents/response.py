from datetime import datetime

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.database import get_db
from app.state import FactofitState


def response_node(state: FactofitState) -> FactofitState:
    if state.get("intent") == "general" and not state.get("final_response"):
        from app.core.llm import llm

        response = llm.invoke(
            [
                SystemMessage(
                    content=(
                        "You are FactoFit's AI advisor for manufacturing equipment "
                        "investment decisions. Answer clearly and helpfully."
                    )
                ),
                HumanMessage(content=state["user_query"]),
            ]
        )
        state["final_response"] = response.content

    supabase = get_db()
    company = state.get("company_info")
    company_id = str(company.company_id) if company and company.company_id else None

    try:
        insert_result = supabase.table("chat_history").insert(
            {
                "company_id": company_id,
                "intent": state.get("intent", ""),
                "user_query": state.get("user_query", ""),
                "chat_history": state.get("chat_history", []),
                "roi_result": state.get("roi_result"),
                "matched_policies": state.get("matched_policies", []),
                "final_response": state.get("final_response", ""),
                "created_at": datetime.now().isoformat(),
            }
        ).execute()

        if insert_result.data:
            state["chat_id"] = insert_result.data[0].get("chat_id")
    except Exception as e:
        print(f"chat_history save failed: {e}")

    if state.get("intent") == "draft" and state.get("draft_result"):
        try:
            matched_policies = state.get("matched_policies", [])
            policy_id = matched_policies[0].get("id", "") if matched_policies else ""

            supabase.table("draft_result").insert(
                {
                    "company_id": company_id,
                    "equipment_id": state.get("equipment_id"),
                    "policy_id": policy_id,
                    "draft_content": state.get("draft_result", ""),
                    "created_at": datetime.now().isoformat(),
                }
            ).execute()
        except Exception as e:
            print(f"draft_result save failed: {e}")

    if state.get("roi_result"):
        try:
            supabase.table("roi_output").insert(
                {
                    "company_id": company_id,
                    "equipment_id": state.get("equipment_id"),
                    "roi_data": state["roi_result"],
                    "created_at": datetime.now().isoformat(),
                }
            ).execute()
        except Exception as e:
            print(f"roi_output save failed: {e}")

    if state.get("matched_policies"):
        try:
            for policy in state.get("matched_policies", []):
                supabase.table("matched_policy").insert(
                    {
                        "company_id": company_id,
                        "equipment_id": state.get("equipment_id"),
                        "policy_id": policy.get("id", ""),
                        "title": policy.get("metadata", {}).get("title", ""),
                        "match_score": round(1 - policy.get("distance", 1), 3),
                        "eligible": policy.get("eligible", True),
                        "reason": policy.get("reason", "RAG similarity match"),
                        "llm_score": policy.get("llm_score", ""),
                        "created_at": datetime.now().isoformat(),
                    }
                ).execute()
        except Exception as e:
            print(f"matched_policy save failed: {e}")

    return state
