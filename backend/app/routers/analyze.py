from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.auth import CurrentUser
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.agents.policy import (
    evaluate_and_rerank_with_llm,
    format_raw_policy_candidate,
    get_policy_raw_candidates,
    merge_policy_candidates,
    rank_candidates_by_query,
    rerank_policies_with_roi,
)
from app.tools.query_builder import build_policy_queries_from_roi
from app.tools.roi_calc import calculate_roi


router = APIRouter()


@router.post("/analyze")
async def analyze(
    company_id: str,
    equipment_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    company_data = (
        db.table("company")
        .select("*")
        .eq("company_id", company_id)
        .eq("user_id", current_user.id)
        .execute()
    )

    if not company_data.data:
        return {"success": False, "message": "기업 정보를 찾을 수 없습니다."}

    data = company_data.data[0]

    if isinstance(data.get("industry_code"), str):
        data["industry_code"] = [
            code.strip()
            for code in data["industry_code"].split(",")
            if code.strip()
        ]

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

    equipment_query = (
        db.table("equipment")
        .select("*")
        .eq("company_id", company_id)
    )

    if equipment_id:
        equipment_query = equipment_query.eq("equipment_id", equipment_id)

    equipment_data = equipment_query.execute()

    if not equipment_data.data:
        return {"success": False, "message": "설비 정보를 찾을 수 없습니다."}

    eq = equipment_data.data[0]
    equipment_id = eq.get("equipment_id")

    equipment = EquipmentInput(
        name=eq.get("name", ""),
        category=eq.get("category", ""),
        age_years=eq.get("age_years", 0),
        energy_cost_annual=eq.get("energy_cost_annual", 0),
        defect_rate=eq.get("defect_rate"),
        maintenance_cost_annual=eq.get("maintenance_cost_annual"),
        current_capacity_value=eq.get("current_capacity_value"),
        production_qty=eq.get("production_qty"),
        process=eq.get("process"),
        contribution_margin_won=eq.get("contribution_margin_won"),
        scenario_a_investment_manwon=eq.get("scenario_a_investment_manwon"),
        scenario_b_investment_manwon=eq.get("scenario_b_investment_manwon"),
    )

    try:
        roi_result = calculate_roi(equipment)
    except ValueError as exc:
        return {"success": False, "message": str(exc)}

    company_context = {
        "industry_code": company.industry_code or [],
        "region": company.region or "",
        "company_type": company.company_type or "",
        "employee_count": company.employee_count,
        "annual_revenue": company.annual_revenue,
    }

    raw_candidates = []
    matched_policies = []

    try:
        raw_candidates = get_policy_raw_candidates(company_context)

        queries = build_policy_queries_from_roi(equipment, roi_result)

        a_candidates = rank_candidates_by_query(
            raw_candidates,
            queries["a"],
            limit=10,
        )
        b_candidates = rank_candidates_by_query(
            raw_candidates,
            queries["b"],
            limit=10,
        )

        merged = merge_policy_candidates(a_candidates, b_candidates)
        ranked = rerank_policies_with_roi(merged, roi_result)

        matched_policies = evaluate_and_rerank_with_llm(
            ranked[:10],
            company_context,
            equipment.name,
            roi_result,
        )

    except Exception as exc:
        print(f"정책 오케스트레이션 실패: {exc}")

    try:
        db.table("roi_output").delete().eq("company_id", company_id).eq(
            "equipment_id",
            equipment_id,
        ).execute()

        db.table("draft_result").delete().eq("company_id", company_id).eq(
            "equipment_id",
            equipment_id,
        ).execute()

        db.table("roi_output").insert(
            {
                "company_id": company_id,
                "equipment_id": equipment_id,
                "roi_data": roi_result,
                "created_at": datetime.now().isoformat(),
            }
        ).execute()

    except Exception as exc:
        print(f"roi_output 저장 실패: {exc}")

    if matched_policies:
        try:
            db.table("matched_policy").delete().eq("company_id", company_id).eq(
                "equipment_id",
                equipment_id,
            ).execute()

            for policy in matched_policies:
                policy_id = policy.get("id") or None

                if not policy_id:
                    continue

                db.table("matched_policy").insert(
                    {
                        "company_id": company_id,
                        "equipment_id": equipment_id,
                        "policy_id": policy_id,
                        "title": policy.get("metadata", {}).get("title", ""),
                        "match_score": int(
                            policy.get(
                                "hybrid_score",
                                policy.get(
                                    "final_score",
                                    round(1 - policy.get("distance", 1), 3),
                                ),
                            ) * 100
                        ),
                        "eligible": policy.get("eligible", True),
                        "reason": (
                            policy.get("reason")
                            or policy.get("scenario_label")
                            or "RAG 매칭"
                        ),
                        "llm_score": policy.get("llm_score", ""),
                        "scenario_match": policy.get("scenario_match"),
                        "scenario_label": policy.get("scenario_label"),
                        "created_at": datetime.now().isoformat(),
                    }
                ).execute()

        except Exception as exc:
            print(f"matched_policy 저장 실패: {exc}")

    return {
        "success": True,
        "data": {
            "roi_result": roi_result,
            "matched_policies": matched_policies,
            "policies": matched_policies,
            "raw_candidates": [
                format_raw_policy_candidate(policy)
                for policy in raw_candidates
            ],
            "total_candidates": len(raw_candidates),
            "response": "ROI 계산 및 정책 추천이 완료되었습니다.",
        },
    }