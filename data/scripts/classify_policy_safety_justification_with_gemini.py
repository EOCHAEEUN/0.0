"""Classify whether each policy can use safety-improvement justification text.

Read-only Supabase usage:
  - reads policy

No insert/update/delete/upsert/rpc is used. Results are written only as CSV.

Run:
  python data/scripts/classify_policy_safety_justification_with_gemini.py

Test:
  python data/scripts/classify_policy_safety_justification_with_gemini.py --limit 20

Resume:
  python data/scripts/classify_policy_safety_justification_with_gemini.py --resume
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client


POLICY_TABLE = "policy"
DEFAULT_BATCH_SIZE = 500
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

OUTPUT_CLASSIFICATION = Path("reports/policy_ai_safety_justification_classification.csv")
OUTPUT_PARTIAL = Path("reports/policy_ai_safety_justification_classification.partial.csv")
OUTPUT_SUMMARY = Path("reports/policy_ai_safety_justification_summary.csv")

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

PROMPT_FIELD_PRIORITY = [
    ("title", 500),
    ("organization", 200),
    ("policy_category", 250),
    ("policy_subcategory", 250),
    ("category", 250),
    ("sub_category", 250),
    ("selected_reason", 1200),
    ("support_content", 1600),
    ("description", 1600),
    ("eligibility_text", 1200),
    ("temp_extraction_json", 1600),
    ("source_api_json", 1200),
    ("attachment_text", 1000),
    ("url", 300),
]

POLICY_NATURES = [
    "설비교체/노후설비 개선",
    "스마트공장/자동화",
    "공정개선/품질개선",
    "생산성 향상/가동률 개선",
    "에너지효율/전력절감",
    "시설개선/작업환경개선",
    "R&D/기술개발",
    "인증/교육/컨설팅",
    "자금지원/융자/보증",
    "수출/판로/마케팅",
    "기타/분류불가",
]

USABLE_LABELS = [
    "사용 가능",
    "조건부 사용 가능",
    "사용 어려움",
    "판단불가",
]

STRENGTH_LABELS = [
    "강함",
    "보통",
    "약함",
    "없음",
    "판단불가",
]

APPLICATION_RECOMMENDATION_LABELS = [
    "반영 권장",
    "검토 후 반영",
    "반영 비권장",
    "판단불가",
]

SAFETY_VIEWPOINTS = [
    "작업자 위험 노출 감소",
    "설비 이용 안정성 개선",
    "자동화 안전성 보완",
    "전기·제어계통 안정성 확보",
    "설치 후 검사·교육·점검기록 관리",
    "작업환경 개선",
    "에너지설비 운전 안정성 확보",
    "유지보수 부담 감소",
    "사고 예방 및 사후관리 체계 보완",
    "참고 근거로만 사용",
]

CANDIDATE_FIELDNAMES = [
    "policy_id",
    "policy_title",
    "policy_organization",
    "정책_주성격",
    "정책_보조성격",
    "안전개선문장_사용가능여부",
    "안전개선문장_사용강도",
    "추천_안전개선관점",
    "신청서_반영_추천여부",
    "판단근거",
    "부적합사유",
    "근거키워드",
]

SUMMARY_FIELDNAMES = [
    "total_policies",
    "classified_policies",
    "unusable_or_failed_policies",
    "usable_policies",
    "conditional_usable_policies",
    "difficult_policies",
    "recommended_reflection_policies",
    "review_reflection_policies",
    "not_recommended_policies",
    "primary_nature_counts",
    "safety_justification_usable_counts",
    "safety_justification_strength_counts",
    "recommended_safety_viewpoint_counts",
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


def fetch_all_policy_rows(
    supabase: Client,
    batch_size: int = DEFAULT_BATCH_SIZE,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        end = start + batch_size - 1
        if limit is not None:
            end = min(end, limit - 1)
        response = supabase.table(POLICY_TABLE).select("*").range(start, end).execute()
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


def truncate_text(value: Any, max_length: int) -> str:
    text = stringify_value(value)
    if len(text) <= max_length:
        return text
    return text[: max_length - 20] + "\n...[truncated]"


def existing_fields(rows: list[dict[str, Any]], preferred_fields: list[str]) -> list[str]:
    available: set[str] = set()
    for row in rows:
        available.update(row.keys())
    return [field for field in preferred_fields if field in available]


def get_policy_id(row: dict[str, Any]) -> str:
    return str(row.get("policy_id") or row.get("id") or "").strip()


def build_policy_payload(row: dict[str, Any], existing_policy_fields: list[str]) -> dict[str, str]:
    payload: dict[str, str] = {}
    for field, max_length in PROMPT_FIELD_PRIORITY:
        if field in existing_policy_fields:
            payload[field] = truncate_text(row.get(field), max_length)
    return payload


def join_values(values: Any) -> str:
    if values is None:
        return ""
    if isinstance(values, list):
        return " | ".join(str(value).strip() for value in values if str(value).strip())
    return str(values).strip()


def normalize_choice(value: Any, allowed: list[str], fallback: str) -> str:
    text = str(value or "").strip()
    return text if text in allowed else fallback


def normalize_list(value: Any, allowed: list[str] | None = None, max_items: int | None = None) -> list[str]:
    if value is None:
        items: list[Any] = []
    elif isinstance(value, list):
        items = value
    else:
        items = re.split(r"[,|/]", str(value))
    normalized: list[str] = []
    for item in items:
        text = str(item).strip()
        if not text:
            continue
        if allowed is not None and text not in allowed:
            continue
        if text not in normalized:
            normalized.append(text)
    if max_items is not None:
        normalized = normalized[:max_items]
    return normalized


def extract_json_object(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in Gemini response.")
    return json.loads(match.group(0))


def build_prompt(row: dict[str, Any], existing_policy_fields: list[str]) -> str:
    payload = {
        "policy_id": get_policy_id(row),
        "policy": build_policy_payload(row, existing_policy_fields),
    }
    return (
        "당신은 제조업 정책지원 신청서 검토를 돕는 한국어 분류기입니다.\n"
        "policy 테이블의 정책 정보만 보고, 신청서에 '안전개선 정당성 문장'을 넣는 것이 자연스러운지 분류하세요.\n"
        "이번 단계에서는 safety_rule_legal.rule_id를 절대 직접 매칭하지 않습니다.\n"
        "신청서 문장을 생성하지 말고, 분류와 판단근거만 작성하세요.\n"
        "모든 값은 한국어 라벨로만 반환하세요. high/medium/true/false 같은 영어 enum을 쓰지 마세요.\n\n"
        "정책 주성격 후보 중 1개만 선택:\n"
        f"{', '.join(POLICY_NATURES)}\n\n"
        "정책 보조성격은 0개 이상 선택 가능하되, 후보 라벨만 사용하세요.\n\n"
        "안전개선문장_사용가능여부 후보:\n"
        f"{', '.join(USABLE_LABELS)}\n\n"
        "분류 기준:\n"
        "- 사용 가능: 설비투자, 노후설비 개선, 자동화, 공정개선, 생산성 향상, 에너지효율, 작업환경개선과 직접 관련이 있어 신청서에 안전개선 정당성 문장이 자연스러운 경우\n"
        "- 조건부 사용 가능: R&D, 컨설팅, 자금지원 등 간접 성격이지만 사용자가 선택한 투자안이 제조설비/자동화/에너지설비/현장개선일 때만 자연스러운 경우\n"
        "- 사용 어려움: 수출, 판로, 마케팅, 일반 창업교육, 일반 운전자금 등 안전개선 문장과 직접 관련성이 낮은 경우\n"
        "- 판단불가: 정책 정보가 너무 부족한 경우\n\n"
        "안전개선문장_사용강도 후보:\n"
        f"{', '.join(STRENGTH_LABELS)}\n\n"
        "추천_안전개선관점 후보 중 자연스러운 것만 0~4개 선택:\n"
        f"{', '.join(SAFETY_VIEWPOINTS)}\n\n"
        "신청서_반영_추천여부 후보:\n"
        f"{', '.join(APPLICATION_RECOMMENDATION_LABELS)}\n\n"
        "반영 추천 기준:\n"
        "- 반영 권장: 사용 가능이면서 강함 또는 보통\n"
        "- 검토 후 반영: 조건부 사용 가능이거나 사용강도가 약함\n"
        "- 반영 비권장: 사용 어려움 또는 사용강도 없음\n"
        "- 판단불가: 정보 부족\n\n"
        "반드시 아래 JSON 스키마로만 응답하세요.\n"
        "{\n"
        '  "policy_primary_nature": "정책 주성격 후보 중 1개",\n'
        '  "policy_secondary_natures": ["정책 보조성격 후보"],\n'
        '  "safety_justification_usable": "사용 가능 | 조건부 사용 가능 | 사용 어려움 | 판단불가",\n'
        '  "safety_justification_strength": "강함 | 보통 | 약함 | 없음 | 판단불가",\n'
        '  "recommended_safety_viewpoints": ["추천 안전개선관점 후보"],\n'
        '  "application_reflection_recommendation": "반영 권장 | 검토 후 반영 | 반영 비권장 | 판단불가",\n'
        '  "judgment_reason": "한두 문장의 판단 근거",\n'
        '  "not_suitable_reason": "부적합한 경우 사유, 아니면 빈 문자열",\n'
        '  "evidence_keywords": ["판단에 사용한 정책 텍스트 키워드"]\n'
        "}\n\n"
        f"INPUT:\n{json.dumps(payload, ensure_ascii=False)}"
    )


def sanitize_error(error: Any) -> str:
    text = str(error)
    text = re.sub(r"([?&]key=)[^&\s]+", r"\1[REDACTED]", text)
    return text[:500]


def call_gemini(
    prompt: str,
    *,
    model: str,
    api_key: str,
    timeout: int = 90,
    max_attempts: int = 3,
) -> dict[str, Any]:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model.removeprefix('models/')}:generateContent"
    )
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
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
            if response.status_code in {429, 500, 502, 503, 504} and attempt < max_attempts:
                time.sleep(2 * attempt)
                continue
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
        except Exception as exc:  # noqa: BLE001 - retry transient Gemini failures.
            last_error = exc
            if attempt < max_attempts:
                time.sleep(2 * attempt)
                continue
    if last_error:
        raise last_error
    raise RuntimeError("Gemini call failed without an exception.")


def failed_row(row: dict[str, Any], error: str) -> dict[str, str]:
    return {
        "policy_id": get_policy_id(row),
        "policy_title": stringify_value(row.get("title")),
        "policy_organization": stringify_value(row.get("organization")),
        "정책_주성격": "기타/분류불가",
        "정책_보조성격": "",
        "안전개선문장_사용가능여부": "판단불가",
        "안전개선문장_사용강도": "판단불가",
        "추천_안전개선관점": "",
        "신청서_반영_추천여부": "판단불가",
        "판단근거": "Gemini 호출 또는 응답 파싱에 실패하여 자동 판단하지 못했습니다.",
        "부적합사유": sanitize_error(error),
        "근거키워드": "",
    }


def normalize_gemini_result(row: dict[str, Any], result: dict[str, Any]) -> dict[str, str]:
    primary = normalize_choice(result.get("policy_primary_nature"), POLICY_NATURES, "기타/분류불가")
    secondary = normalize_list(result.get("policy_secondary_natures"), POLICY_NATURES)
    secondary = [item for item in secondary if item != primary]
    usable = normalize_choice(result.get("safety_justification_usable"), USABLE_LABELS, "판단불가")
    strength = normalize_choice(result.get("safety_justification_strength"), STRENGTH_LABELS, "판단불가")
    viewpoints = normalize_list(result.get("recommended_safety_viewpoints"), SAFETY_VIEWPOINTS, 4)
    recommendation = normalize_choice(
        result.get("application_reflection_recommendation"),
        APPLICATION_RECOMMENDATION_LABELS,
        "판단불가",
    )
    return {
        "policy_id": get_policy_id(row),
        "policy_title": stringify_value(row.get("title")),
        "policy_organization": stringify_value(row.get("organization")),
        "정책_주성격": primary,
        "정책_보조성격": join_values(secondary),
        "안전개선문장_사용가능여부": usable,
        "안전개선문장_사용강도": strength,
        "추천_안전개선관점": join_values(viewpoints),
        "신청서_반영_추천여부": recommendation,
        "판단근거": stringify_value(result.get("judgment_reason")).strip(),
        "부적합사유": stringify_value(result.get("not_suitable_reason")).strip(),
        "근거키워드": join_values(normalize_list(result.get("evidence_keywords"), None, 12)),
    }


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def read_existing_results(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def is_gemini_failure_row(row: dict[str, Any]) -> bool:
    return str(row.get("판단근거") or "").startswith("Gemini 호출 또는 응답 파싱에 실패")


def load_resume_ids() -> set[str]:
    processed: set[str] = set()
    for path in [OUTPUT_CLASSIFICATION, OUTPUT_PARTIAL]:
        for row in read_existing_results(path):
            policy_id = str(row.get("policy_id") or "").strip()
            if policy_id:
                processed.add(policy_id)
    return processed


def counter_text(counter: Counter[str]) -> str:
    return " | ".join(f"{key}:{count}" for key, count in counter.most_common())


def split_joined(value: str) -> list[str]:
    return [item.strip() for item in str(value or "").split(" | ") if item.strip()]


def build_summary(rows: list[dict[str, Any]], total_policies: int) -> dict[str, Any]:
    usable_counter = Counter(row.get("안전개선문장_사용가능여부", "") for row in rows)
    strength_counter = Counter(row.get("안전개선문장_사용강도", "") for row in rows)
    recommendation_counter = Counter(row.get("신청서_반영_추천여부", "") for row in rows)
    nature_counter = Counter(row.get("정책_주성격", "") for row in rows)
    viewpoint_counter: Counter[str] = Counter()
    for row in rows:
        for viewpoint in split_joined(row.get("추천_안전개선관점", "")):
            viewpoint_counter[viewpoint] += 1

    unusable_or_failed = (
        usable_counter.get("사용 어려움", 0)
        + usable_counter.get("판단불가", 0)
    )
    return {
        "total_policies": total_policies,
        "classified_policies": len(rows),
        "unusable_or_failed_policies": unusable_or_failed,
        "usable_policies": usable_counter.get("사용 가능", 0),
        "conditional_usable_policies": usable_counter.get("조건부 사용 가능", 0),
        "difficult_policies": usable_counter.get("사용 어려움", 0),
        "recommended_reflection_policies": recommendation_counter.get("반영 권장", 0),
        "review_reflection_policies": recommendation_counter.get("검토 후 반영", 0),
        "not_recommended_policies": recommendation_counter.get("반영 비권장", 0),
        "primary_nature_counts": counter_text(nature_counter),
        "safety_justification_usable_counts": counter_text(usable_counter),
        "safety_justification_strength_counts": counter_text(strength_counter),
        "recommended_safety_viewpoint_counts": counter_text(viewpoint_counter),
    }


def print_summary(summary: dict[str, Any]) -> None:
    print("[SUMMARY]")
    print(f"Total policies: {summary['total_policies']}")
    print(f"Classified policies: {summary['classified_policies']}")
    print(f"사용 가능: {summary['usable_policies']}")
    print(f"조건부 사용 가능: {summary['conditional_usable_policies']}")
    print(f"사용 어려움: {summary['difficult_policies']}")
    print(f"판단불가: {summary['unusable_or_failed_policies'] - summary['difficult_policies']}")
    print()
    print("[신청서 반영 추천]")
    print(f"반영 권장: {summary['recommended_reflection_policies']}")
    print(f"검토 후 반영: {summary['review_reflection_policies']}")
    print(f"반영 비권장: {summary['not_recommended_policies']}")
    print()
    print("[정책 주성격 분포]")
    nature_counts = parse_counter_text(summary["primary_nature_counts"])
    for nature in POLICY_NATURES:
        print(f"{nature}: {nature_counts.get(nature, 0)}")
    print()
    print("[추천 안전개선 관점 TOP]")
    viewpoint_counts = parse_counter_text(summary["recommended_safety_viewpoint_counts"])
    for viewpoint in SAFETY_VIEWPOINTS:
        print(f"{viewpoint}: {viewpoint_counts.get(viewpoint, 0)}")
    print()
    print(f"CSV: {OUTPUT_CLASSIFICATION}")
    print(f"Summary CSV: {OUTPUT_SUMMARY}")
    print("Run command: python data/scripts/classify_policy_safety_justification_with_gemini.py")


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


def dry_run(policy_rows: list[dict[str, Any]], existing_policy_fields: list[str], limit: int | None) -> None:
    sample_rows = policy_rows[: limit or 3]
    print("[DRY RUN]")
    print(f"Total fetched policies: {len(policy_rows)}")
    print(f"Sample policies: {len(sample_rows)}")
    for row in sample_rows:
        prompt = build_prompt(row, existing_policy_fields)
        print("-" * 80)
        print(f"policy_id={get_policy_id(row)} title={row.get('title')}")
        print(f"prompt_chars={len(prompt)}")
        print(prompt[:1200])


def classify_rows(
    policy_rows: list[dict[str, Any]],
    existing_policy_fields: list[str],
    *,
    model: str,
    sleep_seconds: float,
    resume: bool,
    retry_failed: bool,
) -> list[dict[str, Any]]:
    api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing.")

    rows: list[dict[str, Any]] = []
    if resume:
        for existing_row in read_existing_results(OUTPUT_CLASSIFICATION):
            if retry_failed and is_gemini_failure_row(existing_row):
                continue
            rows.append(existing_row)
        existing_ids = {str(row.get("policy_id") or "").strip() for row in rows if row.get("policy_id")}
        for partial_row in read_existing_results(OUTPUT_PARTIAL):
            policy_id = str(partial_row.get("policy_id") or "").strip()
            if retry_failed and is_gemini_failure_row(partial_row):
                continue
            if policy_id and policy_id not in existing_ids:
                rows.append(partial_row)
                existing_ids.add(policy_id)
        processed_ids = existing_ids
    else:
        processed_ids = set()

    target_rows = [row for row in policy_rows if get_policy_id(row) not in processed_ids]
    total = len(target_rows)
    for index, row in enumerate(target_rows, start=1):
        try:
            result = call_gemini(
                build_prompt(row, existing_policy_fields),
                model=model,
                api_key=api_key,
            )
            output_row = normalize_gemini_result(row, result)
        except Exception as exc:  # noqa: BLE001 - keep batch running.
            output_row = failed_row(row, str(exc))
        rows.append(output_row)

        if index % 10 == 0 or index == total:
            print(f"Processed {index}/{total} in this run, total saved rows={len(rows)}")
        if index % 50 == 0 or index == total:
            write_csv(OUTPUT_PARTIAL, rows, CANDIDATE_FIELDNAMES)
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Classify policy safety-justification usability with Gemini."
    )
    parser.add_argument("--limit", type=int, default=None, help="Process only N policy rows.")
    parser.add_argument("--resume", action="store_true", help="Skip policy_id values already in output CSVs.")
    parser.add_argument("--retry-failed", action="store_true", help="With --resume, retry rows that had Gemini failures.")
    parser.add_argument("--dry-run", action="store_true", help="Print prompt samples without calling Gemini.")
    parser.add_argument("--model", default=DEFAULT_GEMINI_MODEL, help="Gemini model name.")
    parser.add_argument("--sleep", type=float, default=0.2, help="Sleep seconds between Gemini calls.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    supabase = create_supabase_client()
    policy_rows = fetch_all_policy_rows(supabase, limit=args.limit)
    existing_policy_fields = existing_fields(policy_rows, POLICY_TEXT_FIELDS)

    if args.dry_run:
        dry_run(policy_rows, existing_policy_fields, args.limit)
        return

    rows = classify_rows(
        policy_rows,
        existing_policy_fields,
        model=args.model,
        sleep_seconds=args.sleep,
        resume=args.resume,
        retry_failed=args.retry_failed,
    )
    rows = sorted(rows, key=lambda row: str(row.get("policy_id") or ""))
    summary = build_summary(rows, total_policies=len(policy_rows))
    write_csv(OUTPUT_CLASSIFICATION, rows, CANDIDATE_FIELDNAMES)
    write_csv(OUTPUT_PARTIAL, rows, CANDIDATE_FIELDNAMES)
    write_csv(OUTPUT_SUMMARY, [summary], SUMMARY_FIELDNAMES)
    print_summary(summary)


if __name__ == "__main__":
    main()
