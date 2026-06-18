from fastapi import APIRouter, Query
from app.core.database import get_db
from app.models.company import CompanyContext
from app.agents.policy import policy_matching_node
from app.state import FactofitState
from datetime import date, datetime

router = APIRouter()

@router.get("/policies")
async def get_policies(company_id: str = Query(...), limit: int = Query(default=10)):
    db = get_db()

    # 1. DB에서 기업 정보 조회
    company_data = db.table("company").select("*").eq("company_id", company_id).execute()
    if not company_data.data:
        return {"success": False, "message": "기업 정보를 찾을 수 없습니다."}

    data = company_data.data[0]
    if isinstance(data.get("industry_code"), str):
        data["industry_code"] = [c.strip() for c in data["industry_code"].split(",")]

    company = CompanyContext(
        company_id=data.get("company_id"),
        company_name=data.get("company_name", ""),
        industry_code=data.get("industry_code", []),
        region=data.get("region", ""),
        company_type=data.get("company_type"),
        employee_count=data.get("employee_count"),
        annual_revenue=data.get("annual_revenue"),
        energy_cost_annual=data.get("energy_cost_annual"),
    )

    # 2. FactofitState 만들어서 policy_matching_node 호출
    state: FactofitState = {
        "user_query": "제조설비 지원사업",
        "intent": "policy",
        "is_safe": True,
        "company_info": company,
        "equipment": None,
        "matched_policies": [],
        "roi_result": None,
        "draft_result": None,
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None
    }

    result_state = policy_matching_node(state)
    matched = result_state.get("matched_policies", [])

    # 3. matched_policy 테이블에 저장
    for policy in matched[:limit]:
        db.table("matched_policy").insert({
            "company_id": company_id,
            "policy_id": policy.get("id", ""),
            "title": policy.get("metadata", {}).get("title", ""),
            "match_score": round(1 - policy.get("distance", 1), 3),
            "eligible": policy.get("eligible", True),
            "reason": policy.get("reason", "RAG 유사도 기반 매칭"),
            "llm_score": policy.get("llm_score", ""),
            "created_at": datetime.now().isoformat()
        }).execute()

    return {
        "success": True,
        "data": {
            "policies": matched[:limit],
            "total": len(matched)
        }
    }