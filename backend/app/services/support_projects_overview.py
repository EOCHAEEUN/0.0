from __future__ import annotations

import json
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
    _safe_number,
    _safe_text,
    _snapshot_policy_rows,
    _verify_company,
)

logger = logging.getLogger(__name__)
SEOUL = ZoneInfo("Asia/Seoul")
CANDIDATE_LIMIT = 5
CLOSING_SOON_DAYS = 30
PRIORITY_DISPLAY_LIMIT = 5
LIVE_DISCOVERY_DISPLAY_LIMIT = 6
CLOSING_URGENT_DAYS = 7
NON_CASH_KEYWORDS = (
    "컨설팅",
    "멘토링",
    "교육",
    "시험분석",
    "인증",
    "장비활용",
    "기술지도",
)
FINANCIAL_NATURES = ("자금지원", "융자", "보증")
FINANCIAL_AMOUNT_TYPES = ("loan", "guarantee", "interest_support")
DIRECT_AMOUNT_TYPES = ("subsidy", "support_amount", "voucher")


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


def _company_age_years(company: dict[str, Any]) -> int | None:
    established = _safe_number(company.get("established_year"))
    if established is None:
        return None
    return max(0, _seoul_today().year - int(established))


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def _policy_support_text(policy: dict[str, Any]) -> str:
    return " ".join(
        str(policy.get(key) or "")
        for key in (
            "support_method",
            "support_items",
            "summary",
            "max_amount_type_ko",
            "roi_support_reason",
        )
    )


def _resolve_support_type(policy: dict[str, Any]) -> dict[str, str]:
    nature = _safe_text(policy.get("policy_primary_nature"))
    category = _safe_text(policy.get("support_primary_category"))
    amount_type = _safe_text(policy.get("max_amount_type")).lower()
    roi_support_type = _safe_text(policy.get("roi_support_type"))
    support_text = _policy_support_text(policy)

    if (
        any(token in nature for token in FINANCIAL_NATURES)
        or category == "금융지원"
        or amount_type in FINANCIAL_AMOUNT_TYPES
    ):
        return {
            "support_type_label": "금융지원",
            "support_type_detail": "융자·보증·이자지원 조건 확인",
        }

    if amount_type == "non_cash" or (
        "연계 추천" in roi_support_type and _contains_any(support_text, NON_CASH_KEYWORDS)
    ):
        return {
            "support_type_label": "비금융 연계지원",
            "support_type_detail": "컨설팅·시험분석·인증 등 연계 가능",
        }

    if amount_type == "voucher":
        return {
            "support_type_label": "바우처 지원",
            "support_type_detail": "바우처 지원 조건 확인",
        }

    if (
        "ROI 직접 반영" in roi_support_type
        or amount_type in DIRECT_AMOUNT_TYPES
    ):
        return {
            "support_type_label": "직접 지원금",
            "support_type_detail": "지원 한도와 세부 조건은 공고문에서 확인",
        }

    if amount_type == "support_ratio":
        return {
            "support_type_label": "지원비율형 지원",
            "support_type_detail": "지원 비율과 한도는 공고문에서 확인",
        }

    return {
        "support_type_label": "지원 조건 확인 필요",
        "support_type_detail": "지원 형태와 한도는 공고문에서 확인",
    }


def _documents_need_check(policy: dict[str, Any]) -> bool:
    count = _safe_number(policy.get("required_documents_count"))
    docs = policy.get("required_documents_json")
    if count is not None and count > 0:
        return True
    if docs in (None, "", [], {}):
        return True
    if isinstance(docs, list) and len(docs) == 0:
        return True
    return False


def _eligibility_needs_check(policy: dict[str, Any]) -> bool:
    if policy.get("eligible") is False:
        return True
    status = _safe_text(policy.get("eligibility_extraction_status")).lower()
    if status in ("failed", "missing", "incomplete", "partial"):
        return True
    if not _safe_text(policy.get("eligibility_text")):
        return True
    return False


def _is_closing_urgent(policy: dict[str, Any]) -> bool:
    deadline = _parse_deadline(_policy_deadline_raw(policy))
    if not deadline:
        return False
    today = _seoul_today()
    if deadline < today:
        return False
    return (deadline - today).days <= CLOSING_URGENT_DAYS


def _resolve_application_status(policy: dict[str, Any]) -> str:
    if _is_closing_urgent(policy):
        return "마감 임박"
    if _documents_need_check(policy):
        return "서류 확인 필요"
    if _eligibility_needs_check(policy):
        return "조건 확인 필요"
    return "우선 검토"


def _resolve_live_discovery_status(policy: dict[str, Any]) -> str:
    if _eligibility_needs_check(policy):
        return "조건 확인 필요"
    return "기본 조건 통과 후보"


def _resolve_action_label(policy: dict[str, Any], *, is_live: bool = False) -> str:
    if _is_closing_urgent(policy):
        return "마감 확인 →"
    support = _resolve_support_type(policy)
    label = support["support_type_label"]
    if label == "금융지원":
        return "금융조건 보기 →"
    if label == "비금융 연계지원":
        return "상세 보기 →"
    if _documents_need_check(policy) and not is_live:
        return "서류 확인 →"
    return "상세 보기 →"


def _summarize_reason(reason: str, *, max_len: int = 120) -> str:
    text = reason.strip()
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _coerce_support_items(value: Any) -> list[Any]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("[") or text.startswith("{"):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return [text]
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                return [parsed]
            return [text]
        return [text]
    return []


def _support_item_phrase(item: Any) -> str:
    if isinstance(item, dict):
        name = _safe_text(item.get("name"))
        amount = _safe_text(item.get("amount"))
        if name and amount:
            return f"{name} {amount}"
        return name or amount
    return _safe_text(item)


def _format_support_items_summary(value: Any, *, max_len: int = 80) -> str:
    phrases = [
        phrase
        for phrase in (_support_item_phrase(item) for item in _coerce_support_items(value))
        if phrase
    ]
    if not phrases:
        return ""
    text = ", ".join(phrases[:3])
    if len(phrases) > 3:
        text = f"{text} 등"
    return _summarize_reason(text, max_len=max_len)


def _build_why_check_now(
    policy: dict[str, Any],
    *,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
) -> list[str]:
    lines: list[str] = []
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    )
    if scenario:
        lines.append(f"현재 투자안({scenario})과 연결된 지원 조건입니다.")
    support_summary = _format_support_items_summary(policy.get("support_items"))
    summary = _safe_text(policy.get("summary"))
    if support_summary:
        lines.append(f"지원 내용: {support_summary}")
    elif summary:
        lines.append(f"지원 내용: {_summarize_reason(summary, max_len=80)}")

    missing: list[str] = []
    amount = _safe_text(policy.get("max_amount_actual"))
    if not amount:
        missing.append("지원한도")
    if _documents_need_check(policy):
        missing.append("제출서류")
    if _is_closing_urgent(policy) or _policy_deadline_raw(policy):
        missing.append("마감일")
    if missing:
        lines.append(f"지금 확인할 항목: {', '.join(missing)}")
    elif equipment and _safe_text(equipment.get("name")):
        lines.append(f"{equipment['name']} 설비 조건과 함께 검토할 수 있습니다.")
    return lines[:3]


def _build_preflight_checks(policy: dict[str, Any]) -> list[dict[str, str]]:
    support = _resolve_support_type(policy)
    amount = _safe_text(policy.get("max_amount_actual")) or "공고문 확인 필요"
    docs_count = _safe_number(policy.get("required_documents_count"))
    if docs_count is not None and docs_count > 0:
        docs_label = f"제출서류 {int(docs_count)}건 확인"
    else:
        docs_label = "제출서류 공고문 확인 필요"
    eligible_label = (
        "매칭 반영됨" if policy.get("eligible") is True else "조건 확인 필요"
    )
    scenario = _safe_text(policy.get("scenario_label")) or _scenario_label_from_match(
        policy.get("scenario_match")
    ) or "-"
    return [
        {"label": "기본 기업 조건", "value": eligible_label},
        {"label": "투자안 연결", "value": scenario},
        {"label": "지원 형태", "value": support["support_type_label"]},
        {"label": "지원 한도", "value": amount},
        {"label": "제출서류", "value": docs_label},
    ]


def _enrich_policy_with_detail(
    policy: dict[str, Any],
    detail: dict[str, Any] | None,
) -> dict[str, Any]:
    if not detail:
        return dict(policy)
    merged = {**detail, **policy}
    for key in (
        "title",
        "organization",
        "deadline",
        "deadline_display",
        "summary",
        "url",
        "max_amount_actual",
        "max_amount_numeric_manwon",
        "max_amount_type",
        "max_amount_type_ko",
        "support_method",
        "support_items",
        "policy_primary_nature",
        "support_primary_category",
        "roi_support_type",
        "roi_support_reason",
        "required_documents_count",
        "required_documents_json",
        "eligibility_text",
        "eligibility_extraction_status",
    ):
        if not merged.get(key) and detail.get(key) is not None:
            merged[key] = detail.get(key)
    merged["policy_id"] = _normalize_policy_id(
        policy.get("policy_id") or detail.get("policy_id")
    )
    return merged


def _is_live_policy_excluded(policy: dict[str, Any]) -> bool:
    roi_support_type = _safe_text(policy.get("roi_support_type"))
    if "계산 제외" in roi_support_type:
        return True
    deadline = _parse_deadline(_policy_deadline_raw(policy))
    if deadline and deadline < _seoul_today():
        return True
    return False


def _passes_live_company_filters(policy: dict[str, Any], company: dict[str, Any]) -> bool:
    company_codes = [
        code.strip()
        for code in str(company.get("industry_code") or "").split(",")
        if code.strip()
    ]
    policy_codes = [
        code.strip()
        for code in str(policy.get("industry_codes") or "").split(",")
        if code.strip()
    ]
    region = _safe_text(company.get("region"))
    region_short = region.split()[0] if region else ""
    policy_region = _safe_text(policy.get("region"))
    code_match = (
        not company_codes
        or not policy_codes
        or "C" in policy_codes
        or any(code in policy_codes for code in company_codes)
    )
    region_match = (
        not region
        or not policy_region
        or "전국" in policy_region
        or region_short in policy_region
    )
    company_types = [
        item.strip()
        for item in str(company.get("company_type") or "").split(",")
        if item.strip()
    ]
    eligible_types = [
        item.strip()
        for item in str(policy.get("eligible_company_types") or "").split(",")
        if item.strip()
    ]
    type_match = (
        not eligible_types
        or not company_types
        or any(company_type in eligible_types for company_type in company_types)
    )
    employee_count = _safe_number(company.get("employee_count"))
    employee_min = _safe_number(policy.get("employee_min"))
    employee_max = _safe_number(policy.get("employee_max"))
    employee_match = True
    if employee_count is not None:
        if employee_min is not None and employee_count < employee_min:
            employee_match = False
        if employee_max is not None and employee_count > employee_max:
            employee_match = False

    revenue = _safe_number(company.get("annual_revenue"))
    revenue_min = _safe_number(policy.get("revenue_min_manwon"))
    revenue_max = _safe_number(policy.get("revenue_max_manwon"))
    revenue_match = True
    if revenue is not None:
        if revenue_min is not None and revenue < revenue_min:
            revenue_match = False
        if revenue_max is not None and revenue > revenue_max:
            revenue_match = False

    age_years = _company_age_years(company)
    age_min = _safe_number(policy.get("company_age_min"))
    age_max = _safe_number(policy.get("company_age_max"))
    age_match = True
    if age_years is not None:
        if age_min is not None and age_years < age_min:
            age_match = False
        if age_max is not None and age_years > age_max:
            age_match = False

    return code_match and region_match and type_match and employee_match and revenue_match and age_match


def _format_deadline_label(policy: dict[str, Any]) -> str:
    display = _safe_text(policy.get("deadline_display"))
    if display:
        return display
    deadline = _policy_deadline_raw(policy)
    parsed = _parse_deadline(deadline)
    if parsed:
        return _format_deadline_display(parsed)
    if deadline:
        return str(deadline)
    return "마감일 공고문 확인"



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
    is_live: bool = False,
) -> dict[str, Any]:
    deadline = _deadline_info(policy)
    reason = _safe_text(policy.get("reason")) or _deterministic_reason(
        policy, company=company, equipment=equipment
    )
    support = _resolve_support_type(policy)
    application_status = (
        _resolve_live_discovery_status(policy)
        if is_live
        else _resolve_application_status(policy)
    )
    policy_id = _normalize_policy_id(policy.get("policy_id"))
    amount = _safe_text(policy.get("max_amount_actual"))
    docs_count = _safe_number(policy.get("required_documents_count"))
    return {
        "rank": rank,
        "policy_id": policy_id,
        "title": _safe_text(policy.get("title"), default="공고명 미확인"),
        "organization": _safe_text(policy.get("organization"), default="-"),
        "deadline": deadline["deadline"],
        "deadline_display": _format_deadline_label(policy),
        "d_day": deadline["d_day"],
        "days_remaining": deadline["days_remaining"],
        "is_past_deadline": deadline["is_past"],
        "application_status": application_status,
        "support_type_label": support["support_type_label"],
        "support_type_detail": support["support_type_detail"],
        "recommendation_summary": _summarize_reason(reason),
        "match_reason": reason,
        "why_check_now": _build_why_check_now(
            policy, company=company, equipment=equipment
        ),
        "preflight_checks": _build_preflight_checks(policy),
        "support_amount_text": amount or "공고문 확인 필요",
        "required_documents_label": (
            f"제출서류 {int(docs_count)}건 확인"
            if docs_count is not None and docs_count > 0
            else "제출서류 공고문 확인 필요"
        ),
        "action_label": _resolve_action_label(policy, is_live=is_live),
        "tags": _build_tags(company=company, equipment=equipment, policy=policy),
        "condition_links": _build_condition_links(
            company=company, equipment=equipment, policy=policy
        ),
        "eligible": policy.get("eligible", True),
        "scenario_label": _safe_text(policy.get("scenario_label"))
        or _scenario_label_from_match(policy.get("scenario_match")),
        "url": _safe_text(policy.get("url")) or None,
        "summary": _safe_text(policy.get("summary")) or None,
        "required_documents_count": docs_count,
        "exists": True,
    }


def _order_snapshot_policies(
    policies: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    if not policies:
        return []
    ordered = list(policies)
    recommended_id = _normalize_policy_id(snapshot.get("recommended_policy_id"))
    if not recommended_id:
        return ordered
    index = next(
        (
            idx
            for idx, policy in enumerate(ordered)
            if _normalize_policy_id(policy.get("policy_id")) == recommended_id
        ),
        -1,
    )
    if index > 0:
        recommended = ordered.pop(index)
        ordered.insert(0, recommended)
    return ordered


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
        result = db.table("policy").select("policy_id", count="exact").execute()
        return int(result.count or 0)
    except Exception:
        logger.exception("support_projects policy_db_total count failed")
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
    policy_details: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    details = policy_details or {}
    display_policies = policies[:PRIORITY_DISPLAY_LIMIT]
    enriched = [
        _enrich_policy_with_detail(
            policy,
            details.get(_normalize_policy_id(policy.get("policy_id"))),
        )
        for policy in display_policies
    ]
    all_matched = [
        _map_policy_card(policy, company=company, equipment=equipment, rank=index + 1)
        for index, policy in enumerate(enriched)
    ]
    candidate_rows = [
        policy
        for policy in enriched
        if _normalize_policy_id(policy.get("policy_id")) != priority_id
    ]
    candidates = [
        _map_policy_card(policy, company=company, equipment=equipment, rank=index + 2)
        for index, policy in enumerate(candidate_rows[: max(0, PRIORITY_DISPLAY_LIMIT - 1)])
    ]
    return candidates, all_matched


def _load_live_discovery_candidates(
    db: Any,
    *,
    company: dict[str, Any],
    exclude_policy_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], int, str | None]:
    exclude_policy_ids = exclude_policy_ids or set()
    try:
        result = db.table("policy").select("*").execute()
    except Exception:
        logger.exception("support_projects live discovery policy query failed")
        return [], 0, "추가 정책 후보를 불러오지 못했습니다."

    rows = [row for row in (result.data or []) if isinstance(row, dict)]
    filtered: list[dict[str, Any]] = []
    for policy in rows:
        policy_id = _normalize_policy_id(policy.get("policy_id") or policy.get("id"))
        if not policy_id or policy_id in exclude_policy_ids:
            continue
        if _is_live_policy_excluded(policy):
            continue
        if not _passes_live_company_filters(policy, company):
            continue
        filtered.append(policy)

    def live_sort_key(policy: dict[str, Any]) -> tuple:
        deadline = _parse_deadline(_policy_deadline_raw(policy))
        today = _seoul_today()
        if deadline and deadline >= today:
            deadline_rank = (deadline - today).days
        else:
            deadline_rank = 99999
        return (deadline_rank, _safe_text(policy.get("title")))

    filtered = sorted(filtered, key=live_sort_key)
    total_count = len(filtered)
    items = [
        _map_policy_card(policy, company=company, equipment=None, is_live=True)
        for policy in filtered[:LIVE_DISCOVERY_DISPLAY_LIMIT]
    ]
    return items, total_count, None


def _build_overview_payload(
    *,
    mode: str,
    company: dict[str, Any],
    equipment: dict[str, Any] | None,
    analysis: dict[str, Any] | None,
    counts: dict[str, int],
    priority_policy: dict[str, Any] | None,
    priority_policies: list[dict[str, Any]],
    all_matched: list[dict[str, Any]],
    live_discovery: dict[str, Any],
    legacy_state: str | None = None,
    empty_state: str | None = None,
    analysis_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "mode": mode,
        "policy_database_total": counts.get("policy_db_total", 0),
        "analysis_context": analysis_context,
        "company": _company_payload(company),
        "equipment": _equipment_payload(equipment),
        "analysis": analysis,
        "counts": counts,
        "priority_policy": priority_policy,
        "priority_policies": priority_policies,
        "candidates": priority_policies,
        "all_matched": all_matched,
        "live_discovery": live_discovery,
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
    analysis_context = {
        "analysis_id": str(row.get("id") or analysis_id),
        "company_id": company_id,
        "equipment_id": str(row.get("equipment_id") or ""),
        "equipment_name": _safe_text((equipment or {}).get("name"), default="설비명 미확인"),
        "snapshot_status": "legacy_missing",
    }
    live_items, live_total, live_error = _load_live_discovery_candidates(
        db,
        company=company,
        exclude_policy_ids=set(),
    )
    live_discovery = {
        "source": "current_policy_database",
        "total_count": live_total,
        "items": live_items,
        "error": live_error,
    }

    if _is_empty_policy_snapshot(snapshot):
        return _build_overview_payload(
            mode="analysis_snapshot",
            company=company,
            equipment=equipment,
            analysis=analysis_payload,
            analysis_context=analysis_context,
            counts={
                "policy_db_total": policy_db_total,
                "matched_total": 0,
                "priority_policy_count": 0,
                "closing_soon_count": 0,
            },
            priority_policy={"exists": False},
            priority_policies=[],
            all_matched=[],
            live_discovery=live_discovery,
            legacy_state="POLICY_SNAPSHOT_MISSING",
            empty_state="legacy_snapshot_missing",
        )

    snapshot_dict = snapshot if isinstance(snapshot, dict) else {}
    analysis_context["snapshot_status"] = "available"
    raw_policies = _snapshot_policy_rows(snapshot_dict)
    policy_details = _fetch_policy_details(
        db,
        [_normalize_policy_id(policy.get("policy_id")) for policy in raw_policies],
    )
    policies = _order_snapshot_policies(raw_policies, snapshot_dict)
    policies = [
        _enrich_policy_with_detail(
            policy,
            policy_details.get(_normalize_policy_id(policy.get("policy_id"))),
        )
        for policy in policies
    ]
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

    priority_policies, all_matched = _build_policy_lists(
        policies,
        company=company,
        equipment=equipment,
        priority_id=priority_id,
        policy_details=policy_details,
    )

    exclude_ids = {
        _normalize_policy_id(policy.get("policy_id"))
        for policy in policies[:PRIORITY_DISPLAY_LIMIT]
        if _normalize_policy_id(policy.get("policy_id"))
    }
    live_items, live_total, live_error = _load_live_discovery_candidates(
        db,
        company=company,
        exclude_policy_ids=exclude_ids,
    )
    live_discovery = {
        "source": "current_policy_database",
        "total_count": live_total,
        "items": live_items,
        "error": live_error,
    }

    return _build_overview_payload(
        mode="analysis_snapshot",
        company=company,
        equipment=equipment,
        analysis=analysis_payload,
        analysis_context=analysis_context,
        counts={
            "policy_db_total": policy_db_total,
            "matched_total": min(matched_total, PRIORITY_DISPLAY_LIMIT),
            "priority_policy_count": min(matched_total, PRIORITY_DISPLAY_LIMIT),
            "closing_soon_count": _count_closing_soon(policies),
        },
        priority_policy=priority_policy or {"exists": False},
        priority_policies=priority_policies,
        all_matched=all_matched,
        live_discovery=live_discovery,
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
    live_items, live_total, live_error = _load_live_discovery_candidates(
        db,
        company=company,
        exclude_policy_ids=set(),
    )
    live_discovery = {
        "source": "current_policy_database",
        "total_count": live_total,
        "items": live_items,
        "error": live_error,
    }

    priority_policy = None
    priority_policies: list[dict[str, Any]] = []
    if live_items:
        first = live_items[0]
        priority_policy = {"exists": True, **first}
        priority_policies = live_items[1:]

    return _build_overview_payload(
        mode="live_discovery",
        company=company,
        equipment=equipment,
        analysis=None,
        analysis_context=None,
        counts={
            "policy_db_total": policy_db_total,
            "matched_total": len(live_items),
            "priority_policy_count": 1 if priority_policy else 0,
            "closing_soon_count": _count_closing_soon(
                [{"deadline": item.get("deadline")} for item in live_items]
            ),
        },
        priority_policy=priority_policy or {"exists": False},
        priority_policies=priority_policies,
        all_matched=live_items,
        live_discovery=live_discovery,
        legacy_state=None,
        empty_state="no_matches" if not live_items else None,
    )
