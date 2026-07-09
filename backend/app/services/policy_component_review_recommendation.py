from __future__ import annotations

import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any


DECISION_TEMPLATE_FIELDS = [
    "policy_id",
    "policy_title",
    "component_key",
    "component_name",
    "source_kind",
    "source_index",
    "support_type",
    "effect_layer",
    "calculation_method",
    "proposed_roi_apply_method",
    "fixed_amount_manwon",
    "cap_amount_manwon",
    "support_ratio",
    "eligible_cost_ratio",
    "evidence_text",
    "evidence_source_type",
    "evidence_source_name",
    "evidence_page_or_section",
    "quality_flags",
    "review_reasons",
    "source_component_json",
    "recommended_action",
    "recommended_reason",
    "risk_level",
    "requires_original_notice_check",
    "review_decision",
    "reviewer_note",
    "reviewed_at",
]

CAPEX_KEYWORDS = (
    "설비",
    "장비",
    "시설",
    "자동화",
    "제조로봇",
    "금형",
    "생산설비",
    "스마트공장",
    "안전장비",
    "공정개선",
    "공정 개선",
    "설치공사",
    "계측기",
    "제어장치",
    "에너지관리시스템",
)
EXCLUSION_KEYWORDS = (
    "사용료",
    "이용료",
    "장비 활용",
    "장비활용",
    "연구시설장비",
    "연구시설 장비",
    "매장 인테리어",
    "매장인테리어",
    "매장 모델링",
    "매장모델링",
    "소상공인 매장",
    "사무시설 환경개선",
    "상업시설 환경개선",
    "서비스 바우처",
    "운영비",
    "임차",
    "saas",
    "secaas",
)
HIGH_RISK_KEYWORDS = (
    "r&d",
    "연구개발",
    "기술개발",
    "실증",
    "poc",
    "사업화",
    "시제품",
    "dx retrofit",
)
AMBIGUOUS_CAPEX_KEYWORDS = (
    "작업환경 개선",
    "디지털 역량강화",
    "디지털역량강화",
    "시설 개선",
    "시설개선",
)
NON_CAPEX_PURPOSE_KEYWORDS = (
    "시험",
    "인증",
    "컨설팅",
    "멘토링",
    "교육",
    "인건비",
    "마케팅",
    "홍보",
)
COMPLEX_SMART_FACTORY_KEYWORDS = (
    "목표수준",
    "동일수준",
    "고도화",
    "재신청",
    "횟수",
    "단계",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_review_queue(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("candidates"), list):
        raise ValueError("입력 JSON에는 candidates 배열이 있어야 합니다.")
    candidates = [
        dict(candidate)
        for candidate in payload["candidates"]
        if isinstance(candidate, dict)
    ]
    if len(candidates) != len(payload["candidates"]):
        raise ValueError("모든 candidates 항목은 JSON 객체여야 합니다.")
    return payload, candidates


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if not value:
        return []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return [value]
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    return [str(value)]


def _context(candidate: dict[str, Any]) -> str:
    source_json = candidate.get("source_component_json")
    if isinstance(source_json, str):
        try:
            source_json = json.loads(source_json)
        except json.JSONDecodeError:
            source_json = {}
    component = (
        source_json.get("component", {})
        if isinstance(source_json, dict)
        else {}
    )
    values = [
        candidate.get("policy_title"),
        candidate.get("component_name"),
        candidate.get("evidence_text"),
    ]
    if isinstance(component, dict):
        values.extend(
            component.get(key)
            for key in ("name", "subtype", "evidence", "amount_actual")
        )
    return " ".join(str(value or "") for value in values).lower()


def _has_any(context: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in context for keyword in keywords)


def recommend_review_action(candidate: dict[str, Any]) -> dict[str, Any]:
    context = _context(candidate)
    flags = _as_list(candidate.get("quality_flags"))
    has_amount = candidate.get("fixed_amount_manwon") is not None or candidate.get(
        "cap_amount_manwon"
    ) is not None
    has_ratio = candidate.get("support_ratio") is not None
    has_terms = has_amount or has_ratio
    has_capex = _has_any(context, CAPEX_KEYWORDS)

    if _has_any(context, EXCLUSION_KEYWORDS):
        action = "exclude_from_capex"
        reason = "장비 직접 취득비가 아닌 사용료·운영비·매장/서비스성 지원 근거가 있습니다."
        risk = "high"
        notice_check = False
    elif (
        "manual_capex_review_required" in flags
        or "capex_keyword_conflict" in flags
        or _has_any(context, HIGH_RISK_KEYWORDS)
    ):
        action = "hold_manual_review"
        reason = "R&D·실증·PoC 또는 CAPEX/비CAPEX 혼합 범위가 있어 원문 지출항목 확인이 필요합니다."
        risk = "high"
        notice_check = True
    elif _has_any(context, AMBIGUOUS_CAPEX_KEYWORDS):
        action = "hold_manual_review"
        reason = "설비성 가능성은 있으나 구체적인 취득·설치 지출항목이 불명확합니다."
        risk = "medium"
        notice_check = True
    elif (
        "스마트공장" in context
        and (
            _has_any(context, COMPLEX_SMART_FACTORY_KEYWORDS)
            or len(re.findall(r"\d+(?:\.\d+)?", context)) >= 4
        )
    ):
        action = "hold_manual_review"
        reason = "스마트공장 지원의 한도·비율·목표수준 조건을 원문 공고와 대조해야 합니다."
        risk = "medium"
        notice_check = True
    elif (
        has_capex
        and has_terms
        and not _has_any(context, NON_CAPEX_PURPOSE_KEYWORDS)
    ):
        action = "ready_for_pending_review"
        reason = "구체적인 제조 CAPEX 근거와 package 금액 또는 지원비율 근거가 있습니다."
        risk = "low"
        notice_check = False
    else:
        action = "hold_manual_review"
        reason = "CAPEX 지출 범위 또는 금액·지원비율 근거를 원문에서 추가 확인해야 합니다."
        risk = "medium"
        notice_check = True

    row = {field: candidate.get(field) for field in DECISION_TEMPLATE_FIELDS}
    row.update(
        {
            "quality_flags": flags,
            "review_reasons": _as_list(candidate.get("review_reasons")),
            "recommended_action": action,
            "recommended_reason": reason,
            "risk_level": risk,
            "requires_original_notice_check": notice_check,
            "review_decision": None,
            "reviewer_note": None,
            "reviewed_at": None,
        }
    )
    return row


def build_decision_template(
    candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return [recommend_review_action(candidate) for candidate in candidates]


def build_decision_payload(
    source_payload: dict[str, Any],
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "offline_capex_review_decision_template",
        "source": source_payload.get("source"),
        "input_candidate_count": len(source_payload.get("candidates", [])),
        "candidate_count": len(rows),
        "auto_decision_count": 0,
        "candidates": rows,
    }


def write_decision_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=DECISION_TEMPLATE_FIELDS)
        writer.writeheader()
        for item in rows:
            row = dict(item)
            for key in ("quality_flags", "review_reasons", "source_component_json"):
                row[key] = json.dumps(row[key], ensure_ascii=False)
            row["requires_original_notice_check"] = (
                "true" if row["requires_original_notice_check"] else "false"
            )
            for key in ("review_decision", "reviewer_note", "reviewed_at"):
                row[key] = ""
            writer.writerow(row)


def write_decision_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
