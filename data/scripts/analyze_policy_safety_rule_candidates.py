"""Analyze policy rows against legal safety-rule evidence candidates.

Read-only Supabase usage:
  - reads policy
  - reads safety_rule_legal

No insert/update/delete/upsert/rpc is used. Results are written only as CSV.

Run rule-based analysis:
  python data/scripts/analyze_policy_safety_rule_candidates.py

Run Gemini review for filtered candidates:
  python data/scripts/analyze_policy_safety_rule_candidates.py --use-llm --limit 50
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client


POLICY_TABLE = "policy"
SAFETY_TABLE = "safety_rule_legal"
DEFAULT_BATCH_SIZE = 500
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

OUTPUT_CANDIDATES = Path("reports/policy_safety_rule_candidates.csv")
OUTPUT_HIGH = Path("reports/policy_safety_rule_candidates_high.csv")
OUTPUT_DEBUG_LOW = Path("reports/policy_safety_rule_candidates_debug_low_score.csv")
OUTPUT_SUMMARY = Path("reports/policy_safety_rule_candidates_summary.csv")
OUTPUT_LLM_REVIEWED = Path("reports/policy_safety_rule_candidates_llm_reviewed.csv")
OUTPUT_LLM_APPROVED = Path("reports/policy_safety_rule_candidates_llm_approved.csv")
OUTPUT_LLM_REJECTED = Path("reports/policy_safety_rule_candidates_llm_rejected.csv")
OUTPUT_LLM_SUMMARY = Path("reports/policy_safety_rule_candidates_llm_summary.csv")

FILTER_SCORE = 8.0
HIGH_SCORE = 12.0
TOP_N_PER_POLICY = 3

POLICY_TEXT_FIELDS = [
    "id",
    "policy_id",
    "title",
    "organization",
    "category",
    "sub_category",
    "policy_category",
    "policy_subcategory",
    "selected_reason",
    "eligibility_text",
    "support_content",
    "description",
    "attachment_text",
    "source_api_json",
    "temp_extraction_json",
]

SAFETY_TEXT_FIELDS = [
    "rule_id",
    "inspection_type",
    "check_item",
    "legal_basis",
    "penalty_amount_note",
]

POLICY_SIGNAL_WORDS = {
    "설비",
    "장비",
    "기계",
    "공정",
    "자동화",
    "스마트공장",
    "스마트팩토리",
    "로봇",
    "센서",
    "제조",
    "생산",
    "개선",
    "교체",
    "노후",
    "에너지",
    "전기",
    "프레스",
    "사출",
    "금형",
    "cnc",
    "머시닝센터",
    "절단",
    "용접",
    "지게차",
    "컨베이어",
    "보일러",
    "압축기",
    "공조",
    "위험",
    "안전",
    "방호",
    "비상정지",
}

IMPROVEMENT_WORDS = {
    "개선",
    "교체",
    "노후",
    "자동화",
    "스마트공장",
    "스마트팩토리",
    "위험",
    "안전",
    "방호",
    "비상정지",
}

DIRECT_EQUIPMENT_ALIASES = {
    "프레스": {"프레스", "press"},
    "사출": {"사출", "사출기", "사출성형", "injection"},
    "금형": {"금형"},
    "CNC": {"cnc", "머시닝센터", "machining", "mct"},
    "선반": {"선반"},
    "밀링": {"밀링"},
    "로봇": {"로봇", "협동로봇", "robot"},
    "지게차": {"지게차", "forklift"},
    "컨베이어": {"컨베이어", "conveyor"},
    "크레인": {"크레인", "crane"},
    "압력용기": {"압력용기", "압력"},
    "보일러": {"보일러", "boiler"},
    "압축기": {"압축기", "compressor"},
    "공조": {"공조", "환기", "국소배기"},
    "전기": {"전기", "제어", "감전", "누전"},
    "유압": {"유압"},
    "절단": {"절단", "cutting"},
    "용접": {"용접", "welding"},
    "자동화": {"자동화", "이송장치", "자동이송", "컨베이어"},
}

GENERIC_STOPWORDS = {
    "관한",
    "관련",
    "이상",
    "이하",
    "초과",
    "미만",
    "주요",
    "있는",
    "해당하는",
    "따른",
    "위한",
    "결과",
    "일반",
    "하지",
    "사업장",
    "절차",
    "규정",
    "시행령",
    "시행규칙",
    "별표",
    "해당",
    "대상",
    "지원",
    "사업",
    "기업",
    "모집",
    "공고",
    "선정",
    "신청",
    "제출",
    "확인",
    "경우",
    "내용",
    "통해",
    "대해",
    "그리고",
    "또는",
    "및",
    "등",
    "수",
    "시",
    "그",
    "nc",
    "점검",
    "관리",
    "작업",
    "안전",
    "보건",
    "법정",
    "설비",
    "장비",
    "기계",
    "상태",
    "여부",
    "가능",
    "필요",
    "실시",
    "미이행",
    "만원",
    "amount",
    "label",
    "type",
    "text",
    "notes",
    "null",
    "manwon",
}

CANDIDATE_FIELDNAMES = [
    "policy_id",
    "policy_title",
    "policy_organization",
    "rule_id",
    "inspection_type",
    "check_item",
    "legal_basis",
    "penalty_amount_note",
    "match_score",
    "confidence_level",
    "matched_keywords",
    "matched_policy_fields",
    "match_reason",
    "usage_suggestion",
]

LLM_FIELDNAMES = [
    *CANDIDATE_FIELDNAMES,
    "llm_decision",
    "llm_confidence",
    "llm_usage_type",
    "llm_reason",
    "caution",
    "llm_status",
    "llm_error",
]

SUMMARY_FIELDNAMES = [
    "total_policies",
    "total_safety_rules",
    "total_raw_candidates",
    "total_filtered_candidates",
    "matched_policies_before_filter",
    "matched_policies_after_filter",
    "high_confidence_candidates",
    "medium_confidence_candidates",
    "low_confidence_candidates",
    "avg_candidates_per_policy_after_filter",
    "top_inspection_types_after_filter",
    "top_matched_keywords_after_filter",
]

LLM_SUMMARY_FIELDNAMES = [
    "reviewed_candidates",
    "approved_candidates",
    "rejected_candidates",
    "needs_review_candidates",
    "card_only_count",
    "roi_qualitative_count",
    "reference_only_count",
    "avg_llm_confidence",
    "approved_policy_count",
    "failed_llm_calls",
]


def load_env() -> None:
    script_dir = Path(__file__).resolve().parent
    for env_path in [
        Path.cwd() / ".env",
        Path.cwd() / "backend" / ".env",
        script_dir / ".env",
        script_dir.parent / ".env",
        script_dir.parent.parent / ".env",
        script_dir.parent.parent / "backend" / ".env",
    ]:
        if env_path.exists():
            load_dotenv(env_path)


def get_supabase() -> Client:
    load_env()
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or ""
    ).strip()
    if not url:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(url, key)


def fetch_all_rows(
    supabase: Client,
    table_name: str,
    *,
    batch_size: int,
    limit: int = 0,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        if limit > 0 and len(rows) >= limit:
            break
        page_size = min(batch_size, limit - len(rows)) if limit > 0 else batch_size
        page = (
            supabase.table(table_name)
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def value_to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def truncate_text(value: Any, max_chars: int = 1000) -> str:
    text = value_to_text(value)
    return text[:max_chars].strip()


def normalize_text(value: Any) -> str:
    text = value_to_text(value).lower()
    text = re.sub(r"[^0-9a-z가-힣]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(value: Any, *, remove_generic: bool = True) -> set[str]:
    tokens = set(re.findall(r"[0-9a-z가-힣]+", normalize_text(value)))
    cleaned = {token for token in tokens if len(token) >= 2 and not token.isdigit()}
    if remove_generic:
        cleaned = {token for token in cleaned if token not in GENERIC_STOPWORDS}
    return cleaned


def fields_present(rows: list[dict[str, Any]], preferred_fields: list[str]) -> list[str]:
    existing: set[str] = set()
    for row in rows[:50]:
        existing.update(row.keys())
    return [field for field in preferred_fields if field in existing]


def combined_text(row: dict[str, Any], fields: list[str]) -> str:
    return " ".join(value_to_text(row.get(field)) for field in fields if field in row)


def field_texts(row: dict[str, Any], fields: list[str]) -> dict[str, str]:
    return {
        field: normalize_text(row.get(field))
        for field in fields
        if field in row and normalize_text(row.get(field))
    }


def matched_fields(policy_fields: dict[str, str], keywords: set[str]) -> list[str]:
    fields: list[str] = []
    for field, text in policy_fields.items():
        if any(keyword.lower() in text for keyword in keywords):
            fields.append(field)
    return fields


def direct_equipment_matches(policy_text: str, safety_text: str) -> set[str]:
    matches: set[str] = set()
    for label, aliases in DIRECT_EQUIPMENT_ALIASES.items():
        in_policy = any(alias.lower() in policy_text for alias in aliases)
        in_safety = any(alias.lower() in safety_text for alias in aliases)
        if in_policy and in_safety:
            matches.add(label)
    return matches


def policy_signal_matches(policy_text: str) -> set[str]:
    return {word for word in POLICY_SIGNAL_WORDS if word.lower() in policy_text}


def confidence_level(score: float) -> str:
    if score >= HIGH_SCORE:
        return "high"
    if score >= FILTER_SCORE:
        return "medium"
    return "low"


def score_pair(
    policy_row: dict[str, Any],
    safety_row: dict[str, Any],
    policy_fields: list[str],
) -> dict[str, Any] | None:
    policy_text_raw = combined_text(policy_row, policy_fields)
    policy_text = normalize_text(policy_text_raw)
    if not policy_text:
        return None

    policy_signals = policy_signal_matches(policy_text)
    if not policy_signals:
        return None

    inspection_type = value_to_text(safety_row.get("inspection_type"))
    check_item = value_to_text(safety_row.get("check_item"))
    legal_basis = value_to_text(safety_row.get("legal_basis"))
    safety_match_text_raw = " ".join([inspection_type, check_item, legal_basis])
    safety_text = normalize_text(safety_match_text_raw)
    if not safety_text:
        return None

    inspection_tokens = tokenize(inspection_type)
    check_tokens = tokenize(check_item)
    legal_tokens = tokenize(legal_basis)
    safety_tokens = tokenize(safety_match_text_raw)
    policy_tokens = tokenize(policy_text_raw)

    direct_matches = direct_equipment_matches(policy_text, safety_text)
    inspection_matches = {token for token in inspection_tokens if token in policy_text}
    check_matches = {token for token in check_tokens if token in policy_text}
    legal_matches = {token for token in legal_tokens if token in policy_text}
    improvement_matches = {word for word in IMPROVEMENT_WORDS if word in policy_text}
    token_intersection = policy_tokens & safety_tokens

    if not (direct_matches or inspection_matches or check_matches or token_intersection):
        return None

    score = 0.0
    if direct_matches:
        score += 10 + min(len(direct_matches) - 1, 2) * 2
    if inspection_matches:
        score += 5 + min(len(inspection_matches) - 1, 3)
    if check_matches:
        score += 4 + min(len(check_matches) - 1, 3)
    if improvement_matches:
        score += 2
    if token_intersection:
        score += min(len(token_intersection), 8) * 0.5
    if legal_matches:
        score += min(len(legal_matches) * 0.5, 1.0)

    if score <= 0:
        return None

    matched_keywords = (
        direct_matches
        | inspection_matches
        | check_matches
        | legal_matches
        | improvement_matches
        | token_intersection
    )
    matched_keywords = {keyword for keyword in matched_keywords if keyword.lower() not in GENERIC_STOPWORDS}
    policy_field_map = field_texts(policy_row, policy_fields)
    return {
        "score": round(score, 2),
        "confidence_level": confidence_level(score),
        "matched_keywords": sorted(matched_keywords),
        "matched_policy_fields": matched_fields(policy_field_map, matched_keywords),
        "match_reason": build_match_reason(
            direct_matches=direct_matches,
            inspection_matches=inspection_matches,
            check_matches=check_matches,
            improvement_matches=improvement_matches,
            policy_signals=policy_signals,
        ),
        "usage_suggestion": build_usage_suggestion(score, direct_matches, improvement_matches),
        "direct_match_count": len(direct_matches),
        "inspection_match_count": len(inspection_matches),
    }


def build_match_reason(
    *,
    direct_matches: set[str],
    inspection_matches: set[str],
    check_matches: set[str],
    improvement_matches: set[str],
    policy_signals: set[str],
) -> str:
    if direct_matches:
        direct = ", ".join(sorted(direct_matches))
        needs = ", ".join(sorted(improvement_matches))
        if needs:
            return f"정책 제목/상세에 {direct} 및 {needs} 관련 표현이 포함되어 해당 설비 안전근거 후보로 추출됨"
        return f"정책 제목/상세에 {direct} 설비명이 포함되어 안전근거 후보로 추출됨"
    if inspection_matches:
        return f"정책 내용과 안전점검 유형 핵심어({', '.join(sorted(inspection_matches)[:5])})가 겹쳐 후보로 추출됨"
    if check_matches:
        return f"정책 내용과 점검항목 핵심어({', '.join(sorted(check_matches)[:5])})가 겹쳐 후보로 추출됨"
    if improvement_matches:
        return f"정책 내용에 {', '.join(sorted(improvement_matches)[:5])} 같은 개선/안전 필요성 표현이 포함되어 후보로 추출됨"
    return f"정책 내용에 제조·설비 관련 신호어({', '.join(sorted(policy_signals)[:5])})가 포함되어 참고 후보로 추출됨"


def build_usage_suggestion(
    score: float,
    direct_matches: set[str],
    improvement_matches: set[str],
) -> str:
    if score >= HIGH_SCORE and direct_matches:
        return "신청서 사업 필요성 문단에 사용 가능"
    if score >= FILTER_SCORE:
        return "정책 상세 안전근거 카드에 표시 가능"
    if improvement_matches & {"개선", "교체", "노후", "자동화"}:
        return "ROI 정성효과 문구에 사용 가능"
    return "참고 근거로만 표시 권장"


def candidate_row(
    policy_row: dict[str, Any],
    safety_row: dict[str, Any],
    match: dict[str, Any],
) -> dict[str, Any]:
    return {
        "policy_id": value_to_text(policy_row.get("policy_id") or policy_row.get("id")),
        "policy_title": value_to_text(policy_row.get("title")),
        "policy_organization": value_to_text(policy_row.get("organization")),
        "rule_id": value_to_text(safety_row.get("rule_id")),
        "inspection_type": value_to_text(safety_row.get("inspection_type")),
        "check_item": value_to_text(safety_row.get("check_item")),
        "legal_basis": value_to_text(safety_row.get("legal_basis")),
        "penalty_amount_note": value_to_text(safety_row.get("penalty_amount_note")),
        "match_score": match["score"],
        "confidence_level": match["confidence_level"],
        "matched_keywords": ", ".join(match["matched_keywords"]),
        "matched_policy_fields": ", ".join(match["matched_policy_fields"]),
        "match_reason": match["match_reason"],
        "usage_suggestion": match["usage_suggestion"],
        "_direct_match_count": match["direct_match_count"],
        "_inspection_match_count": match["inspection_match_count"],
    }


def sort_candidates(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            row["policy_id"],
            -float(row["match_score"] or 0),
            -int(row.get("_direct_match_count") or 0),
            -int(row.get("_inspection_match_count") or 0),
            row["rule_id"],
        ),
    )


def filter_top_candidates(raw_candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_policy: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in raw_candidates:
        if float(row["match_score"] or 0) >= FILTER_SCORE:
            by_policy[row["policy_id"]].append(row)

    filtered: list[dict[str, Any]] = []
    for rows in by_policy.values():
        ordered = sorted(
            rows,
            key=lambda row: (
                -float(row["match_score"] or 0),
                -int(row.get("_direct_match_count") or 0),
                -int(row.get("_inspection_match_count") or 0),
                row["rule_id"],
            ),
        )
        filtered.extend(ordered[:TOP_N_PER_POLICY])
    return sort_candidates(filtered)


def strip_internal_columns(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {key: value for key, value in row.items() if not key.startswith("_")}
        for row in rows
    ]


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def top_join(counter: Counter[str], limit: int = 10) -> str:
    return " | ".join(f"{key}:{count}" for key, count in counter.most_common(limit))


def analyze(
    policy_rows: list[dict[str, Any]],
    safety_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any], dict[str, list[dict[str, Any]]]]:
    policy_fields = fields_present(policy_rows, POLICY_TEXT_FIELDS)

    raw_candidates: list[dict[str, Any]] = []
    by_policy_raw: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for policy_row in policy_rows:
        policy_id = value_to_text(policy_row.get("policy_id") or policy_row.get("id"))
        for safety_row in safety_rows:
            match = score_pair(policy_row, safety_row, policy_fields)
            if match is None:
                continue
            row = candidate_row(policy_row, safety_row, match)
            raw_candidates.append(row)
            by_policy_raw[policy_id].append(row)

    raw_candidates = sort_candidates(raw_candidates)
    filtered_candidates = filter_top_candidates(raw_candidates)
    low_candidates = [row for row in raw_candidates if float(row["match_score"] or 0) < FILTER_SCORE]
    high_candidates = [row for row in filtered_candidates if row["confidence_level"] == "high"]

    by_policy_filtered: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in filtered_candidates:
        by_policy_filtered[row["policy_id"]].append(row)

    matched_before = len([policy_id for policy_id, rows in by_policy_raw.items() if rows])
    matched_after = len([policy_id for policy_id, rows in by_policy_filtered.items() if rows])
    keyword_counter: Counter[str] = Counter()
    for row in filtered_candidates:
        for keyword in [item.strip() for item in row["matched_keywords"].split(",") if item.strip()]:
            keyword_counter[keyword] += 1

    summary = {
        "total_policies": len(policy_rows),
        "total_safety_rules": len(safety_rows),
        "total_raw_candidates": len(raw_candidates),
        "total_filtered_candidates": len(filtered_candidates),
        "matched_policies_before_filter": matched_before,
        "matched_policies_after_filter": matched_after,
        "high_confidence_candidates": len(high_candidates),
        "medium_confidence_candidates": len(filtered_candidates) - len(high_candidates),
        "low_confidence_candidates": len(low_candidates),
        "avg_candidates_per_policy_after_filter": (
            round(len(filtered_candidates) / matched_after, 2) if matched_after else 0
        ),
        "top_inspection_types_after_filter": top_join(
            Counter(row["inspection_type"] for row in filtered_candidates if row["inspection_type"])
        ),
        "top_matched_keywords_after_filter": top_join(keyword_counter),
    }
    return raw_candidates, filtered_candidates, summary, by_policy_filtered


def extract_json_object(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in Gemini response.")
    return json.loads(match.group(0))


def build_llm_prompt(row: dict[str, Any], policy_lookup: dict[str, dict[str, Any]]) -> str:
    policy = policy_lookup.get(row["policy_id"], {})
    payload = {
        "policy": {
            "policy_id": row["policy_id"],
            "title": policy.get("title"),
            "organization": policy.get("organization"),
            "category": policy.get("category") or policy.get("policy_category"),
            "sub_category": policy.get("sub_category") or policy.get("policy_subcategory"),
            "selected_reason": truncate_text(policy.get("selected_reason"), 600),
            "eligibility_text": truncate_text(policy.get("eligibility_text"), 800),
            "support_content": truncate_text(policy.get("support_content"), 800),
            "description": truncate_text(policy.get("description"), 800),
            "attachment_text": truncate_text(policy.get("attachment_text"), 1000),
            "source_api_json": truncate_text(policy.get("source_api_json"), 800),
            "temp_extraction_json": truncate_text(policy.get("temp_extraction_json"), 800),
        },
        "safety_rule": {
            "rule_id": row["rule_id"],
            "inspection_type": row["inspection_type"],
            "check_item": row["check_item"],
            "legal_basis": row["legal_basis"],
            "penalty_amount_note": truncate_text(row["penalty_amount_note"], 1000),
        },
        "rule_based_match": {
            "match_score": row["match_score"],
            "confidence_level": row["confidence_level"],
            "matched_keywords": row["matched_keywords"],
            "matched_policy_fields": row["matched_policy_fields"],
            "match_reason": row["match_reason"],
        },
    }
    return (
        "You are reviewing whether a Korean government policy can naturally show a legal safety-rule "
        "as supporting evidence. Do not generate application sentences. Only classify the candidate.\n"
        "Return strictly valid JSON with this schema:\n"
        "{\n"
        '  "decision": "approve | reject | needs_review",\n'
        '  "confidence": 0.0,\n'
        '  "usage_type": "card_only | roi_qualitative | reference_only | reject",\n'
        '  "reason": "Korean, one or two sentences",\n'
        '  "caution": "Korean caution text"\n'
        "}\n"
        "Do not state that the business is violating law, subject to penalty, or non-compliant. "
        "Use cautious language such as '관련 안전관리 근거로 활용 가능'.\n\n"
        f"INPUT:\n{json.dumps(payload, ensure_ascii=False)}"
    )


def call_gemini(prompt: str, *, model: str, api_key: str, timeout: int = 60) -> dict[str, Any]:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model.removeprefix('models/')}:generateContent"
    )
    response = requests.post(
        url,
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    text = (
        payload.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    if not text:
        raise ValueError("Gemini response text is empty.")
    return extract_json_object(text)


def normalize_llm_result(result: dict[str, Any]) -> dict[str, Any]:
    decision = str(result.get("decision") or "needs_review").strip()
    usage_type = str(result.get("usage_type") or "reference_only").strip()
    if decision not in {"approve", "reject", "needs_review"}:
        decision = "needs_review"
    if usage_type not in {"card_only", "roi_qualitative", "reference_only", "reject"}:
        usage_type = "reference_only" if decision != "reject" else "reject"
    try:
        confidence = float(result.get("confidence") or 0)
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "llm_decision": decision,
        "llm_confidence": max(0.0, min(confidence, 1.0)),
        "llm_usage_type": usage_type,
        "llm_reason": str(result.get("reason") or "").strip(),
        "caution": str(result.get("caution") or "").strip(),
        "llm_status": "ok",
        "llm_error": "",
    }


def review_with_llm(
    rows: list[dict[str, Any]],
    policy_rows: list[dict[str, Any]],
    *,
    model: str,
    limit: int,
    sleep_seconds: float,
) -> list[dict[str, Any]]:
    api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing.")

    policy_lookup = {
        value_to_text(row.get("policy_id") or row.get("id")): row
        for row in policy_rows
    }
    target_rows = rows[:limit] if limit > 0 else rows
    reviewed: list[dict[str, Any]] = []
    for index, row in enumerate(target_rows, start=1):
        reviewed_row = dict(row)
        try:
            result = call_gemini(
                build_llm_prompt(row, policy_lookup),
                model=model,
                api_key=api_key,
            )
            reviewed_row.update(normalize_llm_result(result))
        except Exception as exc:  # noqa: BLE001 - keep batch running.
            reviewed_row.update(
                {
                    "llm_decision": "",
                    "llm_confidence": "",
                    "llm_usage_type": "",
                    "llm_reason": "",
                    "caution": "",
                    "llm_status": "failed",
                    "llm_error": str(exc)[:500],
                }
            )
        reviewed.append(reviewed_row)
        if index % 10 == 0:
            write_csv(OUTPUT_LLM_REVIEWED, reviewed, LLM_FIELDNAMES)
            print(f"  LLM reviewed {index}/{len(target_rows)}")
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
    return reviewed


def llm_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    ok_rows = [row for row in rows if row.get("llm_status") == "ok"]
    approved = [
        row
        for row in ok_rows
        if row.get("llm_decision") == "approve"
        and row.get("llm_usage_type") in {"card_only", "roi_qualitative", "reference_only"}
        and float(row.get("llm_confidence") or 0) >= 0.7
    ]
    confidences = [float(row.get("llm_confidence") or 0) for row in ok_rows]
    return {
        "reviewed_candidates": len(rows),
        "approved_candidates": len(approved),
        "rejected_candidates": sum(row.get("llm_decision") == "reject" for row in ok_rows),
        "needs_review_candidates": sum(row.get("llm_decision") == "needs_review" for row in ok_rows),
        "card_only_count": sum(row.get("llm_usage_type") == "card_only" for row in ok_rows),
        "roi_qualitative_count": sum(row.get("llm_usage_type") == "roi_qualitative" for row in ok_rows),
        "reference_only_count": sum(row.get("llm_usage_type") == "reference_only" for row in ok_rows),
        "avg_llm_confidence": round(sum(confidences) / len(confidences), 3) if confidences else 0,
        "approved_policy_count": len({row["policy_id"] for row in approved}),
        "failed_llm_calls": sum(row.get("llm_status") == "failed" for row in rows),
    }


def print_rule_report(
    summary: dict[str, Any],
    filtered_candidates: list[dict[str, Any]],
    by_policy: dict[str, list[dict[str, Any]]],
) -> None:
    print("[SUMMARY]")
    print(f"Total policies: {summary['total_policies']}")
    print(f"Total safety rules: {summary['total_safety_rules']}")
    print(f"Raw candidates: {summary['total_raw_candidates']}")
    print(f"Filtered candidates(score >= 8): {summary['total_filtered_candidates']}")
    print(f"Matched policies before filter: {summary['matched_policies_before_filter']}")
    print(f"Matched policies after filter: {summary['matched_policies_after_filter']}")
    print(f"High confidence candidates(score >= 12): {summary['high_confidence_candidates']}")
    print(f"Medium confidence candidates(score 8~11.9): {summary['medium_confidence_candidates']}")
    print(f"Low/debug candidates(score < 8): {summary['low_confidence_candidates']}")

    print("\n[TOP INSPECTION TYPES AFTER FILTER]")
    counter = Counter(row["inspection_type"] for row in filtered_candidates if row["inspection_type"])
    for index, (inspection_type, count) in enumerate(counter.most_common(10), start=1):
        print(f"{index}. {inspection_type} ({count})")

    print("\n[TOP MATCHED POLICIES AFTER FILTER]")
    ranked = sorted(by_policy.items(), key=lambda item: len(item[1]), reverse=True)
    for index, (policy_id, rows) in enumerate(ranked[:10], start=1):
        top_rules = ", ".join(row["rule_id"] for row in rows[:5])
        print(
            f"{index}. policy_id={policy_id}, title={rows[0]['policy_title']}, "
            f"candidate_count={len(rows)}, top_rules={top_rules}"
        )


def print_llm_report(summary: dict[str, Any]) -> None:
    print("\n[LLM REVIEW SUMMARY]")
    print(f"Reviewed candidates: {summary['reviewed_candidates']}")
    print(f"Approved: {summary['approved_candidates']}")
    print(f"Rejected: {summary['rejected_candidates']}")
    print(f"Needs review: {summary['needs_review_candidates']}")
    print(f"Card only: {summary['card_only_count']}")
    print(f"ROI qualitative: {summary['roi_qualitative_count']}")
    print(f"Reference only: {summary['reference_only_count']}")
    print(f"Approved policy count: {summary['approved_policy_count']}")
    print(f"Failed LLM calls: {summary['failed_llm_calls']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only analysis for policy-to-safety-rule evidence candidates.",
    )
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--limit-policies", type=int, default=0, help="Debug policy read limit. 0 means all.")
    parser.add_argument("--limit-safety-rules", type=int, default=0, help="Debug safety rule read limit. 0 means all.")
    parser.add_argument("--use-llm", action="store_true", help="Review filtered top candidates with Gemini.")
    parser.add_argument("--limit", type=int, default=0, help="Limit Gemini review calls. 0 means all filtered candidates.")
    parser.add_argument("--llm-model", default=DEFAULT_GEMINI_MODEL)
    parser.add_argument("--llm-sleep", type=float, default=0.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    supabase = get_supabase()
    policy_rows = fetch_all_rows(
        supabase,
        POLICY_TABLE,
        batch_size=args.batch_size,
        limit=args.limit_policies,
    )
    safety_rows = fetch_all_rows(
        supabase,
        SAFETY_TABLE,
        batch_size=args.batch_size,
        limit=args.limit_safety_rules,
    )

    raw_candidates, filtered_candidates, summary, by_policy = analyze(policy_rows, safety_rows)
    high_candidates = [row for row in filtered_candidates if row["confidence_level"] == "high"]
    low_candidates = [row for row in raw_candidates if row["confidence_level"] == "low"]

    write_csv(OUTPUT_CANDIDATES, strip_internal_columns(filtered_candidates), CANDIDATE_FIELDNAMES)
    write_csv(OUTPUT_HIGH, strip_internal_columns(high_candidates), CANDIDATE_FIELDNAMES)
    write_csv(OUTPUT_DEBUG_LOW, strip_internal_columns(low_candidates), CANDIDATE_FIELDNAMES)
    write_csv(OUTPUT_SUMMARY, [summary], SUMMARY_FIELDNAMES)
    print_rule_report(summary, filtered_candidates, by_policy)

    if args.use_llm:
        reviewed = review_with_llm(
            strip_internal_columns(filtered_candidates),
            policy_rows,
            model=args.llm_model,
            limit=args.limit,
            sleep_seconds=args.llm_sleep,
        )
        approved = [
            row
            for row in reviewed
            if row.get("llm_decision") == "approve"
            and row.get("llm_usage_type") in {"card_only", "roi_qualitative", "reference_only"}
            and float(row.get("llm_confidence") or 0) >= 0.7
        ]
        rejected = [row for row in reviewed if row.get("llm_decision") == "reject"]
        llm_summary_row = llm_summary(reviewed)
        write_csv(OUTPUT_LLM_REVIEWED, reviewed, LLM_FIELDNAMES)
        write_csv(OUTPUT_LLM_APPROVED, approved, LLM_FIELDNAMES)
        write_csv(OUTPUT_LLM_REJECTED, rejected, LLM_FIELDNAMES)
        write_csv(OUTPUT_LLM_SUMMARY, [llm_summary_row], LLM_SUMMARY_FIELDNAMES)
        print_llm_report(llm_summary_row)

    print(f"\nCSV: {OUTPUT_CANDIDATES}")
    print(f"High CSV: {OUTPUT_HIGH}")
    print(f"Low/debug CSV: {OUTPUT_DEBUG_LOW}")
    print(f"Summary CSV: {OUTPUT_SUMMARY}")
    if args.use_llm:
        print(f"LLM reviewed CSV: {OUTPUT_LLM_REVIEWED}")
        print(f"LLM approved CSV: {OUTPUT_LLM_APPROVED}")
        print(f"LLM rejected CSV: {OUTPUT_LLM_REJECTED}")
        print(f"LLM summary CSV: {OUTPUT_LLM_SUMMARY}")
    print("Run command: python data/scripts/analyze_policy_safety_rule_candidates.py")
    print("LLM command: python data/scripts/analyze_policy_safety_rule_candidates.py --use-llm --limit 50")


if __name__ == "__main__":
    main()
