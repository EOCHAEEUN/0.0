from datetime import datetime

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.database import get_db
from app.state import FactofitState


def _normalize_history(items):
    normalized = []
    for item in items or []:
        row = item if isinstance(item, dict) else {}
        role = str(row.get("role") or "").strip().lower()
        content = str(row.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        created_at = str(row.get("created_at") or "").strip()
        item = {"role": role, "content": content}
        if created_at:
            item["created_at"] = created_at
        normalized.append(item)
    return normalized


def _extract_chat_id(row):
    item = row if isinstance(row, dict) else {}
    chat_id = str(item.get("chat_id") or "").strip()
    return chat_id


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

    persisted_history = _normalize_history(state.get("chat_history", []))
    now_iso = datetime.now().isoformat()
    if state.get("user_query"):
        persisted_history.append(
            {
                "role": "user",
                "content": state.get("user_query", ""),
                "created_at": now_iso,
            }
        )
    if state.get("final_response"):
        persisted_history.append(
            {
                "role": "assistant",
                "content": state.get("final_response", ""),
                "created_at": datetime.now().isoformat(),
            }
        )

    try:
        current_chat_id = str(state.get("chat_id") or "").strip()
        payload = {
            "company_id": company_id,
            "intent": state.get("intent", ""),
            "user_query": state.get("user_query", ""),
            "roi_result": state.get("roi_result"),
            "matched_policies": state.get("matched_policies", []),
            "final_response": state.get("final_response", ""),
        }

        if current_chat_id:
            existing_row = (
                supabase.table("chat_history")
                .select("chat_id,chat_history")
                .eq("chat_id", current_chat_id)
                .eq("company_id", company_id)
                .limit(1)
                .execute()
            )
            row_for_update = existing_row.data[0] if existing_row.data else None

            if row_for_update:
                update_result = (
                    supabase.table("chat_history")
                    .update(
                        {
                            **payload,
                            # 프론트가 현재 대화 전체 history를 함께 보내므로, 해당 snapshot으로 세션을 갱신한다.
                            "chat_history": persisted_history[-60:],
                            "created_at": datetime.now().isoformat(),
                        }
                    )
                    .eq("chat_id", current_chat_id)
                    .eq("company_id", company_id)
                    .execute()
                )
                if update_result.data:
                    state["chat_id"] = _extract_chat_id(update_result.data[0]) or current_chat_id
                else:
                    state["chat_id"] = current_chat_id
            else:
                insert_result = supabase.table("chat_history").insert(
                    {
                        **payload,
                        "chat_history": persisted_history[-60:],
                        "created_at": datetime.now().isoformat(),
                    }
                ).execute()
                if insert_result.data:
                    state["chat_id"] = _extract_chat_id(insert_result.data[0]) or current_chat_id
                else:
                    state["chat_id"] = current_chat_id
        else:
            insert_result = supabase.table("chat_history").insert(
                {
                    **payload,
                    "chat_history": persisted_history[-60:],
                    "created_at": datetime.now().isoformat(),
                }
            ).execute()
            if insert_result.data:
                state["chat_id"] = _extract_chat_id(insert_result.data[0])
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
