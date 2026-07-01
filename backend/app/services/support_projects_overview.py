from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.services.dashboard_overview import (
    _d_day_label,
    _format_deadline_display,
    _is_empty_policy_snapshot,
    _parse_deadline,
    _policy_deadline_raw,
    _policy_match_score,
    _priority_policy,
    _safe_number,
    _safe_text,
    _snapshot_policy_rows,
    _verify_company,
)

logger = logging.getLogger(__name__)
SEOUL = ZoneInfo("Asia/Seoul")
CANDIDATE_LIMIT = 5
CLOSING_SOON_DAYS = 30


def _seoul_today() -> date:
    return datetime.now(SEOUL).date()


def _normalize_policy_id(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _normalize_match_score(value: Any) -> int | None:
    number = _safe_number(value)
    if number is None:
        return None
    if number <= 1:
        number *= 100
    return int(max(0, min(100, round(number))))


def _scenario_label_from_match(scenario_match: Any) -> str:
    if not isinstance(scenario_match, list):
        return ""
    normalized = {str(item).strip().lower() for item in scenario_match if item is not None}
    if "a" in normalized and "b" in normalized:
        return "A/B 공통"
    if "a" in normalized:
        return "전체교체"
    if "b" in normalized:
        return "부분교체"
    return ""


def _deadline_info(policy: dict[str, Any]) -> dict[str, Any]:
    raw = _policy_deadline_raw(policy)
    deadline = _parse_deadline(raw)
    today = _seoul_today()
    if deadline:
        days_remaining = (deadline - today).days
        if days_remaining < 0:
            return {
                "deadline": raw,
                "deadline_display": _format_deadline_display(deadline),
                "d_day": "마감됨",
                "days_remaining": days_remaining,
                "is_past": True,
            }
        return {
            "deadline": raw,
            "deadline_display": _format_deadline_display(deadline),
            "d_day": _d_day_label(days_remaining),
            "days_remaining": days_remaining,
            "is_past": False,
        }
    display = _safe_text(policy.get("deadline_display"), raw)
    return {
        "deadline": raw or None,
        "deadline_display": display or None,
        "d_day": display or "-",
        "days_remaining": None,
        "is_past": False,
    }


def _format_support_amount(policy: dict[str, Any]) -> str:
    actual = _safe_text(policy.get("max_amount_actual"))
    if actual:
        return actual
    manwon = _safe_number(policy.get("max_amount_numeric_manwon"), policy.get("max_amount"))
    if manwon is not None:
        return f"최대 {int(manwon):,}만원"
    return "지원금 조건 확인 필요"


def _build_tags(
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    policy: dict[str, Any],
) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for value in (
        _safe_text(policy.get("policy_category")),
        _safe_text(policy.get("policy_subcategory")),
        _safe_text((equipment or {}).get("category")),
        _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(policy.get("scenario_match")),
        _safe_text(company.get("industry_name")),
        _safe_text(company.get("region")),
    ):
        if not value or value in seen:
            continue
        seen.add(value)
        tags.append(value)
    return tags[:6]


def _build_condition_links(
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    policy: dict[str, Any],
) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    category = _safe_text(policy.get("policy_category"))
    if category:
        links.append({"label": "정책 분류", "value": category})
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    )
    if scenario:
        links.append({"label": "투자 시나리오", "value": scenario})
    organization = _safe_text(policy.get("organization"))
    if organization:
        links.append({"label": "주관 기관", "value": organization})
    region = _safe_text(company.get("region"))
    if region:
        links.append({"label": "지역", "value": region})
    industry = _safe_text(company.get("industry_name"))
    if industry:
        links.append({"label": "업종", "value": industry})
    company_type = _safe_text(company.get("company_type"))
    if company_type:
        links.append({"label": "기업 규모", "value": company_type})
    equipment_name = _safe_text((equipment or {}).get("name"))
    if equipment_name:
        links.append({"label": "설비", "value": equipment_name})
    return links


def _fit_status(policy: dict[str, Any], match_score: int | None) -> str:
    eligible = policy.get("eligible")
    if eligible is False:
        return "조건 확인 필요"
    if match_score is None:
        return "조건 확인 필요"
    if match_score >= 70:
        return "적합"
    if match_score >= 50:
        return "검토 필요"
    return "조건 확인 필요"


def _deterministic_reason(
    policy: dict[str, Any],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
) -> str:
    parts: list[str] = []
    industry = _safe_text(company.get("industry_name"))
    region = _safe_text(company.get("region"))
    if industry and region:
        parts.append(f"{industry}·{region} 조건과 연결")
    category = _safe_text((equipment or {}).get("category"))
    if category:
        parts.append(f"{category} 설비 조건 반영")
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    )
    if scenario:
        parts.append(f"{scenario} 시나리오와 연계")
    if parts:
        return " · ".join(parts) + "되어 우선 검토 대상으로 정리했습니다."
    return "기업·설비·투자 조건을 기준으로 우선 검토할 공고입니다."


def _map_policy_card(
    policy: dict[str, Any],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    rank: int | None = None,
) -> dict[str, Any]:
    deadline = _deadline_info(policy)
    match_score = _normalize_match_score(
        policy.get("match_score") if policy.get("match_score") is not None else policy.get("llm_score")
    )
    reason = _safe_text(policy.get("reason")) or _deterministic_reason(
        policy, company=company, equipment=equipment
    )
    policy_id = _normalize_policy_id(policy.get("policy_id"))
    return {
        "rank": rank,
        "policy_id": policy_id,
        "title": _safe_text(policy.get("title"), default="공고명 미확인"),
        "organization": _safe_text(policy.get("organization"), default="-"),
        "deadline": deadline["deadline"],
        "deadline_display": deadline["deadline_display"],
        "d_day": deadline["d_day"],
        "days_remaining": deadline["days_remaining"],
        "is_past_deadline": deadline["is_past"],
        "match_score": match_score,
        "match_score_label": str(match_score) if match_score is not None else None,
        "fit_status": _fit_status(policy, match_score),
        "match_reason": reason,
        "support_amount_text": _format_support_amount(policy),
        "tags": _build_tags(company=company, equipment=equipment, policy=policy),
        "condition_links": _build_condition_links(
            company=company, equipment=equipment, policy=policy
        ),
        "eligible": policy.get("eligible", True),
        "scenario_label": _safe_text(policy.get("scenario_label"))
        or _scenario_label_from_match(policy.get("scenario_match")),
        "url": _safe_text(policy.get("url")) or None,
        "summary": _safe_text(policy.get("summary")) or None,
    }


def _sort_snapshot_policies(
    policies: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    recommended_id = _safe_text(snapshot.get("recommended_policy_id"))
    today = _seoul_today()

    def sort_key(policy: dict[str, Any]) -> tuple:
        policy_id = _normalize_policy_id(policy.get("policy_id"))
        is_recommended = 0 if recommended_id and policy_id == recommended_id else 1
        eligible_rank = 0 if policy.get("eligible", True) else 1
        score_rank = -_policy_match_score(policy)
        deadline = _parse_deadline(_policy_deadline_raw(policy))
        if deadline and deadline >= today:
            deadline_rank = (deadline - today).days
        else:
            deadline_rank = 99999
        title = _safe_text(policy.get("title"))
        return (is_recommended, eligible_rank, score_rank, deadline_rank, title)

    return sorted(policies, key=sort_key)


def _count_closing_soon(policies: list[dict[str, Any]]) -> int:
    today = _seoul_today()
    count = 0
    for policy in policies:
        deadline = _parse_deadline(_policy_deadline_raw(policy))
        if not deadline or deadline < today:
            continue
        days = (deadline - today).days
        if days <= CLOSING_SOON_DAYS:
            count += 1
    return count


def _count_policy_db_total(db: Any) -> int:
    try:
        result = (
            db.table("policy")
            .select("policy_id", count="exact")
            .eq("is_selected", True)
            .execute()
        )
        return int(result.count or 0)
    except Exception:
        logger.exception("support_projects policy_db_total count failed")
        try:
            result = db.table("policy").select("policy_id", count="exact").execute()
            return int(result.count or 0)
        except Exception:
            logger.exception("support_projects policy_db_total fallback failed")
            return 0


def _fetch_policy_details(db: Any, policy_ids: list[str]) -> dict[str, dict[str, Any]]:
    unique = []
    seen: set[str] = set()
    for policy_id in policy_ids:
        normalized = _normalize_policy_id(policy_id)
        if normalized and normalized not in seen:
            unique.append(normalized)
            seen.add(normalized)
    if not unique:
        return {}
    try:
        result = db.table("policy").select("*").in_("policy_id", unique).execute()
        return {
            _normalize_policy_id(row.get("policy_id") or row.get("id")): row
            for row in (result.data or [])
            if isinstance(row, dict)
        }
    except Exception:
        logger.exception("support_projects policy detail fetch failed")
        return {}


def _merge_matched_policy_row(row: dict[str, Any], detail: dict[str, Any] | None) -> dict[str, Any]:
    detail = detail or {}
    policy_id = _normalize_policy_id(row.get("policy_id") or detail.get("policy_id"))
    return {
        "policy_id": policy_id,
        "title": _safe_text(row.get("title"), detail.get("title"), default="공고명 미확인"),
        "organization": _safe_text(
            row.get("organization"),
            detail.get("organization"),
            detail.get("agency"),
            default="-",
        ),
        "match_score": row.get("match_score")
        if row.get("match_score") is not None
        else detail.get("match_score"),
        "llm_score": row.get("llm_score") or detail.get("llm_score"),
        "eligible": row.get("eligible", True),
        "reason": _safe_text(row.get("reason"), detail.get("reason")),
        "scenario_match": row.get("scenario_match") or detail.get("scenario_match"),
        "scenario_label": _safe_text(row.get("scenario_label"), detail.get("scenario_label")),
        "summary": _safe_text(detail.get("summary")),
        "deadline": detail.get("deadline"),
        "deadline_display": detail.get("deadline_display"),
        "max_amount_actual": detail.get("max_amount_actual"),
        "max_amount_numeric_manwon": detail.get("max_amount") or detail.get("max_amount_numeric_manwon"),
        "policy_category": detail.get("policy_category"),
        "policy_subcategory": detail.get("policy_subcategory"),
        "url": detail.get("url"),
        "support_items": detail.get("support_items"),
    }


def _resolve_equipment(
    db: Any,
    *,
    company: dict[str, Any],
    equipment_id: str | None,
    roi_equipment_id: str | None = None,
) -> dict[str, Any] | None:
    company_id = str(company.get("company_id") or "")
    target_id = _safe_text(equipment_id) or _safe_text(roi_equipment_id) or _safe_text(
        company.get("representative_equipment_id")
    )
    try:
        query = db.table("equipment").select("*").eq("company_id", company_id)
        if target_id:
            query = query.eq("equipment_id", target_id)
        result = query.limit(1).execute()
        if result.data:
            return result.data[0]
        fallback = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .limit(1)
            .execute()
        )
        return (fallback.data or [None])[0]
    except Exception:
        logger.exception("support_projects equipment lookup failed company_id=%s", company_id)
        return None


def _analysis_scenario(roi_row: dict[str, Any]) -> str:
    roi_data = roi_row.get("roi_data") if isinstance(roi_row.get("roi_data"), dict) else {}
    recommended = _safe_text(roi_data.get("recommended")).lower()
    if "b" in recommended:
        return "b"
    if "a" in recommended:
        return "a"
    return "unknown"


def _company_payload(company: dict[str, Any]) -> dict[str, Any]:
    return {
        "company_id": str(company.get("company_id") or ""),
        "company_name": _safe_text(company.get("company_name"), default="-"),
        "industry_name": _safe_text(company.get("industry_name")) or None,
        "region": _safe_text(company.get("region")) or None,
        "company_type": _safe_text(company.get("company_type")) or None,
    }


def _equipment_payload(equipment: dict[str, Any] | None) -> dict[str, Any] | None:
    if not equipment:
        return None
    return {
        "equipment_id": str(equipment.get("equipment_id") or ""),
        "name": _safe_text(equipment.get("name"), default="설비명 미확인"),
        "category": _safe_text(equipment.get("category")) or None,
        "process": _safe_text(equipment.get("process")) or None,
    }


def _build_policy_lists(
    policies: list[dict[str, Any]],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    priority_id: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    all_matched = [
        _map_policy_card(policy, company=company, equipment=equipment, rank=index + 1)
        for index, policy in enumerate(policies)
    ]
    candidate_rows = [
        policy
        for policy in policies
        if _normalize_policy_id(policy.get("policy_id")) != priority_id
    ]
    candidates = [
        _map_policy_card(policy, company=company, equipment=equipment, rank=index + 1)
        for index, policy in enumerate(candidate_rows[:CANDIDATE_LIMIT])
    ]
    return candidates, all_matched


def _build_overview_payload(
    *,
    mode: str,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    analysis: dict[str, Any] | None,
    counts: dict[str, int],
    priority_policy: dict[str, Any] | None,
    candidates: list[dict[str, Any]],
    all_matched: list[dict[str, Any]],
    legacy_state: str | None = None,
    empty_state: str | None = None,
) -> dict[str, Any]:
    return {
        "mode": mode,
        "company": _company_payload(company),
        "equipment": _equipment_payload(equipment),
        "analysis": analysis,
        "counts": counts,
        "priority_policy": priority_policy,
        "candidates": candidates,
        "all_matched": all_matched,
        "legacy_state": legacy_state,
        "empty_state": empty_state,
    }


def load_support_projects_overview(
    *,
    company_id: str,
    user_id: str,
    analysis_id: str | None = None,
    equipment_id: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    company = _verify_company(db, company_id, user_id)
    policy_db_total = _count_policy_db_total(db)

    if analysis_id:
        return _load_analysis_snapshot_overview(
            db=db,
            company=company,
            company_id=company_id,
            analysis_id=analysis_id,
            policy_db_total=policy_db_total,
        )

    return _load_live_discovery_overview(
        db=db,
        company=company,
        company_id=company_id,
        equipment_id=equipment_id,
        policy_db_total=policy_db_total,
    )


def _load_analysis_snapshot_overview(
    *,
    db: Any,
    company: dict[str, Any],
    company_id: str,
    analysis_id: str,
    policy_db_total: int,
) -> dict[str, Any]:
    try:
        result = (
            db.table("roi_output")
            .select(
                "id,company_id,equipment_id,created_at,policy_snapshot,roi_data,"
                "scenario_a_investment_manwon,scenario_b_investment_manwon"
            )
            .eq("id", analysis_id)
            .eq("company_id", company_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception(
            "support_projects roi_output query failed analysis_id=%s company_id=%s",
            analysis_id,
            company_id,
        )
        raise

    row = (result.data or [None])[0]
    if not row:
        raise LookupError("분석 결과를 찾을 수 없습니다.")

    equipment = _resolve_equipment(
        db,
        company=company,
        equipment_id=None,
        roi_equipment_id=str(row.get("equipment_id") or ""),
    )
    analysis_payload = {
        "analysis_id": str(row.get("id") or analysis_id),
        "created_at": row.get("created_at"),
        "scenario": _analysis_scenario(row),
    }

    snapshot = row.get("policy_snapshot")
    if _is_empty_policy_snapshot(snapshot):
        return _build_overview_payload(
            mode="analysis_snapshot",
            company=company,
            equipment=equipment,
            analysis=analysis_payload,
            counts={
                "policy_db_total": policy_db_total,
                "matched_total": 0,
                "priority_policy_count": 0,
                "closing_soon_count": 0,
            },
            priority_policy={"exists": False},
            candidates=[],
            all_matched=[],
            legacy_state="POLICY_SNAPSHOT_MISSING",
            empty_state="legacy_snapshot_missing",
        )

    snapshot_dict = snapshot if isinstance(snapshot, dict) else {}
    policies = _sort_snapshot_policies(_snapshot_policy_rows(snapshot_dict), snapshot_dict)
    matched_total = len(policies)
    priority_row = _priority_policy(snapshot_dict, policies)
    priority_id = _normalize_policy_id((priority_row or {}).get("policy_id"))

    priority_policy = None
    if priority_row:
        priority_policy = {
            "exists": True,
            **_map_policy_card(
                priority_row,
                company=company,
                equipment=equipment,
                rank=1,
            ),
        }

    candidates, all_matched = _build_policy_lists(
        policies,
        company=company,
        equipment=equipment,
        priority_id=priority_id,
    )

    return _build_overview_payload(
        mode="analysis_snapshot",
        company=company,
        equipment=equipment,
        analysis=analysis_payload,
        counts={
            "policy_db_total": policy_db_total,
            "matched_total": matched_total,
            "priority_policy_count": 1 if priority_row else 0,
            "closing_soon_count": _count_closing_soon(policies),
        },
        priority_policy=priority_policy or {"exists": False},
        candidates=candidates,
        all_matched=all_matched,
        legacy_state=None,
        empty_state="no_matches" if matched_total == 0 else None,
    )


def _load_live_discovery_overview(
    *,
    db: Any,
    company: dict[str, Any],
    company_id: str,
    equipment_id: str | None,
    policy_db_total: int,
) -> dict[str, Any]:
    equipment = _resolve_equipment(db, company=company, equipment_id=equipment_id)
    resolved_equipment_id = _safe_text((equipment or {}).get("equipment_id"))

    try:
        query = (
            db.table("matched_policy")
            .select("*")
            .eq("company_id", company_id)
            .order("match_score", desc=True)
        )
        if resolved_equipment_id:
            query = query.eq("equipment_id", resolved_equipment_id)
        matched_result = query.execute()
    except Exception:
        logger.exception(
            "support_projects matched_policy query failed company_id=%s equipment_id=%s",
            company_id,
            resolved_equipment_id,
        )
        raise

    matched_rows = [
        row for row in (matched_result.data or []) if isinstance(row, dict) and row.get("policy_id")
    ]
    details = _fetch_policy_details(
        db,
        [_normalize_policy_id(row.get("policy_id")) for row in matched_rows],
    )
    policies = [
        _merge_matched_policy_row(
            row,
            details.get(_normalize_policy_id(row.get("policy_id"))),
        )
        for row in matched_rows
    ]

    def live_sort_key(policy: dict[str, Any]) -> tuple:
        eligible_rank = 0 if policy.get("eligible", True) else 1
        score_rank = -_policy_match_score(policy)
        deadline = _parse_deadline(_policy_deadline_raw(policy))
        today = _seoul_today()
        if deadline and deadline >= today:
            deadline_rank = (deadline - today).days
        else:
            deadline_rank = 99999
        return (eligible_rank, score_rank, deadline_rank, _safe_text(policy.get("title")))

    policies = sorted(policies, key=live_sort_key)
    matched_total = len(policies)
    priority_row = policies[0] if policies else None
    priority_id = _normalize_policy_id((priority_row or {}).get("policy_id"))

    priority_policy = None
    if priority_row:
        priority_policy = {
            "exists": True,
            **_map_policy_card(
                priority_row,
                company=company,
                equipment=equipment,
                rank=1,
            ),
        }

    candidates, all_matched = _build_policy_lists(
        policies,
        company=company,
        equipment=equipment,
        priority_id=priority_id,
    )

    return _build_overview_payload(
        mode="live_discovery",
        company=company,
        equipment=equipment,
        analysis=None,
        counts={
            "policy_db_total": policy_db_total,
            "matched_total": matched_total,
            "priority_policy_count": 1 if priority_row else 0,
            "closing_soon_count": _count_closing_soon(policies),
        },
        priority_policy=priority_policy or {"exists": False},
        candidates=candidates,
        all_matched=all_matched,
        legacy_state=None,
        empty_state="no_matches" if matched_total == 0 else None,
    )
