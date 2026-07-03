from __future__ import annotations

import re
from typing import Any


CANONICAL_DEADLINE_NOTES = {
    "budget_exhaustion": "예산 소진 시",
    "first_come": "선착순 접수",
    "always_open": "상시 접수",
    "notice_later": "추후 공지",
    "separate_notice": "별도 공고",
    "round_based": "차수별 접수",
    "unknown": "마감일 미정",
}


TYPE_ALIASES = {
    "budget_exhaustion": "budget_exhaustion",
    "budget_until_exhausted": "budget_exhaustion",
    "first_come": "first_come",
    "always_open": "always_open",
    "notice_later": "notice_later",
    "separate_notice": "separate_notice",
    "round_based": "round_based",
    "unknown": "unknown",
    "not_found": "unknown",
    "needs_review": "unknown",
}


PHRASE_PATTERNS = [
    ("budget_exhaustion", ["예산소진", "예산소진시", "예산마감", "자금소진", "소진시까지", "소진시"]),
    ("first_come", ["선착순", "선착순접수", "선착순모집", "접수순", "신청순"]),
    ("always_open", ["상시모집", "상시접수", "수시모집", "수시접수", "연중수시", "상시"]),
    ("notice_later", ["추후공지", "추후공고", "추후안내", "추후별도", "별도안내"]),
    ("separate_notice", ["별도공지", "별도공고", "공고문참조", "공고참조"]),
    ("round_based", ["차수별", "차수", "회차별", "분기별", "월별접수"]),
    ("unknown", ["미정", "마감일미정", "확인필요", "확인 필요", "미확인"]),
]


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def compact_text(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).strip().lower()


def canonical_deadline_type(value: Any) -> str:
    text = clean_text(value).lower()
    return TYPE_ALIASES.get(text, text)


def classify_deadline_note(*values: Any) -> str:
    for value in values:
        deadline_type = canonical_deadline_type(value)
        if deadline_type in CANONICAL_DEADLINE_NOTES:
            return deadline_type

    combined = compact_text(" ".join(clean_text(value) for value in values))
    if not combined:
        return ""

    for deadline_type, patterns in PHRASE_PATTERNS:
        if any(pattern.replace(" ", "").lower() in combined for pattern in patterns):
            return deadline_type
    return ""


def canonical_deadline_note(*values: Any, fallback: Any = "") -> str:
    deadline_type = classify_deadline_note(*values)
    if deadline_type:
        return CANONICAL_DEADLINE_NOTES[deadline_type]
    return clean_text(fallback)


def canonical_deadline_note_for_row(row: dict[str, Any]) -> str:
    return canonical_deadline_note(
        row.get("deadline_type"),
        row.get("deadline_status"),
        row.get("deadline_display"),
        row.get("deadline_note"),
        row.get("deadline_raw_text"),
        row.get("deadline_evidence"),
        fallback=row.get("deadline_note") or row.get("deadline_display"),
    )
