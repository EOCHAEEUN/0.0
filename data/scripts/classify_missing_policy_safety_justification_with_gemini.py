from __future__ import annotations

import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client


SCRIPT_DIR = Path(__file__).resolve().parent

for env_path in [
    Path.cwd() / ".env",
    SCRIPT_DIR / ".env",
    SCRIPT_DIR.parent / ".env",
    SCRIPT_DIR.parent.parent / ".env",
    SCRIPT_DIR / "backend" / ".env",
    SCRIPT_DIR.parent / "backend" / ".env",
    SCRIPT_DIR.parent.parent / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()
GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or ""
).strip()
DEFAULT_MODEL = (
    os.getenv("GEMINI_MODEL")
    or os.getenv("DATA_LLM_MODEL")
    or "gemini-2.5-flash-lite"
).replace("google/", "").removeprefix("models/")

POLICY_SELECT = (
    "policy_id,title,organization,policy_category,policy_subcategory,"
    "service_category,service_subcategory,summary,eligibility_text,"
    "support_method,support_items,roi_support_type,max_amount_type,"
    "max_amount_note,max_amount_evidence,attachment_text,raw_text,"
    "safety_justification_usable"
)
SAFETY_SELECT = "policy_id,safety_justification_usable"

NATURES = [
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
USABLE_LABELS = ["사용 가능", "조건부 사용 가능", "사용 어려움", "판단불가"]
STRENGTH_LABELS = ["강함", "보통", "약함", "없음", "판단불가"]
REFLECTION_LABELS = ["반영 권장", "검토 후 반영", "반영 비권장", "판단불가"]
VIEWPOINTS = [
    "작업자 위험 노출 감소",
    "설비 운용 안정성 개선",
    "자동화 안전성 보완",
    "전기·제어계통 안정성 확보",
    "설치 후 검수·점검기록 관리",
    "작업환경 개선",
    "에너지설비 운전 안정성 확보",
    "유지보수 부담 감소",
    "사고 예방 및 사후관리 체계 보완",
    "참고 근거로만 사용",
]
GEMINI_TIMEOUT_SECONDS = 60


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean_text(value: Any, max_len: int | None = None) -> str:
    if value is None:
        return ""
    text = str(value).replace("\x00", "").strip()
    text = re.sub(r"\s+", " ", text)
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def fetch_all(supabase: Client, table: str, select: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        batch = supabase.table(table).select(select).range(start, end).execute().data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size
    return rows


def normalize_choice(value: Any, allowed: list[str], fallback: str) -> str:
    text = clean_text(value)
    return text if text in allowed else fallback


def normalize_list(value: Any, allowed: list[str], max_items: int) -> list[str]:
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = re.split(r"[,|/]", clean_text(value))
    items: list[str] = []
    for raw in raw_items:
        text = clean_text(raw)
        if text and text in allowed and text not in items:
            items.append(text)
    return items[:max_items]


def extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.I).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        cleaned = cleaned[start : end + 1]
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("Gemini response is not a JSON object")
    return parsed


def build_prompt(row: dict[str, Any]) -> str:
    policy_payload = {
        "policy_id": clean_text(row.get("policy_id")),
        "title": clean_text(row.get("title"), 500),
        "organization": clean_text(row.get("organization"), 200),
        "policy_category": clean_text(row.get("policy_category"), 250),
        "policy_subcategory": clean_text(row.get("policy_subcategory"), 250),
        "service_category": clean_text(row.get("service_category"), 250),
        "service_subcategory": clean_text(row.get("service_subcategory"), 250),
        "roi_support_type": clean_text(row.get("roi_support_type"), 100),
        "max_amount_type": clean_text(row.get("max_amount_type"), 100),
        "summary": clean_text(row.get("summary"), 1400),
        "eligibility_text": clean_text(row.get("eligibility_text"), 900),
        "support_method": clean_text(row.get("support_method"), 600),
        "support_items": clean_text(row.get("support_items"), 800),
        "max_amount_note": clean_text(row.get("max_amount_note"), 500),
        "max_amount_evidence": clean_text(row.get("max_amount_evidence"), 900),
        "attachment_or_raw_excerpt": clean_text(row.get("attachment_text") or row.get("raw_text"), 1400),
    }
    return f"""
당신은 제조업 정부지원사업 신청서에 '안전개선 정당성 문장'을 넣어도 자연스러운지 분류하는 검토자입니다.
정책 공고 정보만 보고 판단하세요. 안전 법령 rule_id를 직접 매칭하지 말고, 신청서 문장 반영 가능성만 판단하세요.

정책 주성격은 아래 중 하나만 고릅니다.
{", ".join(NATURES)}

안전개선문장 사용가능여부:
- 사용 가능: 설비투자, 노후설비 개선, 자동화, 공정개선, 생산성 향상, 에너지효율, 작업환경개선과 직접 관련이 있어 신청서에 안전개선 정당성 문장이 자연스러운 경우
- 조건부 사용 가능: R&D, 컨설팅, 인증, 기술지원처럼 간접 성격이지만 사용자가 선택한 설비투자/자동화/에너지설비/현장개선 맥락에서는 자연스러운 경우
- 사용 어려움: 수출, 판로, 마케팅, 일반 교육, 인력, 단순 비현금 서비스 등 안전개선 문장과 직접 관련성이 낮은 경우
- 판단불가: 공고 정보가 너무 부족한 경우

신청서 반영 추천:
- 반영 권장: 사용 가능이면서 강함 또는 보통
- 검토 후 반영: 조건부 사용 가능이거나 강도가 약함
- 반영 비권장: 사용 어려움 또는 강도 없음
- 판단불가: 정보 부족

반드시 아래 JSON 형식만 반환하세요.
{{
  "policy_primary_nature": "정책 주성격",
  "policy_secondary_natures": ["보조 성격"],
  "safety_justification_usable": "사용 가능|조건부 사용 가능|사용 어려움|판단불가",
  "safety_justification_strength": "강함|보통|약함|없음|판단불가",
  "recommended_safety_viewpoints": ["{VIEWPOINTS[0]}"],
  "application_reflection_recommendation": "반영 권장|검토 후 반영|반영 비권장|판단불가",
  "judgment_reason": "한두 문장의 판단 근거",
  "not_suitable_reason": "부적합한 경우 사유, 아니면 빈 문자열",
  "evidence_keywords": ["판단에 사용한 핵심 키워드"]
}}

공고 정보:
{json.dumps(policy_payload, ensure_ascii=False)}
""".strip()


def call_gemini(row: dict[str, Any], *, model: str) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing")
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": GEMINI_API_KEY},
        json={
            "contents": [{"role": "user", "parts": [{"text": build_prompt(row)}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        },
        timeout=GEMINI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    parsed = extract_json(text)
    primary = normalize_choice(parsed.get("policy_primary_nature"), NATURES, "기타/분류불가")
    secondary = [item for item in normalize_list(parsed.get("policy_secondary_natures"), NATURES, 4) if item != primary]
    usable = normalize_choice(parsed.get("safety_justification_usable"), USABLE_LABELS, "판단불가")
    strength = normalize_choice(parsed.get("safety_justification_strength"), STRENGTH_LABELS, "판단불가")
    viewpoints = normalize_list(parsed.get("recommended_safety_viewpoints"), VIEWPOINTS, 4)
    reflection = normalize_choice(parsed.get("application_reflection_recommendation"), REFLECTION_LABELS, "판단불가")
    return {
        "policy_primary_nature": primary,
        "policy_secondary_natures": " | ".join(secondary),
        "safety_justification_usable": usable,
        "safety_justification_strength": strength,
        "recommended_safety_viewpoints": " | ".join(viewpoints),
        "application_reflection_recommendation": reflection,
        "judgment_reason": clean_text(parsed.get("judgment_reason"), 700),
        "not_suitable_reason": clean_text(parsed.get("not_suitable_reason"), 700),
        "evidence_keywords": " | ".join(clean_text(item) for item in (parsed.get("evidence_keywords") or [])[:12])
        if isinstance(parsed.get("evidence_keywords"), list)
        else clean_text(parsed.get("evidence_keywords"), 500),
    }


def failure_result(exc: Exception) -> dict[str, Any]:
    return {
        "policy_primary_nature": "기타/분류불가",
        "policy_secondary_natures": "",
        "safety_justification_usable": "판단불가",
        "safety_justification_strength": "판단불가",
        "recommended_safety_viewpoints": "",
        "application_reflection_recommendation": "판단불가",
        "judgment_reason": f"Gemini 분류 실패: {clean_text(exc, 500)}",
        "not_suitable_reason": "",
        "evidence_keywords": "",
    }


def analysis_payload(row: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "policy_id": clean_text(row.get("policy_id")),
        "policy_title": clean_text(row.get("title")),
        "policy_organization": clean_text(row.get("organization")),
        **result,
        "source_csv_path": "db:classify_missing_policy_safety_justification_with_gemini.py",
        "updated_at": now,
    }


def policy_payload(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_primary_nature": result.get("policy_primary_nature"),
        "safety_justification_usable": result.get("safety_justification_usable"),
        "safety_justification_strength": result.get("safety_justification_strength"),
        "recommended_safety_viewpoints": result.get("recommended_safety_viewpoints"),
        "application_reflection_recommendation": result.get("application_reflection_recommendation"),
        "safety_justification_reason": result.get("judgment_reason"),
        "safety_justification_synced_at": datetime.now(timezone.utc).isoformat(),
    }


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Classify policy rows missing safety-justification fields and backfill policy."
    )
    parser.add_argument("--apply", action="store_true", help="Call Gemini and write DB updates. Default is dry-run.")
    parser.add_argument("--limit", type=int, default=0, help="0 means all missing rows.")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--sleep", type=float, default=0.2)
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    policy_rows = fetch_all(supabase, "policy", POLICY_SELECT)
    safety_rows = fetch_all(supabase, "policy_ai_safety_justification", SAFETY_SELECT)
    existing_safety_ids = {
        clean_text(row.get("policy_id"))
        for row in safety_rows
        if clean_text(row.get("policy_id")) and clean_text(row.get("safety_justification_usable"))
    }
    targets = [
        row
        for row in policy_rows
        if clean_text(row.get("policy_id"))
        and not clean_text(row.get("safety_justification_usable"))
        and clean_text(row.get("policy_id")) not in existing_safety_ids
    ]
    if args.limit > 0:
        targets = targets[: args.limit]

    print(
        f"policy_rows={len(policy_rows)} "
        f"existing_safety_rows={len(existing_safety_ids)} "
        f"missing_targets={len(targets)} "
        f"apply={args.apply} "
        f"model={args.model}"
    )
    for row in targets[:20]:
        print(
            "  target | "
            f"{clean_text(row.get('policy_id'))} | "
            f"{clean_text(row.get('roi_support_type'))} | "
            f"{clean_text(row.get('service_category'))} | "
            f"{clean_text(row.get('title'), 80)}"
        )

    if not args.apply:
        print("Dry-run complete. Add --apply to call Gemini and update DB.")
        return

    counts: dict[str, int] = {}
    for index, row in enumerate(targets, start=1):
        policy_id = clean_text(row.get("policy_id"))
        try:
            result = call_gemini(row, model=args.model)
        except Exception as exc:  # noqa: BLE001 - keep batch moving.
            result = failure_result(exc)
        counts[result["safety_justification_usable"]] = counts.get(result["safety_justification_usable"], 0) + 1
        supabase.table("policy_ai_safety_justification").upsert(
            analysis_payload(row, result),
            on_conflict="policy_id",
        ).execute()
        supabase.table("policy").update(policy_payload(result)).eq("policy_id", policy_id).execute()
        print(
            f"{index}/{len(targets)} | {policy_id} | "
            f"{result['safety_justification_usable']} | "
            f"{result['application_reflection_recommendation']} | "
            f"{clean_text(row.get('title'), 70)}",
            flush=True,
        )
        if args.sleep > 0:
            time.sleep(args.sleep)

    print(f"Done. classified={len(targets)} counts={counts}", flush=True)


if __name__ == "__main__":
    main()
