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


def _as_dict(value):
    """Return a safe dictionary for policy/metadata objects."""
    return value if isinstance(value, dict) else {}


def _first_value(*values):
    """Return the first non-empty value without changing its original type."""
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _first_text(*values) -> str:
    """Return the first non-empty value as text."""
    value = _first_value(*values)
    return "" if value is None else str(value)


def _policy_value(policy: dict, key: str, default=None):
    """Read a policy field from top-level first, then metadata."""
    if key in policy and policy.get(key) is not None:
        return policy.get(key)

    metadata = _as_dict(policy.get("metadata"))
    if key in metadata and metadata.get(key) is not None:
        return metadata.get(key)

    return default


def _policy_id(policy: dict):
    metadata = _as_dict(policy.get("metadata"))
    return _first_value(
        policy.get("policy_id"),
        policy.get("id"),
        policy.get("matched_policy_id"),
        policy.get("import_row_id"),
        metadata.get("policy_id"),
        metadata.get("id"),
        metadata.get("matched_policy_id"),
        metadata.get("import_row_id"),
    )


def _format_policy_for_frontend(policy: dict) -> dict:
    """
    Normalize policy rows/re-ranked policy objects for frontend display.

    DB public.policy has:
      - url
      - summary
      - raw_text
      - created_at
    Frontend/detail dialog can read:
      - url/source_url/policy_url
      - summary/description/content/support_content
      - posted_date/created_at

    This function keeps the original policy object and adds aliases so the
    support page can render actual detail content without changing its UI.
    """
    metadata = dict(_as_dict(policy.get("metadata")))

    policy_id = _policy_id(policy)
    title = _first_text(
        policy.get("title"),
        metadata.get("title"),
        metadata.get("policy_title"),
        metadata.get("name"),
    )
    organization = _first_text(
        policy.get("organization"),
        policy.get("agency"),
        policy.get("provider"),
        metadata.get("organization"),
        metadata.get("agency"),
        metadata.get("provider"),
    )
    deadline = _first_value(
        policy.get("deadline"),
        policy.get("deadline_display"),
        policy.get("end_date"),
        metadata.get("deadline"),
        metadata.get("deadline_display"),
        metadata.get("end_date"),
    )
    max_amount = _first_value(
        policy.get("max_amount"),
        policy.get("max_amount_manwon"),
        policy.get("support_amount"),
        policy.get("subsidy_amount"),
        policy.get("support_limit"),
        metadata.get("max_amount"),
        metadata.get("max_amount_manwon"),
        metadata.get("support_amount"),
        metadata.get("subsidy_amount"),
        metadata.get("support_limit"),
    )
    url = _first_text(
        policy.get("url"),
        policy.get("source_url"),
        policy.get("policy_url"),
        policy.get("notice_url"),
        policy.get("homepage_url"),
        metadata.get("url"),
        metadata.get("source_url"),
        metadata.get("policy_url"),
        metadata.get("notice_url"),
        metadata.get("homepage_url"),
    )
    summary = _first_text(
        policy.get("summary"),
        policy.get("support_summary"),
        policy.get("description"),
        metadata.get("summary"),
        metadata.get("support_summary"),
        metadata.get("description"),
    )
    raw_text = _first_text(
        policy.get("raw_text"),
        policy.get("content"),
        policy.get("support_content"),
        policy.get("supportContent"),
        metadata.get("raw_text"),
        metadata.get("content"),
        metadata.get("support_content"),
        metadata.get("supportContent"),
    )
    content = _first_text(raw_text, summary)
    support_content = _first_text(summary, raw_text)

    created_at = _first_value(
        policy.get("posted_date"),
        policy.get("posted_at"),
        policy.get("registered_at"),
        policy.get("notice_date"),
        policy.get("created_at"),
        metadata.get("posted_date"),
        metadata.get("posted_at"),
        metadata.get("registered_at"),
        metadata.get("notice_date"),
        metadata.get("created_at"),
    )

    policy_category = _first_text(
        policy.get("policy_category"),
        policy.get("category"),
        policy.get("service_category"),
        metadata.get("policy_category"),
        metadata.get("category"),
        metadata.get("service_category"),
        "지원사업",
    )
    policy_subcategory = _first_value(
        policy.get("policy_subcategory"),
        policy.get("subcategory"),
        metadata.get("policy_subcategory"),
        metadata.get("subcategory"),
    )

    enriched_metadata = {
        **metadata,
        "policy_id": policy_id,
        "title": title,
        "organization": organization,
        "deadline": deadline,
        "max_amount": max_amount,
        "url": url,
        "source_url": url,
        "policy_url": url,
        "summary": summary,
        "description": summary or content,
        "content": content,
        "support_content": support_content,
        "posted_date": created_at,
        "created_at": created_at,
        "policy_category": policy_category,
        "policy_subcategory": policy_subcategory,
    }

    return {
        **policy,
        "policy_id": policy_id,
        "id": policy.get("id") or policy_id,
        "title": title,
        "organization": organization,
        "deadline": deadline,
        "max_amount": max_amount,
        "url": url,
        "source_url": url,
        "policy_url": url,
        "summary": summary,
        "description": summary or content,
        "content": content,
        "support_content": support_content,
        "posted_date": created_at,
        "created_at": created_at,
        "policy_category": policy_category,
        "policy_subcategory": policy_subcategory,
        "metadata": enriched_metadata,
    }


def _format_raw_policy_candidate_for_frontend(policy: dict) -> dict:
    """
    Keep existing raw-candidate shape and add detail fields for the support page.
    """
    formatted = format_raw_policy_candidate(policy)
    merged = {**policy, **formatted}
    return _format_policy_for_frontend(merged)


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

    frontend_matched_policies = [
        _format_policy_for_frontend(policy)
        for policy in matched_policies
    ]
    frontend_raw_candidates = [
        _format_raw_policy_candidate_for_frontend(policy)
        for policy in raw_candidates
    ]

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

    if frontend_matched_policies:
        try:
            db.table("matched_policy").delete().eq("company_id", company_id).eq(
                "equipment_id",
                equipment_id,
            ).execute()

            for policy in frontend_matched_policies:
                policy_id = policy.get("id") or policy.get("policy_id") or None

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
            "matched_policies": frontend_matched_policies,
            "policies": frontend_matched_policies,
            "raw_candidates": frontend_raw_candidates,
            "total_candidates": len(raw_candidates),
            "response": "ROI 계산 및 정책 추천이 완료되었습니다.",
        },
    }
