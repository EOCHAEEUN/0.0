"""Classify policy natures and match them to safety_rule_legal check types.

Read-only Supabase usage:
  - reads policy
  - reads safety_rule_legal

No insert/update/delete/upsert/rpc is used. Results are written only as CSV.

Run:
  python data/scripts/analyze_policy_nature_safety_rule_matches.py
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


POLICY_TABLE = "policy"
SAFETY_TABLE = "safety_rule_legal"
DEFAULT_BATCH_SIZE = 500
MIN_SCORE = 5.0
TOP_N_PER_POLICY = 5

OUTPUT_CANDIDATES = Path("reports/policy_safety_rule_nature_match_candidates.csv")
OUTPUT_SUMMARY = Path("reports/policy_safety_rule_nature_match_summary.csv")

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
    "url",
]

SAFETY_TEXT_FIELDS = [
    "rule_id",
    "equipment_category",
    "inspection_type",
    "check_item",
    "legal_basis",
    "penalty_amount_note",
    "risk_level",
    "legal_check_group",
    "legal_check_group_label",
    "required_compliance_action",
    "proof_method",
    "submission_timing",
]

POLICY_NATURES = [
    "equipment_replacement",
    "smart_factory_automation",
    "process_quality_improvement",
    "productivity_improvement",
    "energy_efficiency",
    "facility_workplace_improvement",
    "rnd_technology",
    "certification_training_consulting",
    "finance_loan_guarantee",
    "export_marketing",
    "other",
]

SAFETY_CHECK_TYPES = [
    "guard_emergency_pinch",
    "mold_structure_drive",
    "hydraulic_pressure",
    "electric_control",
    "automation_transfer",
    "interlock_sensor",
    "inspection_education_record",
    "preventive_maintenance",
    "energy_facility_safety",
    "workplace_environment",
    "common_management",
]

POLICY_NATURE_KEYWORDS = {
    "equipment_replacement": [
        "설비교체",
        "설비 교체",
        "노후설비",
        "노후 설비",
        "장비교체",
        "장비 교체",
        "기계교체",
        "기계 교체",
        "설비개선",
        "설비 개선",
        "제조설비",
        "생산설비",
        "시설개선",
        "시설 개선",
        "노후화",
        "교체",
        "개체",
        "투자설비",
    ],
    "smart_factory_automation": [
        "스마트공장",
        "스마트 공장",
        "스마트팩토리",
        "스마트 팩토리",
        "스마트제조",
        "스마트 제조",
        "제조데이터",
        "제조 데이터",
        "자동화",
        "공정자동화",
        "공정 자동화",
        "설비자동화",
        "설비 자동화",
        "로봇",
        "협동로봇",
        "센서",
        "iot",
        "mes",
        "erp",
        "pop",
        "dx",
        "ax",
        "디지털전환",
    ],
    "process_quality_improvement": [
        "공정개선",
        "공정 개선",
        "공정혁신",
        "공정 혁신",
        "품질개선",
        "품질 개선",
        "불량률",
        "생산공정",
        "생산 공정",
        "생산라인",
        "생산 라인",
        "현장개선",
        "현장 개선",
        "작업동선",
        "작업 동선",
        "품질",
    ],
    "productivity_improvement": [
        "생산성향상",
        "생산성 향상",
        "생산성개선",
        "생산성 개선",
        "생산능력",
        "생산 능력",
        "생산효율",
        "생산 효율",
        "가동률",
        "설비가동률",
        "원가절감",
        "원가 절감",
        "비용절감",
        "비용 절감",
        "경쟁력강화",
        "경쟁력 강화",
        "납기단축",
    ],
    "energy_efficiency": [
        "에너지효율",
        "에너지 효율",
        "에너지절감",
        "에너지 절감",
        "전력절감",
        "전력 절감",
        "고효율",
        "효율향상",
        "효율 향상",
        "esco",
        "탄소중립",
        "탄소 중립",
        "온실가스",
        "전기요금",
        "전력비",
        "에너지진단",
        "에너지 진단",
        "인버터",
        "공조",
        "압축공기",
        "보일러",
        "압축기",
    ],
    "facility_workplace_improvement": [
        "작업환경개선",
        "작업환경 개선",
        "근로환경",
        "현장환경",
        "환경개선",
        "환경 개선",
        "시설개선",
        "시설 개선",
        "안전환경",
        "작업장개선",
        "작업장 개선",
        "유해위험",
        "위험개선",
        "안전개선",
    ],
    "rnd_technology": [
        "r&d",
        "연구개발",
        "기술개발",
        "시제품",
        "실증",
        "기술혁신",
        "기술사업화",
        "특허",
        "지식재산",
        "신기술",
        "개발과제",
    ],
    "certification_training_consulting": [
        "인증",
        "컨설팅",
        "교육",
        "진단",
        "멘토링",
        "자문",
        "역량강화",
        "컨설턴트",
        "교육훈련",
        "iso",
        "인증획득",
    ],
    "finance_loan_guarantee": [
        "융자",
        "대출",
        "보증",
        "이차보전",
        "자금지원",
        "운전자금",
        "시설자금",
        "정책자금",
        "금리",
    ],
    "export_marketing": [
        "수출",
        "판로",
        "마케팅",
        "전시회",
        "바이어",
        "해외진출",
        "해외시장",
        "온라인몰",
        "판매지원",
        "홍보",
    ],
}

SAFETY_CHECK_TYPE_KEYWORDS = {
    "guard_emergency_pinch": [
        "방호장치",
        "비상정지",
        "급정지",
        "덮개",
        "커버",
        "끼임",
        "협착",
        "위험방지기구",
        "안전블록",
        "양수조작",
    ],
    "mold_structure_drive": [
        "금형",
        "체결",
        "주요 구조부",
        "클러치",
        "브레이크",
        "구동부",
        "회전부",
        "마모부",
        "구조",
    ],
    "hydraulic_pressure": [
        "유압",
        "압력",
        "과부하",
        "압력용기",
        "보일러",
        "압축기",
        "공기압",
    ],
    "electric_control": [
        "전기",
        "제어",
        "제어계통",
        "제어반",
        "접지",
        "배선",
        "전원",
        "감전",
        "전장",
    ],
    "automation_transfer": [
        "자동화",
        "이송장치",
        "자동이송",
        "컨베이어",
        "로봇",
        "협동로봇",
        "산업용 로봇",
        "이송",
    ],
    "interlock_sensor": [
        "인터록",
        "센서",
        "안전문",
        "보호장치",
        "광전자",
        "라이트커튼",
    ],
    "inspection_education_record": [
        "법정 안전검사",
        "안전검사",
        "안전보건교육",
        "작업시작 전 점검",
        "자체점검",
        "점검기록",
        "검사증",
        "교육 이력",
        "보관",
        "기록",
    ],
    "preventive_maintenance": [
        "예방보전",
        "소모품",
        "윤활",
        "필터",
        "냉각",
        "마모",
        "칩 배출",
        "정비",
        "보전",
    ],
    "energy_facility_safety": [
        "보일러",
        "압축기",
        "공조",
        "압력용기",
        "전력",
        "에너지",
        "인버터",
        "냉동",
        "배기",
    ],
    "workplace_environment": [
        "작업환경",
        "바닥환경",
        "국소배기",
        "유해인자",
        "msds",
        "안전보건표지",
        "환기",
        "분진",
        "소음",
    ],
    "common_management": [
        "안전관리자",
        "안전보건관리책임자",
        "관리감독자",
        "위험성평가",
        "건강진단",
        "관리",
    ],
}

NATURE_TO_SAFETY_TYPES = {
    "equipment_replacement": [
        "guard_emergency_pinch",
        "mold_structure_drive",
        "hydraulic_pressure",
        "inspection_education_record",
    ],
    "smart_factory_automation": [
        "automation_transfer",
        "electric_control",
        "interlock_sensor",
        "guard_emergency_pinch",
    ],
    "process_quality_improvement": [
        "guard_emergency_pinch",
        "automation_transfer",
        "preventive_maintenance",
        "workplace_environment",
    ],
    "productivity_improvement": [
        "preventive_maintenance",
        "mold_structure_drive",
        "automation_transfer",
        "electric_control",
        "guard_emergency_pinch",
    ],
    "energy_efficiency": [
        "electric_control",
        "hydraulic_pressure",
        "energy_facility_safety",
        "inspection_education_record",
    ],
    "facility_workplace_improvement": [
        "workplace_environment",
        "guard_emergency_pinch",
        "inspection_education_record",
        "common_management",
    ],
    "rnd_technology": [
        "automation_transfer",
        "electric_control",
        "interlock_sensor",
        "reference_only",
    ],
    "certification_training_consulting": [
        "inspection_education_record",
        "common_management",
        "workplace_environment",
    ],
    "finance_loan_guarantee": ["reference_only"],
    "export_marketing": ["reference_only"],
    "other": ["reference_only"],
}

DIRECT_EQUIPMENT_KEYWORDS = [
    "프레스",
    "press",
    "cnc",
    "mct",
    "머시닝센터",
    "사출",
    "사출기",
    "금형",
    "로봇",
    "협동로봇",
    "컨베이어",
    "이송장치",
    "압축기",
    "보일러",
    "공조",
    "지게차",
    "크레인",
    "전기",
    "제어",
]

CANDIDATE_FIELDNAMES = [
    "policy_id",
    "policy_title",
    "policy_organization",
    "policy_nature",
    "policy_nature_confidence",
    "matched_policy_keywords",
    "rule_id",
    "equipment_category",
    "inspection_type",
    "check_item",
    "legal_basis",
    "penalty_amount_note",
    "safety_check_type",
    "match_score",
    "match_reason",
    "usage_suggestion",
]

SUMMARY_FIELDNAMES = [
    "total_policies",
    "classified_policies",
    "unclassified_policies",
    "matched_policies",
    "unmatched_policies",
    "total_candidates",
    "policy_nature_counts",
    "safety_check_type_counts",
    "usage_suggestion_counts",
    "top_matched_policy_keywords",
    "top_inspection_types",
    "top_equipment_categories",
]


def load_env() -> None:
    for env_path in [Path(".env"), Path("backend/.env")]:
        if env_path.exists():
            load_dotenv(env_path)


def create_supabase_client() -> Client:
    load_env()
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()
    if not url:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY, or SUPABASE_ANON_KEY is missing.")
    return create_client(url, key)


def fetch_all_rows(
    supabase: Client,
    table_name: str,
    batch_size: int = DEFAULT_BATCH_SIZE,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        end = start + batch_size - 1
        if limit is not None:
            end = min(end, limit - 1)
        response = supabase.table(table_name).select("*").range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size or (limit is not None and len(rows) >= limit):
            return rows[:limit] if limit is not None else rows
        start += batch_size


def stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def normalize_text(value: Any) -> str:
    text = stringify_value(value).lower()
    text = re.sub(r"[\[\]{}()<>\"'`|/\\:;,_+=~!@#$%^&*?.·ㆍ•]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def existing_fields(rows: list[dict[str, Any]], preferred_fields: list[str]) -> list[str]:
    available: set[str] = set()
    for row in rows:
        available.update(row.keys())
    return [field for field in preferred_fields if field in available]


def build_text_and_field_map(row: dict[str, Any], fields: list[str]) -> tuple[str, dict[str, str]]:
    field_texts: dict[str, str] = {}
    parts: list[str] = []
    for field in fields:
        text = normalize_text(row.get(field))
        field_texts[field] = text
        if text:
            parts.append(text)
    return normalize_text(" ".join(parts)), field_texts


def find_keywords(text: str, keywords: list[str]) -> list[str]:
    found: list[str] = []
    for keyword in keywords:
        normalized = normalize_text(keyword)
        if normalized and normalized in text and keyword not in found:
            found.append(keyword)
    return found


def matched_fields_for_keywords(field_texts: dict[str, str], keywords: list[str]) -> list[str]:
    matched: list[str] = []
    normalized_keywords = [normalize_text(keyword) for keyword in keywords if normalize_text(keyword)]
    for field, text in field_texts.items():
        if any(keyword in text for keyword in normalized_keywords):
            matched.append(field)
    return matched


def classify_policy(row: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    policy_text, field_texts = build_text_and_field_map(row, fields)
    title_text = field_texts.get("title", "")
    selected_reason_text = field_texts.get("selected_reason", "")
    classifications: list[dict[str, Any]] = []

    for nature, keywords in POLICY_NATURE_KEYWORDS.items():
        found = find_keywords(policy_text, keywords)
        if not found:
            continue
        title_matches = find_keywords(title_text, keywords)
        reason_matches = find_keywords(selected_reason_text, keywords)
        if len(found) >= 2 or title_matches:
            confidence = "high"
        elif reason_matches:
            confidence = "medium"
        else:
            confidence = "low"
        classifications.append(
            {
                "policy_nature": nature,
                "policy_nature_confidence": confidence,
                "matched_policy_keywords": found,
                "matched_policy_fields": matched_fields_for_keywords(field_texts, found),
                "policy_text": policy_text,
                "field_texts": field_texts,
            }
        )

    if classifications:
        return {
            "policy_text": policy_text,
            "field_texts": field_texts,
            "classifications": classifications,
        }

    return {
        "policy_text": policy_text,
        "field_texts": field_texts,
        "classifications": [
            {
                "policy_nature": "other",
                "policy_nature_confidence": "none",
                "matched_policy_keywords": [],
                "matched_policy_fields": [],
                "policy_text": policy_text,
                "field_texts": field_texts,
            }
        ],
    }


def classify_safety_rule(row: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    safety_text, field_texts = build_text_and_field_map(row, fields)
    classifications: list[dict[str, Any]] = []
    for safety_type, keywords in SAFETY_CHECK_TYPE_KEYWORDS.items():
        found = find_keywords(safety_text, keywords)
        if found:
            classifications.append(
                {
                    "safety_check_type": safety_type,
                    "matched_safety_keywords": found,
                    "matched_safety_fields": matched_fields_for_keywords(field_texts, found),
                }
            )

    if not classifications:
        classifications.append(
            {
                "safety_check_type": "common_management",
                "matched_safety_keywords": [],
                "matched_safety_fields": [],
            }
        )

    return {
        "safety_text": safety_text,
        "field_texts": field_texts,
        "classifications": classifications,
    }


def confidence_points(confidence: str) -> float:
    if confidence == "high":
        return 3.0
    if confidence == "medium":
        return 2.0
    return 0.0


def risk_points(risk_level: Any) -> float:
    normalized = normalize_text(risk_level)
    if normalized in {"critical", "high", "상", "높음", "위험"}:
        return 2.0
    return 0.0


def direct_equipment_matches(policy_text: str, safety_text: str, equipment_category: Any) -> list[str]:
    found: list[str] = []
    equipment_text = normalize_text(equipment_category)
    combined_safety = normalize_text(f"{safety_text} {equipment_text}")
    for keyword in DIRECT_EQUIPMENT_KEYWORDS:
        normalized = normalize_text(keyword)
        if normalized and normalized in policy_text and normalized in combined_safety:
            found.append(keyword)
    if equipment_text and equipment_text in policy_text:
        found.append(stringify_value(equipment_category))
    return sorted(set(found), key=str.lower)


def usage_suggestion_for(
    policy_nature: str,
    safety_check_type: str,
    score: float,
    direct_equipment: list[str],
) -> str:
    if "reference_only" in NATURE_TO_SAFETY_TYPES.get(policy_nature, []) and not direct_equipment:
        return "참고 근거로만 표시 권장"
    if safety_check_type == "inspection_education_record":
        return "견적·안전항목 추천에 사용 가능"
    if score >= 12 or direct_equipment:
        return "투자 전 안전 확인사항에 표시 가능"
    if policy_nature in {"smart_factory_automation", "equipment_replacement", "facility_workplace_improvement"}:
        return "정책 상세 안전점검 근거 카드에 표시 가능"
    return "신청서 보강 근거로 검토 가능"


def score_candidate(
    policy_row: dict[str, Any],
    policy_classification: dict[str, Any],
    safety_row: dict[str, Any],
    safety_analysis: dict[str, Any],
    safety_classification: dict[str, Any],
) -> dict[str, Any] | None:
    policy_nature = policy_classification["policy_nature"]
    policy_confidence = policy_classification["policy_nature_confidence"]
    safety_check_type = safety_classification["safety_check_type"]
    allowed_types = NATURE_TO_SAFETY_TYPES.get(policy_nature, ["reference_only"])
    reference_only = "reference_only" in allowed_types and safety_check_type not in allowed_types

    if safety_check_type not in allowed_types and not reference_only:
        return None

    policy_text = policy_classification["policy_text"]
    safety_text = safety_analysis["safety_text"]
    score = 0.0
    reasons: list[str] = []

    if safety_check_type in allowed_types:
        score += 5.0
        reasons.append(f"정책 성격({policy_nature})과 안전점검 유형({safety_check_type})이 매핑됨")
    elif reference_only:
        score += 5.0
        reasons.append(f"정책 성격({policy_nature})은 안전근거 직접 연결보다 참고 근거로 분류")

    direct_matches = direct_equipment_matches(policy_text, safety_text, safety_row.get("equipment_category"))
    if direct_matches:
        score += 5.0
        reasons.append("정책 텍스트와 안전근거의 설비명이 직접 매칭됨")

    score += confidence_points(policy_confidence)
    if policy_confidence in {"high", "medium"}:
        reasons.append(f"정책 성격 분류 신뢰도 {policy_confidence}")

    risk_score = risk_points(safety_row.get("risk_level"))
    if risk_score:
        score += risk_score
        reasons.append("안전근거 risk_level이 high/critical 계열")

    inspection_keywords = SAFETY_CHECK_TYPE_KEYWORDS.get(safety_check_type, [])
    inspection_matches = find_keywords(policy_text, inspection_keywords)
    if inspection_matches:
        score += 5.0
        reasons.append("정책 텍스트에 안전점검 핵심 키워드가 포함됨")

    inspection_type_matches = find_keywords(policy_text, split_meaningful_terms(safety_row.get("inspection_type")))
    if inspection_type_matches:
        score += 3.0
        reasons.append("inspection_type 핵심어가 정책 텍스트에 포함됨")

    check_item_matches = find_keywords(policy_text, split_meaningful_terms(safety_row.get("check_item")))
    if check_item_matches:
        score += 2.0
        reasons.append("check_item 핵심어가 정책 텍스트에 포함됨")

    if reference_only and not direct_matches:
        score = min(score, 6.0)

    if score < MIN_SCORE:
        return None

    matched_keywords = sorted(
        set(policy_classification["matched_policy_keywords"] + direct_matches),
        key=str.lower,
    )

    usage_suggestion = usage_suggestion_for(policy_nature, safety_check_type, score, direct_matches)
    policy_id = policy_row.get("policy_id") or policy_row.get("id") or ""

    return {
        "policy_id": policy_id,
        "policy_title": policy_row.get("title") or "",
        "policy_organization": policy_row.get("organization") or "",
        "policy_nature": policy_nature,
        "policy_nature_confidence": policy_confidence,
        "matched_policy_keywords": join_values(matched_keywords),
        "rule_id": safety_row.get("rule_id") or "",
        "equipment_category": safety_row.get("equipment_category") or "",
        "inspection_type": safety_row.get("inspection_type") or "",
        "check_item": safety_row.get("check_item") or "",
        "legal_basis": safety_row.get("legal_basis") or "",
        "penalty_amount_note": safety_row.get("penalty_amount_note") or "",
        "safety_check_type": safety_check_type,
        "match_score": f"{score:.1f}",
        "match_reason": " / ".join(reasons),
        "usage_suggestion": usage_suggestion,
        "_numeric_score": score,
        "_policy_sort_id": str(policy_id),
    }


def split_meaningful_terms(value: Any) -> list[str]:
    text = stringify_value(value)
    parts = re.split(r"[\s,/·ㆍ\-\(\)\[\]{}:;]+", text)
    terms: list[str] = []
    for part in parts:
        normalized = normalize_text(part)
        if len(normalized) < 2:
            continue
        if normalized in {"점검", "안전", "법정", "관리", "관련", "사항", "확인", "보관", "교육"}:
            continue
        terms.append(part)
    return terms


def join_values(values: list[Any]) -> str:
    return " | ".join(str(value) for value in values if value not in (None, ""))


def build_candidates(
    policy_rows: list[dict[str, Any]],
    safety_rows: list[dict[str, Any]],
    policy_fields: list[str],
    safety_fields: list[str],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    analyzed_policies = [(row, classify_policy(row, policy_fields)) for row in policy_rows]
    analyzed_safety = [(row, classify_safety_rule(row, safety_fields)) for row in safety_rows]
    candidates_by_policy: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for policy_row, policy_analysis in analyzed_policies:
        policy_id = str(policy_row.get("policy_id") or policy_row.get("id") or "")
        for policy_classification in policy_analysis["classifications"]:
            allowed_types = NATURE_TO_SAFETY_TYPES.get(policy_classification["policy_nature"], ["reference_only"])
            for safety_row, safety_analysis in analyzed_safety:
                for safety_classification in safety_analysis["classifications"]:
                    safety_type = safety_classification["safety_check_type"]
                    is_reference_candidate = "reference_only" in allowed_types and safety_type in {
                        "common_management",
                        "inspection_education_record",
                        "workplace_environment",
                    }
                    if safety_type not in allowed_types and not is_reference_candidate:
                        continue
                    candidate = score_candidate(
                        policy_row,
                        policy_classification,
                        safety_row,
                        safety_analysis,
                        safety_classification,
                    )
                    if candidate:
                        candidates_by_policy[policy_id].append(candidate)

    final_candidates: list[dict[str, Any]] = []
    for policy_id, policy_candidates in candidates_by_policy.items():
        sorted_candidates = sorted(
            policy_candidates,
            key=lambda row: (
                -float(row["_numeric_score"]),
                row["usage_suggestion"] == "참고 근거로만 표시 권장",
                row["rule_id"],
                row["safety_check_type"],
            ),
        )
        unique: list[dict[str, Any]] = []
        seen_keys: set[tuple[str, str, str]] = set()
        for row in sorted_candidates:
            key = (row["rule_id"], row["policy_nature"], row["safety_check_type"])
            if key in seen_keys:
                continue
            seen_keys.add(key)
            unique.append(row)
            if len(unique) >= TOP_N_PER_POLICY:
                break
        final_candidates.extend(unique)

    summary_context = {
        "analyzed_policies": analyzed_policies,
        "analyzed_safety": analyzed_safety,
        "candidates_by_policy": candidates_by_policy,
    }
    return final_candidates, summary_context


def strip_internal_columns(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{key: value for key, value in row.items() if not key.startswith("_")} for row in rows]


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def counter_to_text(counter: Counter[str], limit: int | None = None) -> str:
    items = counter.most_common(limit)
    return " | ".join(f"{key}:{count}" for key, count in items)


def build_summary(
    policy_rows: list[dict[str, Any]],
    safety_rows: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    summary_context: dict[str, Any],
) -> dict[str, Any]:
    policy_nature_counter: Counter[str] = Counter()
    classified_policy_ids: set[str] = set()
    for policy_row, policy_analysis in summary_context["analyzed_policies"]:
        policy_id = str(policy_row.get("policy_id") or policy_row.get("id") or "")
        policy_natures = {item["policy_nature"] for item in policy_analysis["classifications"]}
        for nature in policy_natures:
            policy_nature_counter[nature] += 1
        if policy_natures and policy_natures != {"other"}:
            classified_policy_ids.add(policy_id)

    safety_type_counter = Counter(row["safety_check_type"] for row in candidates)
    usage_counter = Counter(row["usage_suggestion"] for row in candidates)
    keyword_counter: Counter[str] = Counter()
    inspection_counter = Counter(row["inspection_type"] for row in candidates if row.get("inspection_type"))
    equipment_counter = Counter(row["equipment_category"] for row in candidates if row.get("equipment_category"))
    matched_policy_ids = {str(row["policy_id"]) for row in candidates}

    for row in candidates:
        for keyword in row["matched_policy_keywords"].split(" | "):
            if keyword:
                keyword_counter[keyword] += 1

    return {
        "total_policies": len(policy_rows),
        "classified_policies": len(classified_policy_ids),
        "unclassified_policies": len(policy_rows) - len(classified_policy_ids),
        "matched_policies": len(matched_policy_ids),
        "unmatched_policies": len(policy_rows) - len(matched_policy_ids),
        "total_candidates": len(candidates),
        "policy_nature_counts": counter_to_text(policy_nature_counter),
        "safety_check_type_counts": counter_to_text(safety_type_counter),
        "usage_suggestion_counts": counter_to_text(usage_counter),
        "top_matched_policy_keywords": counter_to_text(keyword_counter, 20),
        "top_inspection_types": counter_to_text(inspection_counter, 20),
        "top_equipment_categories": counter_to_text(equipment_counter, 20),
    }


def print_summary(summary: dict[str, Any], candidates: list[dict[str, Any]]) -> None:
    print("[SUMMARY]")
    print(f"Total policies: {summary['total_policies']}")
    print(f"Classified policies: {summary['classified_policies']}")
    print(f"Unclassified policies: {summary['unclassified_policies']}")
    print(f"Matched policies: {summary['matched_policies']}")
    print(f"Unmatched policies: {summary['unmatched_policies']}")
    print(f"Total candidates: {summary['total_candidates']}")
    print()

    print("[POLICY NATURE COUNTS]")
    nature_counts = parse_counter_text(summary["policy_nature_counts"])
    for nature in POLICY_NATURES:
        print(f"{nature}: {nature_counts.get(nature, 0)}")
    print()

    print("[SAFETY CHECK TYPE COUNTS]")
    safety_counts = parse_counter_text(summary["safety_check_type_counts"])
    for safety_type in SAFETY_CHECK_TYPES:
        print(f"{safety_type}: {safety_counts.get(safety_type, 0)}")
    print()

    print("[TOP MATCHED POLICIES]")
    by_policy: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in candidates:
        by_policy[str(row["policy_id"])].append(row)
    ranked = sorted(by_policy.items(), key=lambda item: (-len(item[1]), item[0]))[:10]
    for idx, (policy_id, rows) in enumerate(ranked, start=1):
        first = rows[0]
        top_safety_checks = join_values([row["safety_check_type"] for row in rows[:5]])
        print(
            f"{idx}. policy_id={policy_id}, title={first['policy_title']}, "
            f"policy_nature={first['policy_nature']}, candidate_count={len(rows)}, "
            f"top_safety_checks={top_safety_checks}"
        )
    print()
    print(f"CSV: {OUTPUT_CANDIDATES}")
    print(f"Summary CSV: {OUTPUT_SUMMARY}")
    print("Run command: python data/scripts/analyze_policy_nature_safety_rule_matches.py")


def parse_counter_text(value: str) -> dict[str, int]:
    parsed: dict[str, int] = {}
    if not value:
        return parsed
    for item in value.split(" | "):
        if ":" not in item:
            continue
        key, count_text = item.rsplit(":", 1)
        try:
            parsed[key] = int(count_text)
        except ValueError:
            parsed[key] = 0
    return parsed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Classify policy natures and match safety_rule_legal check candidates."
    )
    parser.add_argument("--limit-policies", type=int, default=None, help="Read only N policy rows for testing.")
    parser.add_argument("--limit-safety-rules", type=int, default=None, help="Read only N safety rows for testing.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    supabase = create_supabase_client()
    policy_rows = fetch_all_rows(supabase, POLICY_TABLE, limit=args.limit_policies)
    safety_rows = fetch_all_rows(supabase, SAFETY_TABLE, limit=args.limit_safety_rules)

    policy_fields = existing_fields(policy_rows, POLICY_TEXT_FIELDS)
    safety_fields = existing_fields(safety_rows, SAFETY_TEXT_FIELDS)

    candidates, summary_context = build_candidates(policy_rows, safety_rows, policy_fields, safety_fields)
    candidates = sorted(
        candidates,
        key=lambda row: (
            row["_policy_sort_id"],
            -float(row["_numeric_score"]),
            row["rule_id"],
            row["safety_check_type"],
        ),
    )
    summary = build_summary(policy_rows, safety_rows, candidates, summary_context)

    write_csv(OUTPUT_CANDIDATES, strip_internal_columns(candidates), CANDIDATE_FIELDNAMES)
    write_csv(OUTPUT_SUMMARY, [summary], SUMMARY_FIELDNAMES)
    print_summary(summary, candidates)


if __name__ == "__main__":
    main()
