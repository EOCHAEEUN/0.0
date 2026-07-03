from __future__ import annotations

from datetime import date
from typing import Any

from app.core.database import get_db
from app.services.dashboard_overview import (
    _as_dict,
    _parse_deadline,
    _policy_deadline_raw,
    _resolve_active_analysis_id,
    _safe_number,
    _safe_text,
)
from app.services.support_projects_overview import (
    _deadline_info,
    _fetch_policy_details,
    _merge_matched_policy_row,
    _normalize_match_score,
    _normalize_policy_id,
    _seoul_today,
)


def _display_user_name(
    user_profile: dict[str, Any] | None,
    company: dict[str, Any] | None,
) -> str | None:
    name = _safe_text((user_profile or {}).get("name"))
    if name:
        return name
    company_name = _safe_text((company or {}).get("company_name"))
    return company_name or None


def _recommended_scenario_key(roi_data: dict[str, Any]) -> str:
    recommended = _safe_text(roi_data.get("recommended"), default="A").upper()
    return "b" if recommended == "B" else "a"


def _scenario_record(roi_data: dict[str, Any]) -> dict[str, Any]:
    key = _recommended_scenario_key(roi_data)
    scenario = _as_dict(roi_data.get(f"scenario_{key}"))
    if scenario:
        return scenario
    return _as_dict(roi_data.get("scenario_a"))


def _resolve_subsidy_manwon(active_roi: dict[str, Any] | None) -> tuple[int | None, str]:
    if not active_roi:
        return None, "none"

    roi_data = _as_dict(active_roi.get("roi_data"))
    key = _recommended_scenario_key(roi_data)
    preferred = _safe_number(active_roi.get(f"scenario_{key}_subsidy_manwon"))
    if preferred is not None:
        return int(preferred), "recommended"

    scenario_a = _safe_number(active_roi.get("scenario_a_subsidy_manwon"))
    scenario_b = _safe_number(active_roi.get("scenario_b_subsidy_manwon"))
    candidates = [value for value in (scenario_a, scenario_b) if value is not None]
    if not candidates:
        return None, "none"
    return int(max(candidates)), "max_scenario"


def _resolve_roi_percent(active_roi: dict[str, Any] | None) -> float | None:
    if not active_roi:
        return None

    roi_data = _as_dict(active_roi.get("roi_data"))
    scenario = _scenario_record(roi_data)
    value = _safe_number(
        scenario.get("roi_pct"),
        scenario.get("roi_percent"),
        roi_data.get("roi_pct"),
        roi_data.get("roi_percent"),
    )
    if value is None:
        return None
    return float(value)


def _is_available_policy(policy: dict[str, Any], *, today: date) -> bool:
    if policy.get("eligible") is False:
        return False

    raw = _policy_deadline_raw(policy)
    if not raw:
        return False

    deadline = _parse_deadline(raw)
    if deadline is None:
        return False

    return deadline >= today


def _policy_match_score(policy: dict[str, Any]) -> float:
    score = _normalize_match_score(policy.get("match_score"))
    if score is not None:
        return float(score)
    score = _normalize_match_score(policy.get("llm_score"))
    return float(score or 0)


def _posted_at_sort_key(policy: dict[str, Any]) -> str:
    return _safe_text(policy.get("posted_at"), policy.get("created_at"), default="")


def _build_hero_summary(has_analysis: bool, top_recommendation_title: str | None) -> str:
    if not has_analysis:
        return "설비 정보와 투자 계획을 입력하면 맞춤 정책과 ROI를 안내해드릴게요."
    if top_recommendation_title:
        return (
            f"현재 분석 기준, {top_recommendation_title} 중심의 "
            "투자·지원사업 검토가 추천됩니다."
        )
    return "현재 등록된 기업 및 설비 정보를 바탕으로 지원 가능성을 확인해보세요."


def load_login_briefing(
    *,
    user_id: str,
    analysis_id: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    today = _seoul_today()

    profile_result = (
        db.table("user_profile")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    user_profile = profile_result.data if isinstance(profile_result.data, dict) else None

    company_result = (
        db.table("company")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    company = (company_result.data or [None])[0]
    company_id = _safe_text((company or {}).get("company_id")) or None
    user_name = _display_user_name(user_profile, company)

    if not company_id:
        return {
            "user_name": user_name,
            "company_name": None,
            "analysis_id": None,
            "equipment_id": None,
            "has_analysis": False,
            "available_policy_count": None,
            "expected_support_manwon": None,
            "expected_support_label": None,
            "expected_roi_percent": None,
            "hero_summary": _build_hero_summary(False, None),
            "recommendations": [],
            "notices": [],
        }

    roi_outputs = (
        db.table("roi_output")
        .select("*")
        .eq("company_id", company_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
        .data
        or []
    )

    active_analysis_id = _resolve_active_analysis_id(
        requested_analysis_id=analysis_id,
        roi_outputs=roi_outputs,
    )
    active_roi = next(
        (
            row
            for row in roi_outputs
            if str(row.get("id") or "") == str(active_analysis_id or "")
        ),
        None,
    )
    has_analysis = bool(active_roi and _as_dict(active_roi.get("roi_data")))

    matched_rows: list[dict[str, Any]] = []
    if active_analysis_id:
        matched_query = (
            db.table("matched_policy")
            .select("*")
            .eq("company_id", company_id)
            .eq("analysis_id", active_analysis_id)
            .eq("eligible", True)
            .order("match_score", desc=True)
            .execute()
        )
        matched_rows = matched_query.data or []

    policy_ids = [
        _normalize_policy_id(row.get("policy_id"))
        for row in matched_rows
        if _normalize_policy_id(row.get("policy_id"))
    ]
    policy_details = _fetch_policy_details(db, policy_ids)

    merged_policies: list[dict[str, Any]] = []
    seen_policy_ids: set[str] = set()
    for row in matched_rows:
        policy_id = _normalize_policy_id(row.get("policy_id"))
        if not policy_id or policy_id in seen_policy_ids:
            continue
        seen_policy_ids.add(policy_id)
        merged = _merge_matched_policy_row(row, policy_details.get(policy_id))
        merged_policies.append(merged)

    available_policies = [
        policy for policy in merged_policies if _is_available_policy(policy, today=today)
    ]
    ranked_policies = sorted(
        merged_policies,
        key=_policy_match_score,
        reverse=True,
    )

    recommendations = []
    for policy in ranked_policies[:3]:
        recommendations.append(
            {
                "policy_id": policy.get("policy_id"),
                "title": _safe_text(policy.get("title"), default=""),
                "match_score": _normalize_match_score(policy.get("match_score")),
                "scenario_label": _safe_text(policy.get("scenario_label")) or None,
            }
        )

    notices: list[dict[str, Any]] = []
    notice_candidates = sorted(
        merged_policies,
        key=lambda policy: (
            _posted_at_sort_key(policy),
            _safe_text(policy.get("deadline"), policy.get("deadline_display")),
        ),
        reverse=True,
    )
    for policy in notice_candidates[:2]:
        deadline = _deadline_info(policy)
        notices.append(
            {
                "policy_id": policy.get("policy_id"),
                "title": _safe_text(policy.get("title"), default=""),
                "organization": _safe_text(policy.get("organization")) or None,
                "posted_at": _posted_at_sort_key(policy) or None,
                "deadline": deadline.get("deadline_display") or deadline.get("deadline"),
            }
        )

    if not notices:
        selected_query = (
            db.table("policy")
            .select("*")
            .eq("is_selected", True)
            .order("posted_at", desc=True)
            .limit(2)
            .execute()
        )
        for row in selected_query.data or []:
            if not isinstance(row, dict):
                continue
            deadline = _deadline_info(row)
            notices.append(
                {
                    "policy_id": _normalize_policy_id(row.get("policy_id")),
                    "title": _safe_text(row.get("title"), default=""),
                    "organization": _safe_text(row.get("organization")) or None,
                    "posted_at": _posted_at_sort_key(row) or None,
                    "deadline": deadline.get("deadline_display") or deadline.get("deadline"),
                }
            )

    subsidy_manwon, subsidy_label = _resolve_subsidy_manwon(active_roi if has_analysis else None)
    roi_percent = _resolve_roi_percent(active_roi if has_analysis else None)
    top_title = recommendations[0]["title"] if recommendations else None

    return {
        "user_name": user_name,
        "company_name": _safe_text((company or {}).get("company_name")) or None,
        "analysis_id": active_analysis_id,
        "equipment_id": _safe_text((active_roi or {}).get("equipment_id")) or None,
        "has_analysis": has_analysis,
        "available_policy_count": len(available_policies) if has_analysis else None,
        "expected_support_manwon": subsidy_manwon,
        "expected_support_label": subsidy_label,
        "expected_roi_percent": roi_percent,
        "hero_summary": _build_hero_summary(has_analysis, top_title),
        "recommendations": recommendations,
        "notices": notices,
    }
