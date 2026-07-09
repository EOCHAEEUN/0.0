"""Normalize and validate LLM application draft JSON before draft_result storage."""
from __future__ import annotations

from typing import Any

DRAFT_NARRATIVE_STRING_FIELDS: tuple[str, ...] = (
    "application_purpose",
    "business_necessity",
    "implementation_plan",
    "expected_effects",
    "policy_utilization_strategy",
    "final_recommendation",
    "company_context",
    "diagnostic_interpretation",
    "execution_detail",
    "policy_analysis",
    "performance_plan",
    "risk_review",
    "submission_readiness",
    "performance_governance",
    "user_request_reflection",
)

_INVALID_NARRATIVE_VALUES = frozenset(
    {
        "",
        "미입력",
        "없음",
        "null",
        "undefined",
        "none",
    }
)

_FORBIDDEN_ASSERTION_PHRASES = (
    "확정 지원금",
    "반드시 선정",
    "무조건 가능",
    "100% 선정",
    "반드시 지원",
)

_MIN_NARRATIVE_LEN = 80
_MAX_NARRATIVE_LEN = 350
_MAX_BENEFIT_ITEMS = 3
_MIN_BENEFIT_LEN = 10


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_valid_stored_narrative(
    text: str,
    *,
    company_name: str = "",
    equipment_name: str = "",
    policy_title: str = "",
) -> bool:
    value = _clean_text(text)
    if len(value) < _MIN_NARRATIVE_LEN or len(value) > _MAX_NARRATIVE_LEN:
        return False
    if value.lower() in _INVALID_NARRATIVE_VALUES:
        return False
    if any(phrase in value for phrase in _FORBIDDEN_ASSERTION_PHRASES):
        return False
    for placeholder in ("기업명 미입력", "설비명 미입력", "지원사업명 미확인", "추천 지원사업 미선택"):
        if placeholder in value:
            return False
    return True


def normalize_expected_benefits(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    items: list[str] = []
    for raw in value:
        text = _clean_text(raw)
        if len(text) < _MIN_BENEFIT_LEN:
            continue
        if text.lower() in _INVALID_NARRATIVE_VALUES:
            continue
        items.append(text[:120])
        if len(items) >= _MAX_BENEFIT_ITEMS:
            break
    return items


def normalize_llm_draft_payload(
    payload: Any,
    *,
    company_name: str = "",
    equipment_name: str = "",
    policy_title: str = "",
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}

    facts = {
        "company_name": _clean_text(company_name),
        "equipment_name": _clean_text(equipment_name),
        "policy_title": _clean_text(policy_title),
    }
    normalized: dict[str, Any] = dict(payload)

    for key in DRAFT_NARRATIVE_STRING_FIELDS:
        raw = _clean_text(payload.get(key))
        if is_valid_stored_narrative(
            raw,
            company_name=facts["company_name"],
            equipment_name=facts["equipment_name"],
            policy_title=facts["policy_title"],
        ):
            normalized[key] = raw[:_MAX_NARRATIVE_LEN]
        else:
            normalized[key] = ""

    benefits = normalize_expected_benefits(payload.get("expected_benefits"))
    if benefits:
        normalized["expected_benefits"] = benefits

    for legacy_key in ("readiness_score", "ai_reasons", "required_documents", "company_name", "equipment_name", "selected_policy"):
        if legacy_key in payload and payload.get(legacy_key) not in (None, ""):
            normalized[legacy_key] = payload.get(legacy_key)

    return normalized


def merge_extended_narrative_fields(content: dict[str, Any]) -> dict[str, str]:
    merged: dict[str, str] = {}
    for key in DRAFT_NARRATIVE_STRING_FIELDS:
        text = _clean_text(content.get(key))
        if is_valid_stored_narrative(text):
            merged[key] = text[:_MAX_NARRATIVE_LEN]
    return merged
