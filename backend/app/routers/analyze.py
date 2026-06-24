from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query

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
    reason = _first_text(
        policy.get("reason"),
        metadata.get("reason"),
        policy.get("scenario_label"),
        metadata.get("scenario_label"),
        "업종·지역·설비 정보와 정책 조건을 기준으로 추천되었습니다.",
    )
    llm_score = _first_value(
        policy.get("llm_score"),
        metadata.get("llm_score"),
        "●●●○○",
    )
    scenario_match = _first_value(
        policy.get("scenario_match"),
        metadata.get("scenario_match"),
    )
    scenario_label = _first_value(
        policy.get("scenario_label"),
        metadata.get("scenario_label"),
    )
    match_score = _first_value(
        policy.get("match_score"),
        policy.get("hybrid_score"),
        policy.get("final_score"),
        metadata.get("match_score"),
        metadata.get("hybrid_score"),
        metadata.get("final_score"),
    )
    hybrid_score = _first_value(
        policy.get("hybrid_score"),
        metadata.get("hybrid_score"),
    )
    final_score = _first_value(
        policy.get("final_score"),
        metadata.get("final_score"),
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
        "reason": reason,
        "llm_score": llm_score,
        "scenario_match": scenario_match,
        "scenario_label": scenario_label,
        "match_score": match_score,
        "hybrid_score": hybrid_score,
        "final_score": final_score,
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
        "reason": reason,
        "llm_score": llm_score,
        "scenario_match": scenario_match,
        "scenario_label": scenario_label,
        "match_score": match_score,
        "hybrid_score": hybrid_score,
        "final_score": final_score,
        "metadata": enriched_metadata,
    }


def _format_raw_policy_candidate_for_frontend(policy: dict) -> dict:
    """Keep existing raw-candidate shape and add detail fields for the support page."""
    formatted = format_raw_policy_candidate(policy)
    merged = {**policy, **formatted}
    return _format_policy_for_frontend(merged)


def _score_to_percent(policy: dict) -> int:
    """
    Convert policy score to 0~100 integer for matched_policy storage.

    hybrid_score/final_score/distance are usually 0~1 scale.
    If a score already looks like 0~100, keep it as percent.
    """
    value = policy.get(
        "hybrid_score",
        policy.get(
            "final_score",
            round(1 - policy.get("distance", 1), 3),
        ),
    )

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = 0

    if numeric <= 1:
        numeric *= 100

    return int(max(0, min(100, round(numeric))))


@router.post("/analyze")
async def analyze(
    company_id: str,
    equipment_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    # ------------------------------------------------------------------
    # 1. Company 조회
    # ------------------------------------------------------------------
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

    company_context = {
        "industry_code": company.industry_code or [],
        "region": company.region or "",
        "company_type": company.company_type or "",
        "employee_count": company.employee_count,
        "annual_revenue": company.annual_revenue,
    }

    # ------------------------------------------------------------------
    # 2. Equipment 조회
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # 3. ROI 계산
    # ------------------------------------------------------------------
    try:
        roi_result = calculate_roi(equipment)
    except ValueError as exc:
        return {"success": False, "message": str(exc)}

    # ------------------------------------------------------------------
    # 4. 정책 후보/추천
    #
    # 기존 코드 문제:
    # - 정책 오케스트레이션 실패 시 except에서 에러를 삼키고 success:true로 응답
    # - raw_candidates가 몇 개인지, 어느 단계에서 실패했는지 프론트에서 확인 불가
    #
    # 수정:
    # - 단계별 count/debug 응답 추가
    # - raw_candidates 조회 성공 후 이후 단계가 실패해도 raw_candidates는 응답에 유지
    # - matched_policy DB 삭제는 추천 결과 유무와 상관없이 실행
    # ------------------------------------------------------------------
    raw_candidates = []
    matched_policies = []
    queries = {"a": "", "b": ""}
    a_candidates = []
    b_candidates = []
    merged = []
    ranked = []

    policy_status = "success"
    policy_error = None
    policy_stage = "not_started"

    try:
        policy_stage = "raw_candidates"
        raw_candidates = get_policy_raw_candidates(company_context)
        print("[analyze] company_context:", company_context)
        print("[analyze] raw_candidates count:", len(raw_candidates))

        policy_stage = "query_builder"
        queries = build_policy_queries_from_roi(equipment, roi_result)
        print("[analyze] policy queries:", queries)

        policy_stage = "rank_a"
        a_candidates = rank_candidates_by_query(
            raw_candidates,
            queries.get("a", ""),
            limit=10,
        )
        print("[analyze] a_candidates count:", len(a_candidates))

        policy_stage = "rank_b"
        b_candidates = rank_candidates_by_query(
            raw_candidates,
            queries.get("b", ""),
            limit=10,
        )
        print("[analyze] b_candidates count:", len(b_candidates))

        policy_stage = "merge"
        merged = merge_policy_candidates(a_candidates, b_candidates)
        print("[analyze] merged count:", len(merged))

        policy_stage = "rerank"
        ranked = rerank_policies_with_roi(merged, roi_result)
        print("[analyze] ranked count:", len(ranked))

        policy_stage = "llm_evaluate"
        matched_policies = evaluate_and_rerank_with_llm(
            ranked[:10],
            company_context,
            equipment.name,
            roi_result,
        )
        print("[analyze] matched_policies count:", len(matched_policies))

        if len(raw_candidates) == 0:
            policy_status = "empty"
            policy_error = "정책 DB에서 기업 조건에 맞는 1차 후보(raw_candidates)가 없습니다."
        elif len(matched_policies) == 0:
            policy_status = "empty"
            policy_error = "1차 후보는 있으나 최종 추천 정책(matched_policies)이 없습니다."

    except Exception as exc:
        policy_status = "error"
        policy_error = f"{policy_stage}: {str(exc)}"
        print(f"정책 오케스트레이션 실패[{policy_stage}]: {exc}")

    frontend_matched_policies = [
        _format_policy_for_frontend(policy)
        for policy in matched_policies
    ]
    frontend_raw_candidates = [
        _format_raw_policy_candidate_for_frontend(policy)
        for policy in raw_candidates
    ]

    # ------------------------------------------------------------------
    # 5. 결과 저장
    # ------------------------------------------------------------------
    try:
        # 같은 company/equipment 기준 기존 결과는 항상 먼저 정리합니다.
        db.table("roi_output").delete().eq("company_id", company_id).eq(
            "equipment_id",
            equipment_id,
        ).execute()

        db.table("draft_result").delete().eq("company_id", company_id).eq(
            "equipment_id",
            equipment_id,
        ).execute()

        db.table("matched_policy").delete().eq("company_id", company_id).eq(
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
        print(f"분석 결과 초기화/roi_output 저장 실패: {exc}")

    if frontend_matched_policies:
        try:
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
                        "match_score": _score_to_percent(policy),
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

    if policy_status == "success":
        response_message = "ROI 계산 및 정책 추천이 완료되었습니다."
    elif policy_status == "empty":
        response_message = "ROI 계산은 완료되었지만 조건에 맞는 정책 추천 결과가 없습니다."
    else:
        response_message = "ROI 계산은 완료되었지만 정책 추천 중 오류가 발생했습니다."

    return {
        "success": True,
        "data": {
            "roi_result": roi_result,
            "matched_policies": frontend_matched_policies,
            "policies": frontend_matched_policies,
            "raw_candidates": frontend_raw_candidates,
            "total_candidates": len(raw_candidates),
            "policy_status": policy_status,
            "policy_error": policy_error,
            "policy_debug": {
                "stage": policy_stage,
                "company_context": company_context,
                "queries": queries,
                "raw_candidates_count": len(raw_candidates),
                "a_candidates_count": len(a_candidates),
                "b_candidates_count": len(b_candidates),
                "merged_count": len(merged),
                "ranked_count": len(ranked),
                "matched_policies_count": len(matched_policies),
            },
            "response": response_message,
        },
    }


def _policy_rows_by_id(db, policy_ids: list[str]) -> dict[str, dict]:
    if not policy_ids:
        return {}

    try:
        result = (
            db.table("policy")
            .select("*")
            .in_("policy_id", policy_ids)
            .execute()
        )
    except Exception as exc:
        print(f"policy detail lookup failed: {exc}")
        return {}

    return {
        str(row.get("policy_id")): row
        for row in (getattr(result, "data", None) or [])
        if row.get("policy_id")
    }


def _format_cached_policy_for_frontend(row: dict, policy_detail: dict | None = None) -> dict:
    detail = policy_detail or {}
    metadata = {
        **detail,
        **row,
        "policy_id": row.get("policy_id"),
        "title": row.get("title") or detail.get("title"),
        "reason": row.get("reason"),
        "match_score": row.get("match_score"),
        "llm_score": row.get("llm_score"),
        "scenario_match": row.get("scenario_match"),
        "scenario_label": row.get("scenario_label"),
    }
    merged = {
        **detail,
        **row,
        "id": row.get("policy_id"),
        "policy_id": row.get("policy_id"),
        "title": row.get("title") or detail.get("title"),
        "metadata": metadata,
    }
    return _format_policy_for_frontend(merged)


@router.get("/policies")
async def get_policies(
    company_id: str = Query(...),
    equipment_id: Optional[str] = None,
    limit: int = Query(default=40),
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    company_result = (
        db.table("company")
        .select("company_id")
        .eq("company_id", company_id)
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )

    if not company_result.data:
        return {
            "success": False,
            "message": "기업 정보를 찾을 수 없습니다.",
            "data": {"policies": [], "total": 0, "source": "matched_policy_cache"},
        }

    matched_query = (
        db.table("matched_policy")
        .select("*")
        .eq("company_id", company_id)
    )
    if equipment_id:
        matched_query = matched_query.eq("equipment_id", equipment_id)

    matched_result = (
        matched_query
        .order("match_score", desc=True)
        .limit(limit)
        .execute()
    )
    matched_rows = getattr(matched_result, "data", None) or []

    policy_ids = [
        str(row.get("policy_id"))
        for row in matched_rows
        if row.get("policy_id")
    ]
    policy_details = _policy_rows_by_id(db, policy_ids)
    policies = [
        _format_cached_policy_for_frontend(
            row,
            policy_details.get(str(row.get("policy_id"))),
        )
        for row in matched_rows
    ]

    return {
        "success": True,
        "data": {
            "policies": policies,
            "matched_policies": policies,
            "total": len(policies),
            "source": "matched_policy_cache",
        },
    }
