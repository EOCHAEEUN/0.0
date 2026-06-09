from app.state import FactofitState
from app.core.database import get_db
from datetime import datetime
import json


def response_node(state: FactofitState) -> FactofitState:
    if state.get("intent") == "general" and not state.get("final_response"):
        from app.core.llm import llm
        from langchain_core.messages import SystemMessage, HumanMessage

        response = llm.invoke([
            SystemMessage(
                content="당신은 팩토핏 AI 어드바이저입니다. 팩토핏은 제조기업 설비투자 AI 의사결정 에이전트입니다. 친절하게 서비스를 소개해주세요."
            ),
            HumanMessage(content=state["user_query"])
        ])
        state["final_response"] = response.content

    supabase = get_db()
    company = state.get("company_info")
    company_id = company.company_id if company and company.company_id else None

    # chat_history 테이블에 저장
    try:
        insert_result = supabase.table("chat_history").insert({
            "company_id": company_id,
            "intent": state.get("intent", ""),
            "user_query": state.get("user_query", ""),
            "chat_history": state.get("chat_history", []),
            "roi_result": state.get("roi_result"),
            "matched_policies": state.get("matched_policies", []),
            "final_response": state.get("final_response", ""),
            "created_at": datetime.now().isoformat()
        }).execute()

        if insert_result.data and len(insert_result.data) > 0:
            state["chat_id"] = insert_result.data[0].get("chat_id")

    except Exception as e:
        print(f"chat_history 저장 실패: {e}")

    # draft intent면 draft_result 테이블에도 저장
    if state.get("intent") == "draft" and state.get("draft_result"):
        try:
            matched_policies = state.get("matched_policies", [])
            policy_id = matched_policies[0].get("id", "") if matched_policies else ""

            supabase.table("draft_result").insert({
                "company_id": company_id,
                "policy_id": policy_id,
                "draft_content": state.get("draft_result", ""),
                "created_at": datetime.now().isoformat()
            }).execute()

        except Exception as e:
            print(f"draft_result 저장 실패: {e}")

    # roi_result 있으면 roi_output 테이블에 저장
    if state.get("roi_result"):
        try:
            supabase.table("roi_output").insert({
                "company_id": company_id,
                "roi_data": state["roi_result"],
                "created_at": datetime.now().isoformat()
            }).execute()

        except Exception as e:
            print(f"roi_output 저장 실패: {e}")

    # roi_input 저장
    if state.get("equipment") and state.get("intent") == "roi":
        try:
            eq = state["equipment"].equipment
            roi = state["equipment"]

            supabase.table("roi_input").insert({
                "company_id": company_id,
                "equipment_name": eq.name,
                "category": eq.category,
                "age_years": eq.age_years,
                "energy_cost_annual": eq.energy_cost_annual,
                "defect_rate": eq.defect_rate,
                "new_energy_cost_annual": eq.new_energy_cost_annual,
                "maintenance_cost_annual": eq.maintenance_cost_annual,
                "capacity_value": eq.capacity_value,
                "production_qty": eq.production_qty,
                "contribution_margin_won": eq.contribution_margin_won,
                "scenario_a_investment_manwon": roi.scenario_a_investment_manwon,
                "scenario_a_subsidy_manwon": roi.scenario_a_subsidy_manwon,
                "scenario_b_investment_manwon": roi.scenario_b_investment_manwon,
                "scenario_b_subsidy_manwon": roi.scenario_b_subsidy_manwon,
                "created_at": datetime.now().isoformat()
            }).execute()

        except Exception as e:
            print(f"roi_input 저장 실패: {e}")

    # matched_policies 있으면 matched_policy 테이블에 저장
    if state.get("matched_policies"):
        try:
            for policy in state.get("matched_policies", []):
                supabase.table("matched_policy").insert({
                    "company_id": company_id,
                    "policy_id": policy.get("id", ""),
                    "title": policy.get("metadata", {}).get("title", ""),
                    "match_score": round(1 - policy.get("distance", 1), 3),
                    "eligible": True,
                    "reason": "RAG 유사도 기반 매칭",
                    "created_at": datetime.now().isoformat()
                }).execute()

        except Exception as e:
            print(f"matched_policy 저장 실패: {e}")

    return state