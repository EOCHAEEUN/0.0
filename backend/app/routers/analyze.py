from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.agents.policy import (
    evaluate_and_rerank_with_llm,
    format_raw_policy_candidate,
    get_policy_raw_candidates,
    merge_policy_candidates,
    policy_matching_node,
    rank_candidates_by_query,
    rerank_policies_with_roi,
    resolve_scenario_policy_support,
)
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.auth import CurrentUser
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.state import FactofitState
from app.tools.query_builder import build_policy_queries_from_roi
from app.tools.roi_calc import calculate_roi


router = APIRouter()


# ============================================================================
# 공통 형식 유틸리티
# ============================================================================

def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _first_value(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _first_text(*values: Any) -> str:
    value = _first_value(*values)
    return "" if value is None else str(value)


def _policy_value(policy: dict, key: str, default: Any = None) -> Any:
    if policy.get(key) is not None:
        return policy.get(key)

    metadata = _as_dict(policy.get("metadata"))
    if metadata.get(key) is not None:
        return metadata.get(key)

    return default


def _policy_id(policy: dict) -> Any:
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
    """DB row/re-ranked policy를 프론트 공통 형태로 정규화한다."""
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
    formatted = format_raw_policy_candidate(policy)
    return _format_policy_for_frontend({**policy, **formatted})


def _score_to_percent(policy: dict) -> int:
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


def _snapshot_optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _snapshot_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _snapshot_json_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _build_snapshot_policy_item(
    matched_policy: dict,
    policy_detail: Optional[dict],
) -> dict:
    policy_detail = policy_detail or {}
    policy_id = _first_text(
        _policy_id(matched_policy),
        policy_detail.get("policy_id"),
        policy_detail.get("id"),
    )
    required_documents_json = _snapshot_json_list(
        policy_detail.get("required_documents_json")
    )
    support_items = _snapshot_json_list(policy_detail.get("support_items"))
    max_amount_numeric = _first_value(
        policy_detail.get("max_amount"),
        matched_policy.get("max_amount"),
    )

    return {
        "policy_id": policy_id,
        "title": _first_text(
            matched_policy.get("title"),
            policy_detail.get("title"),
        ),
        "organization": _snapshot_optional_text(
            _first_value(
                matched_policy.get("organization"),
                policy_detail.get("organization"),
                policy_detail.get("agency"),
                policy_detail.get("provider"),
            )
        ),
        "match_score": _score_to_percent(matched_policy),
        "llm_score": _snapshot_optional_text(matched_policy.get("llm_score")),
        "eligible": matched_policy.get("eligible", True),
        "reason": _snapshot_optional_text(matched_policy.get("reason")),
        "scenario_match": matched_policy.get("scenario_match"),
        "scenario_label": _snapshot_optional_text(
            matched_policy.get("scenario_label")
        ),
        "summary": _snapshot_optional_text(
            _first_value(
                matched_policy.get("summary"),
                policy_detail.get("summary"),
            )
        ),
        "eligibility_text": _snapshot_optional_text(
            policy_detail.get("eligibility_text")
        ),
        "required_documents_json": required_documents_json,
        "required_documents_count": _snapshot_int(
            policy_detail.get("required_documents_count"),
            default=len(required_documents_json),
        ),
        "support_items": support_items,
        "max_amount_actual": _snapshot_optional_text(
            policy_detail.get("max_amount_actual")
        ),
        "max_amount_numeric_manwon": _snapshot_int(max_amount_numeric),
        "deadline": _snapshot_optional_text(
            _first_value(
                matched_policy.get("deadline"),
                policy_detail.get("deadline"),
            )
        ),
        "deadline_display": _snapshot_optional_text(
            _first_value(
                matched_policy.get("deadline_display"),
                policy_detail.get("deadline_display"),
            )
        ),
        "url": _snapshot_optional_text(
            _first_value(
                matched_policy.get("url"),
                policy_detail.get("url"),
                policy_detail.get("source_url"),
            )
        ),
        "policy_category": _snapshot_optional_text(
            _first_value(
                matched_policy.get("policy_category"),
                policy_detail.get("policy_category"),
            )
        ),
        "policy_subcategory": _snapshot_optional_text(
            _first_value(
                matched_policy.get("policy_subcategory"),
                policy_detail.get("policy_subcategory"),
            )
        ),
        "source_name": _snapshot_optional_text(policy_detail.get("source_name")),
        "safety_justification_usable": _snapshot_optional_text(
            policy_detail.get("safety_justification_usable")
        ),
    }


def _build_policy_snapshot(
    *,
    analysis_id: str,
    company_id: str,
    equipment_id: str,
    matched_policies: list[dict],
    policy_details: dict[str, dict],
) -> dict:
    policies: list[dict] = []
    for matched_policy in matched_policies:
        policy_id = _first_text(
            _policy_id(matched_policy),
            matched_policy.get("policy_id"),
            matched_policy.get("id"),
        )
        if not policy_id:
            continue
        normalized_id = str(policy_id).strip()
        policy_detail = policy_details.get(normalized_id)
        policies.append(
            _build_snapshot_policy_item(matched_policy, policy_detail)
        )

    return {
        "snapshot_version": 1,
        "captured_at": datetime.now().isoformat(),
        "analysis_id": analysis_id,
        "company_id": company_id,
        "equipment_id": equipment_id,
        "policy_status": "empty" if not policies else "ready",
        "recommended_policy_id": policies[0]["policy_id"] if policies else None,
        "counts": {"matched": len(policies)},
        "policies": policies,
    }


def _fetch_policy_details_for_snapshot(
    db: Any,
    policy_ids: list[Any],
) -> dict[str, dict]:
    unique_ids: list[str] = []
    seen: set[str] = set()
    for policy_id in policy_ids:
        normalized = "" if policy_id is None else str(policy_id).strip()
        if normalized and normalized not in seen:
            unique_ids.append(normalized)
            seen.add(normalized)

    if not unique_ids:
        return {}

    try:
        result = (
            db.table("policy")
            .select(
                "policy_id,title,organization,agency,provider,summary,"
                "eligibility_text,required_documents_json,required_documents_count,"
                "support_items,max_amount,max_amount_actual,deadline,deadline_display,"
                "url,source_url,policy_category,policy_subcategory,source_name,"
                "safety_justification_usable"
            )
            .in_("policy_id", unique_ids)
            .execute()
        )
        return {
            str(row.get("policy_id")).strip(): row
            for row in (result.data or [])
            if isinstance(row, dict) and str(row.get("policy_id") or "").strip()
        }
    except Exception as exc:
        print(f"policy 상세정보 snapshot 조회 실패: {exc}")
        return {}


# ============================================================================
# ROI 분석 + 정책 매칭 + 정책 반영 최종 ROI
# LangGraph는 사용하거나 수정하지 않는다.
# ============================================================================

@router.post("/analyze")
async def analyze(
    company_id: str,
    equipment_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    # 1. 현재 로그인 사용자가 소유한 기업 조회
    company_result = (
        db.table("company")
        .select("*")
        .eq("company_id", company_id)
        .eq("user_id", current_user.id)
        .execute()
    )
    if not company_result.data:
        return {"success": False, "message": "기업 정보를 찾을 수 없습니다."}

    company_row = company_result.data[0]
    if isinstance(company_row.get("industry_code"), str):
        company_row["industry_code"] = [
            code.strip()
            for code in company_row["industry_code"].split(",")
            if code.strip()
        ]

    company = CompanyContext(
        company_id=company_row.get("company_id"),
        company_name=company_row.get("company_name", ""),
        industry_code=company_row.get("industry_code", []),
        region=company_row.get("region", ""),
        company_type=company_row.get("company_type"),
        employee_count=company_row.get("employee_count"),
        annual_revenue=company_row.get("annual_revenue"),
        energy_cost_annual=company_row.get("energy_cost_annual"),
    )
    company_context = {
        "industry_code": company.industry_code or [],
        "region": company.region or "",
        "company_type": company.company_type or "",
        "employee_count": company.employee_count,
        "annual_revenue": company.annual_revenue,
    }

    # 2. 설비 조회
    equipment_query = (
        db.table("equipment")
        .select("*")
        .eq("company_id", company_id)
    )
    if equipment_id:
        equipment_query = equipment_query.eq("equipment_id", equipment_id)

    equipment_result = equipment_query.execute()
    if not equipment_result.data:
        return {"success": False, "message": "설비 정보를 찾을 수 없습니다."}

    equipment_row = equipment_result.data[0]
    equipment_id = equipment_row.get("equipment_id")

    raw_energy = equipment_row.get("energy_cost_annual")
    try:
        energy_provided = raw_energy is not None and float(raw_energy) > 0
    except (TypeError, ValueError):
        energy_provided = False

    equipment = EquipmentInput(
        name=equipment_row.get("name", ""),
        category=equipment_row.get("category", ""),
        age_years=equipment_row.get("age_years", 0),
        energy_cost_annual=raw_energy if energy_provided else 0,
        defect_rate=equipment_row.get("defect_rate"),
        maintenance_cost_annual=equipment_row.get("maintenance_cost_annual"),
        current_capacity_value=equipment_row.get("current_capacity_value"),
        production_qty=equipment_row.get("production_qty"),
        process=equipment_row.get("process"),
        contribution_margin_won=equipment_row.get("contribution_margin_won"),
        scenario_a_investment_manwon=equipment_row.get("scenario_a_investment_manwon"),
        scenario_b_investment_manwon=equipment_row.get("scenario_b_investment_manwon"),
    )

    # 3. 기초 시나리오 계산: 정책 지원금 0원 기준
    # 정책 검색 키워드를 만들기 위한 계산이며, 프론트 최종 결과로 쓰지 않는다.
    print(
        "[ROI_UNIT_CHECK]",
        {
            "equipment_id": equipment_id,
            "energy_cost_annual_manwon": equipment.energy_cost_annual,
            "maintenance_cost_annual_manwon": equipment.maintenance_cost_annual,
            "scenario_a_investment_manwon": equipment.scenario_a_investment_manwon,
            "scenario_b_investment_manwon": equipment.scenario_b_investment_manwon,
        },
    )
    try:
        base_roi_result = calculate_roi(
            equipment,
            energy_provided=energy_provided,
            policy_applications=None,
        )
    except ValueError as exc:
        return {"success": False, "message": str(exc)}

    # 4. 기존 정책 후보/랭킹 로직 유지
    raw_candidates: list[dict] = []
    matched_policies: list[dict] = []
    queries = {"a": "", "b": ""}
    a_candidates: list[dict] = []
    b_candidates: list[dict] = []
    merged: list[dict] = []
    ranked: list[dict] = []

    policy_status = "success"
    policy_error = None
    policy_stage = "not_started"

    try:
        policy_stage = "raw_candidates"
        raw_candidates = get_policy_raw_candidates(company_context)

        policy_stage = "query_builder"
        queries = build_policy_queries_from_roi(equipment, base_roi_result)

        policy_stage = "rank_a"
        a_candidates = rank_candidates_by_query(
            raw_candidates,
            queries.get("a", ""),
            limit=10,
        )

        policy_stage = "rank_b"
        b_candidates = rank_candidates_by_query(
            raw_candidates,
            queries.get("b", ""),
            limit=10,
        )

        policy_stage = "merge"
        merged = merge_policy_candidates(a_candidates, b_candidates)

        policy_stage = "rerank"
        ranked = rerank_policies_with_roi(merged, base_roi_result)

        policy_stage = "llm_evaluate"
        matched_policies = evaluate_and_rerank_with_llm(
            ranked[:10],
            company_context,
            equipment.name,
            base_roi_result,
        )

        if not raw_candidates:
            policy_status = "empty"
            policy_error = "정책 DB에서 기업 조건에 맞는 1차 후보가 없습니다."
        elif not matched_policies:
            policy_status = "empty"
            policy_error = "정책 후보는 있으나 최종 추천 결과가 없습니다."

    except Exception as exc:
        policy_status = "error"
        policy_error = f"{policy_stage}: {str(exc)}"
        print(f"정책 오케스트레이션 실패[{policy_stage}]: {exc}")

    # 5. A/B별 단 하나의 정책만 실제 지원금으로 반영
    # LLM 실패 시에도 deterministic ranked 후보를 사용해 계산 가능하게 한다.
    policy_pool_for_support = matched_policies or ranked
    policy_applications = {
        "scenario_a": resolve_scenario_policy_support(
            scenario="a",
            investment_manwon=base_roi_result.get("scenario_a", {}).get(
                "investment_manwon"
            ),
            policies=policy_pool_for_support,
            company_context=company_context,
        ),
        "scenario_b": resolve_scenario_policy_support(
            scenario="b",
            investment_manwon=base_roi_result.get("scenario_b", {}).get(
                "investment_manwon"
            ),
            policies=policy_pool_for_support,
            company_context=company_context,
        ),
    }

    # 6. 최종 ROI 계산: 실제 적용 지원금 반영
    roi_result = calculate_roi(
        equipment,
        energy_provided=energy_provided,
        policy_applications=policy_applications,
    )
    roi_result["analysis_metadata"] = {
        "base_recommended": base_roi_result.get("recommended"),
        "final_recommended": roi_result.get("recommended"),
        "policy_application_status": {
            "scenario_a": policy_applications["scenario_a"].get("status"),
            "scenario_b": policy_applications["scenario_b"].get("status"),
        },
    }

    frontend_matched_policies = [
        _format_policy_for_frontend(policy)
        for policy in matched_policies
    ]
    frontend_raw_candidates = [
        _format_raw_policy_candidate_for_frontend(policy)
        for policy in raw_candidates
    ]

    # 7. 기존 분석·초안·매칭을 정리하고 final ROI 저장
    saved_roi_output = None
    try:
        (
            db.table("draft_result")
            .delete()
            .eq("company_id", company_id)
            .eq("equipment_id", equipment_id)
            .execute()
        )
        (
            db.table("matched_policy")
            .delete()
            .eq("company_id", company_id)
            .eq("equipment_id", equipment_id)
            .execute()
        )
        roi_insert_result = (
            db.table("roi_output")
            .insert(
                {
                    "company_id": company_id,
                    "equipment_id": equipment_id,
                    "roi_data": roi_result,
                    "created_at": datetime.now().isoformat(),
                }
            )
            .execute()
        )
        saved_roi_output = roi_insert_result.data[0] if roi_insert_result.data else None
    except Exception as exc:
        print(f"분석 결과 초기화/roi_output 저장 실패: {exc}")
        raise HTTPException(
            status_code=500,
            detail="ROI 분석 결과 저장에 실패했습니다.",
        ) from exc

    analysis_id = saved_roi_output.get("id") if saved_roi_output else None
    if not analysis_id:
        raise HTTPException(
            status_code=500,
            detail="ROI 분석 결과 ID를 확인할 수 없습니다.",
        )
    analysis_id = str(analysis_id)

    policy_ids = [
        policy_id
        for policy in frontend_matched_policies
        if (policy_id := _policy_id(policy) or policy.get("policy_id") or policy.get("id"))
    ]
    policy_details = _fetch_policy_details_for_snapshot(db, policy_ids)
    policy_snapshot = _build_policy_snapshot(
        analysis_id=analysis_id,
        company_id=company_id,
        equipment_id=equipment_id,
        matched_policies=frontend_matched_policies,
        policy_details=policy_details,
    )

    try:
        snapshot_update_result = (
            db.table("roi_output")
            .update({"policy_snapshot": policy_snapshot})
            .eq("id", analysis_id)
            .select("id,policy_snapshot")
            .execute()
        )
        updated_rows = getattr(snapshot_update_result, "data", None) or []
        if not updated_rows:
            raise RuntimeError("policy_snapshot update returned no rows")
        persisted_snapshot = updated_rows[0].get("policy_snapshot")
        if not isinstance(persisted_snapshot, dict) or not persisted_snapshot.get(
            "snapshot_version"
        ):
            raise RuntimeError("policy_snapshot was not persisted")
    except Exception as exc:
        print(f"roi_output policy_snapshot 저장 실패: {exc}")
        raise HTTPException(
            status_code=500,
            detail="정책 스냅샷 저장에 실패했습니다.",
        ) from exc

    if isinstance(saved_roi_output, dict):
        saved_roi_output = {**saved_roi_output, "policy_snapshot": policy_snapshot}

    if frontend_matched_policies:
        try:
            for policy in frontend_matched_policies:
                policy_id = policy.get("id") or policy.get("policy_id")
                if not policy_id:
                    continue

                (
                    db.table("matched_policy")
                    .insert(
                        {
                            "company_id": company_id,
                            "equipment_id": equipment_id,
                            "analysis_id": analysis_id,
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
                    )
                    .execute()
                )
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
            # 프론트가 사용하는 값은 항상 정책 반영 final ROI
            "roi_result": roi_result,
            "policy_applications": roi_result.get("policy_applications", {}),
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
                "base_recommended": base_roi_result.get("recommended"),
                "final_recommended": roi_result.get("recommended"),
                "policy_applications": roi_result.get("policy_applications", {}),
            },
            "analysis_id": analysis_id,
            "roi_output": saved_roi_output,
            "response": response_message,
        },
    }


# ============================================================================
# 지원사업 화면 DB 조회 라우터
# ============================================================================

def normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        if value.startswith("{") and value.endswith("}"):
            value = value[1:-1]
        return [
            item.strip().strip('"').strip("'")
            for item in value.split(",")
            if item.strip()
        ]
    return []


def get_first_row(result: Any) -> Optional[dict]:
    data = getattr(result, "data", None)
    if isinstance(data, list) and data:
        return data[0]
    return data if isinstance(data, dict) else None


def get_policy_id(policy: dict) -> str:
    metadata = _as_dict(policy.get("metadata"))
    return str(
        policy.get("policy_id")
        or policy.get("id")
        or metadata.get("policy_id")
        or metadata.get("id")
        or ""
    )


def get_policy_title(policy: dict) -> str:
    metadata = _as_dict(policy.get("metadata"))
    return str(
        policy.get("title")
        or metadata.get("title")
        or policy.get("name")
        or metadata.get("name")
        or ""
    )


def get_match_score(policy: dict) -> float:
    try:
        if policy.get("match_score") is not None:
            return round(float(policy.get("match_score")), 3)
        return round(1 - float(policy.get("distance", 1)), 3)
    except (TypeError, ValueError):
        return 0.0


def normalize_policy_id(value: Any) -> str:
    return "" if value is None else str(value).strip()


def fetch_policy_details_by_ids(
    db: Any,
    policy_ids: list[Any],
) -> dict[str, dict]:
    unique_ids: list[str] = []
    seen: set[str] = set()
    for policy_id in policy_ids:
        normalized = normalize_policy_id(policy_id)
        if normalized and normalized not in seen:
            unique_ids.append(normalized)
            seen.add(normalized)

    if not unique_ids:
        return {}

    try:
        result = (
            db.table("policy")
            .select("*")
            .in_("policy_id", unique_ids)
            .execute()
        )
        return {
            normalize_policy_id(row.get("policy_id") or row.get("id")): row
            for row in (result.data or [])
            if isinstance(row, dict)
            and normalize_policy_id(row.get("policy_id") or row.get("id"))
        }
    except Exception as exc:
        print(f"policy 상세정보 조회 실패: {exc}")
        return {}


def saved_policy_to_response(
    row: dict,
    policy_detail: Optional[dict] = None,
) -> dict:
    policy_detail = policy_detail or {}
    policy_metadata = dict(_as_dict(policy_detail.get("metadata")))
    row_metadata = dict(_as_dict(row.get("metadata")))

    policy_id = normalize_policy_id(
        row.get("policy_id")
        or policy_detail.get("policy_id")
        or policy_detail.get("id")
    )
    reason = (
        row.get("reason")
        or row_metadata.get("reason")
        or policy_detail.get("reason")
    )
    llm_score = (
        row.get("llm_score")
        or row_metadata.get("llm_score")
        or policy_detail.get("llm_score")
    )
    scenario_match = (
        row.get("scenario_match")
        or row_metadata.get("scenario_match")
        or policy_detail.get("scenario_match")
    )
    scenario_label = (
        row.get("scenario_label")
        or row_metadata.get("scenario_label")
        or policy_detail.get("scenario_label")
    )
    match_score = (
        row.get("match_score")
        if row.get("match_score") is not None
        else row_metadata.get("match_score")
        if row_metadata.get("match_score") is not None
        else policy_detail.get("match_score")
    )

    merged_metadata = {
        **policy_metadata,
        **row_metadata,
        "policy_id": policy_id,
        "title": (
            row.get("title")
            or policy_detail.get("title")
            or policy_metadata.get("title")
        ),
        "match_score": match_score,
        "eligible": row.get("eligible", True),
        "reason": reason,
        "llm_score": llm_score,
        "scenario_match": scenario_match,
        "scenario_label": scenario_label,
        "matched_policy_created_at": row.get("created_at"),
    }
    merged_policy = {
        **policy_detail,
        "id": policy_id,
        "policy_id": policy_id,
        "title": row.get("title") or policy_detail.get("title"),
        "match_score": match_score,
        "eligible": row.get("eligible", True),
        "reason": reason,
        "llm_score": llm_score,
        "scenario_match": scenario_match,
        "scenario_label": scenario_label,
        "matched_policy_created_at": row.get("created_at"),
        "metadata": merged_metadata,
    }
    return _format_policy_for_frontend(merged_policy)


def _is_empty_policy_snapshot(snapshot: Any) -> bool:
    if not isinstance(snapshot, dict) or not snapshot:
        return True
    if not snapshot.get("snapshot_version"):
        return True
    return False


def _snapshot_policy_item_to_response(item: dict) -> dict:
    policy_id = normalize_policy_id(item.get("policy_id"))
    max_amount = item.get("max_amount_numeric_manwon")
    if max_amount is None:
        max_amount = item.get("max_amount_actual")

    metadata = {
        "policy_id": policy_id,
        "title": item.get("title"),
        "organization": item.get("organization"),
        "match_score": item.get("match_score"),
        "eligible": item.get("eligible", True),
        "reason": item.get("reason"),
        "llm_score": item.get("llm_score"),
        "scenario_match": item.get("scenario_match"),
        "scenario_label": item.get("scenario_label"),
        "summary": item.get("summary"),
        "deadline": item.get("deadline"),
        "deadline_display": item.get("deadline_display"),
        "url": item.get("url"),
        "policy_category": item.get("policy_category"),
        "policy_subcategory": item.get("policy_subcategory"),
        "safety_justification_usable": item.get("safety_justification_usable"),
        "support_items": _snapshot_json_list(item.get("support_items")),
        "required_documents_json": _snapshot_json_list(
            item.get("required_documents_json")
        ),
        "source_name": item.get("source_name"),
        "eligibility_text": item.get("eligibility_text"),
    }
    merged_policy = {
        "id": policy_id,
        "policy_id": policy_id,
        "title": item.get("title"),
        "organization": item.get("organization"),
        "match_score": item.get("match_score"),
        "eligible": item.get("eligible", True),
        "reason": item.get("reason"),
        "llm_score": item.get("llm_score"),
        "scenario_match": item.get("scenario_match"),
        "scenario_label": item.get("scenario_label"),
        "summary": item.get("summary"),
        "eligibility_text": item.get("eligibility_text"),
        "max_amount": max_amount,
        "max_amount_manwon": item.get("max_amount_numeric_manwon"),
        "deadline": item.get("deadline"),
        "deadline_display": item.get("deadline_display"),
        "url": item.get("url"),
        "source_url": item.get("url"),
        "policy_category": item.get("policy_category"),
        "policy_subcategory": item.get("policy_subcategory"),
        "safety_justification_usable": item.get("safety_justification_usable"),
        "support_items": metadata["support_items"],
        "required_documents_json": metadata["required_documents_json"],
        "metadata": metadata,
    }
    return _format_policy_for_frontend(merged_policy)


async def run_policy_node(state: FactofitState) -> FactofitState:
    return await asyncio.wait_for(
        asyncio.to_thread(policy_matching_node, state),
        timeout=90,
    )


@router.get("/analyze/support-projects")
async def get_support_projects(
    company_id: str = Query(...),
    equipment_id: Optional[str] = None,
    analysis_id: Optional[str] = None,
    limit: int = Query(default=10),
    refresh: bool = Query(default=False),
):
    db = get_db()

    if analysis_id:
        try:
            roi_result = (
                db.table("roi_output")
                .select("id,company_id,equipment_id,policy_snapshot")
                .eq("id", analysis_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "분석 결과를 조회하지 못했습니다.",
                    "error": str(exc),
                },
            )

        row = get_first_row(roi_result)
        if not row:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "분석 결과를 찾을 수 없습니다.",
                },
            )

        snapshot = row.get("policy_snapshot")
        if _is_empty_policy_snapshot(snapshot):
            return JSONResponse(
                status_code=409,
                content={
                    "success": False,
                    "message": "이 분석에는 저장된 정책 스냅샷이 없습니다. 해당 시점 정책을 조회할 수 없습니다.",
                    "error_code": "POLICY_SNAPSHOT_MISSING",
                },
            )

        policies_raw = [
            item
            for item in (snapshot.get("policies") or [])
            if isinstance(item, dict) and item.get("policy_id")
        ]
        policies_raw.sort(
            key=lambda item: _snapshot_int(item.get("match_score"), 0),
            reverse=True,
        )
        policies = [
            _snapshot_policy_item_to_response(item)
            for item in policies_raw[:limit]
        ]
        return {
            "success": True,
            "data": {
                "policies": policies,
                "total": len(policies_raw),
                "source": "roi_output_policy_snapshot",
                "analysis_id": analysis_id,
                "policy_status": snapshot.get("policy_status"),
            },
        }

    # 1. 캐시 우선 조회
    if not refresh:
        try:
            saved_query = (
                db.table("matched_policy")
                .select("*")
                .eq("company_id", company_id)
            )
            if equipment_id:
                saved_query = saved_query.eq("equipment_id", equipment_id)

            saved_result = (
                saved_query
                .order("match_score", desc=True)
                .limit(limit)
                .execute()
            )
            saved_rows = getattr(saved_result, "data", []) or []
            if saved_rows:
                details = fetch_policy_details_by_ids(
                    db,
                    [
                        row.get("policy_id")
                        for row in saved_rows
                        if isinstance(row, dict)
                    ],
                )
                policies = [
                    saved_policy_to_response(
                        row,
                        details.get(normalize_policy_id(row.get("policy_id"))),
                    )
                    for row in saved_rows
                    if isinstance(row, dict)
                ]
                return {
                    "success": True,
                    "data": {
                        "policies": policies,
                        "total": len(policies),
                        "source": "matched_policy_cache",
                    },
                }
        except Exception as exc:
            print(f"matched_policy 캐시 조회 실패: {exc}")

    # 2. 기업 조회
    try:
        company_result = (
            db.table("company")
            .select("*")
            .eq("company_id", company_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "기업 정보를 조회하지 못했습니다.",
                "error": str(exc),
            },
        )

    company_row = get_first_row(company_result)
    if not company_row:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "기업 정보를 찾을 수 없습니다.",
            },
        )

    company = CompanyContext(
        company_id=company_row.get("company_id"),
        company_name=company_row.get("company_name") or "",
        business_registration_no=company_row.get("business_registration_no"),
        industry_name=company_row.get("industry_name"),
        industry_code=normalize_list(company_row.get("industry_code")),
        region=company_row.get("region") or "",
        company_type=company_row.get("company_type"),
        primary_purpose=normalize_list(company_row.get("primary_purpose")),
        employee_count=company_row.get("employee_count"),
        annual_revenue=company_row.get("annual_revenue"),
        revenue_2y_ago_manwon=company_row.get("revenue_2y_ago_manwon"),
        revenue_3y_ago_manwon=company_row.get("revenue_3y_ago_manwon"),
        total_assets_manwon=company_row.get("total_assets_manwon"),
        is_disclosure_group_member=company_row.get("is_disclosure_group_member"),
        established_year=company_row.get("established_year"),
        workplace_type=company_row.get("workplace_type"),
        created_at=company_row.get("created_at"),
        updated_at=company_row.get("updated_at"),
    )

    # 3. 기존 policy_matching_node 호출. graph.py는 전혀 수정하지 않는다.
    state: FactofitState = {
        "user_query": "제조설비 지원사업",
        "intent": "policy",
        "is_safe": True,
        "company_info": company,
        "equipment": None,
        "equipment_id": equipment_id,
        "equipments": [],
        "selected_equipment_id": equipment_id,
        "policy_intent_choice": None,
        "selected_equipment_for_policy": None,
        "matched_policies": [],
        "selected_policy": None,
        "roi_result": None,
        "draft_result": None,
        "draft_context": None,
        "chat_history": [],
        "final_response": "",
        "unsupported_equipment": False,
        "chat_id": None,
        "safety_dashboard": None,
        "options": None,
    }

    try:
        result_state = await run_policy_node(state)
    except asyncio.TimeoutError:
        return {
            "success": True,
            "data": {
                "policies": [],
                "total": 0,
                "saved_count": 0,
                "source": "policy_timeout_fallback",
                "message": "지원사업 추천 처리 시간이 오래 걸려 임시로 빈 결과를 반환했습니다.",
            },
        }
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "지원사업 추천 노드 실행 실패",
                "error": str(exc),
            },
        )

    matched = result_state.get("matched_policies", []) or []
    limited = [
        _format_policy_for_frontend(policy)
        for policy in matched[:limit]
        if isinstance(policy, dict)
    ]

    # 4. 새 검색 결과 캐시 저장
    try:
        delete_query = (
            db.table("matched_policy")
            .delete()
            .eq("company_id", company_id)
        )
        if equipment_id:
            delete_query = delete_query.eq("equipment_id", equipment_id)
        delete_query.execute()
    except Exception as exc:
        print(f"기존 matched_policy 삭제 실패: {exc}")

    saved_count = 0
    for policy in limited:
        try:
            (
                db.table("matched_policy")
                .insert(
                    {
                        "company_id": company_id,
                        "equipment_id": equipment_id,
                        "policy_id": get_policy_id(policy),
                        "title": get_policy_title(policy),
                        "match_score": get_match_score(policy),
                        "eligible": policy.get("eligible", True),
                        "reason": policy.get("reason", "RAG 유사도 기반 매칭"),
                        "llm_score": policy.get("llm_score", ""),
                        "scenario_match": policy.get("scenario_match"),
                        "scenario_label": policy.get("scenario_label"),
                        "created_at": datetime.now().isoformat(),
                    }
                )
                .execute()
            )
            saved_count += 1
        except Exception as exc:
            print(f"matched_policy 저장 실패: {exc}")

    return {
        "success": True,
        "data": {
            "policies": limited,
            "total": len(matched),
            "saved_count": saved_count,
            "source": "policy_matching_node",
        },
    }


# ============================================================================
# 정책 요약 라우터
# ============================================================================

def _count_rows(query: Any) -> int:
    result = query.execute()
    count = getattr(result, "count", None)
    if isinstance(count, int):
        return count

    data = getattr(result, "data", None)
    return len(data) if isinstance(data, list) else 0


def _is_active_policy(row: dict, today: date) -> bool:
    metadata = _as_dict(row.get("metadata"))
    raw_deadline = _first_value(
        row.get("deadline"),
        row.get("deadline_display"),
        row.get("end_date"),
        row.get("application_end_date"),
        row.get("reception_end_date"),
        row.get("close_date"),
        row.get("deadline_date"),
        metadata.get("deadline"),
        metadata.get("deadline_display"),
        metadata.get("end_date"),
        metadata.get("application_end_date"),
        metadata.get("reception_end_date"),
        metadata.get("close_date"),
        metadata.get("deadline_date"),
    )

    if raw_deadline is None or str(raw_deadline).strip() in {
        "",
        "None",
        "마감일 미정",
    }:
        return True

    try:
        return date.fromisoformat(str(raw_deadline).strip()[:10]) >= today
    except ValueError:
        return True


@router.get("/analyze/policy-summary")
async def get_policy_summary(
    company_id: str = Query(...),
    equipment_id: Optional[str] = None,
):
    db = get_db()
    today = date.today()

    try:
        total_policy_count = _count_rows(
            db.table("policy").select("*", count="exact")
        )
    except Exception as exc:
        print(f"policy 전체 count 조회 실패: {exc}")
        total_policy_count = 0

    try:
        result = db.table("policy").select("*").execute()
        active_policy_count = sum(
            1
            for row in (result.data or [])
            if isinstance(row, dict) and _is_active_policy(row, today)
        )
    except Exception as exc:
        print(f"policy active count 조회 실패: {exc}")
        active_policy_count = 0

    try:
        matched_query = (
            db.table("matched_policy")
            .select("policy_id", count="exact")
            .eq("company_id", company_id)
        )
        if equipment_id:
            matched_query = matched_query.eq("equipment_id", equipment_id)
        matched_policy_count = _count_rows(matched_query)
    except Exception as exc:
        print(f"matched_policy count 조회 실패: {exc}")
        matched_policy_count = 0

    return {
        "success": True,
        "data": {
            "totalPolicyCount": total_policy_count,
            "activePolicyCount": active_policy_count,
            "matchedPolicyCount": matched_policy_count,
            "priorityPolicyCount": 1 if matched_policy_count > 0 else 0,
            "updatedAt": datetime.now().isoformat(),
            "matchScope": {
                "company_id": company_id,
                "equipment_id": equipment_id,
            },
        },
    }
