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

from sync_policy_from_validation import (
    amount_type_to_korean,
    build_max_amount_type_reason,
    classify_roi_apply_method,
    normalize_amount_type_key,
)


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
    or "gemini-2.5-flash"
).replace("google/", "").removeprefix("models/")
DEFAULT_CACHE_PATH = SCRIPT_DIR.parent / "cache" / "policy_roi_support_review_cache.json"

FINANCE_KEYWORDS = {
    "융자",
    "대출",
    "특례보증",
    "신용보증",
    "기업보증",
    "기술보증",
    "보증연계",
    "보증서",
    "경영안정자금",
    "육성자금",
    "이차보전",
    "수출보험",
    "금융지원",
    "재기지원자금",
    "협력자금",
    "동행지원",
}
EMPLOYMENT_KEYWORDS = {"고용보조금", "청년일자리", "일자리도약", "인턴", "채용"}
VALID_TYPES = {"ROI 직접 반영", "연계 추천", "검토 필요", "계산 제외"}
VALID_AMOUNT_TYPES = {
    "support_amount",
    "subsidy",
    "voucher",
    "support_ratio",
    "loan",
    "guarantee",
    "investment",
    "tax",
    "non_cash",
    "unknown",
}
GEMINI_TIMEOUT_SECONDS = 45


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean_text(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value).replace("\x00", "").strip()
    text = re.sub(r"\s+", " ", text)
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def has_keyword(row: dict[str, Any], keywords: set[str], *, fields: list[str] | None = None) -> bool:
    fields = fields or ["title", "summary", "raw_text", "attachment_text", "max_amount_note"]
    text = " ".join(
        clean_text(row.get(field))
        for field in fields
    )
    return any(keyword in text for keyword in keywords)


def load_cache(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_cache(path: Path, cache: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


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


def call_gemini(row: dict[str, Any], *, model: str) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing")

    prompt = f"""
너는 제조업 지원사업 공고의 ROI 계산 반영 가능성을 분류하는 검수자다.
반드시 JSON 객체 하나만 반환해라.

분류값은 아래 네 개 중 하나만 사용한다.
- ROI 직접 반영: max_amount가 양수이고, 보조금/사업비/바우처/비용지원처럼 실제 비용을 줄이는 지원금
- 연계 추천: 직접 차감은 어렵지만 함께 신청하면 좋은 지원사업
- 검토 필요: 원문만으로 금액 성격을 확정하기 어려움
- 계산 제외: 융자/대출/보증/이차보전/투자/세제/단순 인력·교육 등 ROI에서 보조금처럼 차감하면 안 됨

max_amount_type은 아래 중 하나만 사용한다.
support_amount, subsidy, voucher, support_ratio, loan, guarantee, investment, tax, non_cash, unknown

판정 원칙:
- 융자, 대출, 보증, 특례보증, 이차보전, 수출보험, 금융지원은 계산 제외
- 지원비율만 있고 확정 한도 해석이 어려우면 검토 필요 또는 support_ratio
- 현금지원/사업비지원/보조금/바우처/시험분석비/인증비/R&D 사업비/스마트공장 구축비는 ROI 직접 반영 가능

공고:
policy_id: {clean_text(row.get('policy_id'))}
title: {clean_text(row.get('title'))}
source: {clean_text(row.get('source_name'))}
category: {clean_text(row.get('policy_category'))} / {clean_text(row.get('service_category'))}
max_amount: {row.get('max_amount')}
current_amount_type: {clean_text(row.get('max_amount_type'))}
support_method: {row.get('support_method')}
deadline: {clean_text(row.get('deadline'))}
summary: {clean_text(row.get('summary'), 1200)}
max_amount_note: {clean_text(row.get('max_amount_note'), 500)}
evidence: {clean_text(row.get('max_amount_evidence'), 1200)}
raw_or_attachment_excerpt: {clean_text(row.get('attachment_text') or row.get('raw_text'), 2500)}

반환 JSON 형식:
{{
  "roi_support_type": "ROI 직접 반영|연계 추천|검토 필요|계산 제외",
  "max_amount_type": "support_amount|subsidy|voucher|support_ratio|loan|guarantee|investment|tax|non_cash|unknown",
  "reason": "한국어 한 문장",
  "confidence": "high|medium|low"
}}
""".strip()

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    response = requests.post(
        url,
        params={"key": GEMINI_API_KEY},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
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
    roi_support_type = clean_text(parsed.get("roi_support_type"))
    amount_type = normalize_amount_type_key(parsed.get("max_amount_type"))
    if roi_support_type not in VALID_TYPES:
        roi_support_type = "검토 필요"
    if amount_type not in VALID_AMOUNT_TYPES:
        amount_type = "unknown"
    return {
        "roi_support_type": roi_support_type,
        "max_amount_type": amount_type,
        "reason": clean_text(parsed.get("reason"), 500) or "Gemini ROI 분류 검토 결과",
        "confidence": clean_text(parsed.get("confidence")) or "medium",
    }


def rule_result(row: dict[str, Any]) -> dict[str, Any] | None:
    if normalize_amount_type_key(row.get("max_amount_type")) == "support_ratio":
        return {
            "roi_support_type": "검토 필요",
            "max_amount_type": "support_ratio",
            "reason": "지원비율 또는 한도 해석이 필요한 공고로 ROI 직접 반영 전 검토 필요",
            "confidence": "high",
        }
    if has_keyword(row, FINANCE_KEYWORDS, fields=["title", "max_amount_note", "max_amount_evidence"]):
        return {
            "roi_support_type": "계산 제외",
            "max_amount_type": "guarantee" if "보증" in clean_text(row.get("title")) else "loan",
            "reason": "융자/보증/이차보전 등 금융성 공고로 ROI 직접 차감에서 제외",
            "confidence": "high",
        }
    if has_keyword(row, EMPLOYMENT_KEYWORDS, fields=["title", "summary", "max_amount_note"]):
        return {
            "roi_support_type": "연계 추천",
            "max_amount_type": "non_cash",
            "reason": "인력/고용 성격 지원으로 설비투자 ROI 직접 차감보다는 연계 추천이 적합",
            "confidence": "high",
        }
    return None


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Review policy rows with roi_support_type='검토 필요' using rules and Gemini."
    )
    parser.add_argument("--apply", action="store_true", help="Actually update policy. Default is dry-run.")
    parser.add_argument("--limit", type=int, default=0, help="0 means all")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--sleep", type=float, default=0.3)
    parser.add_argument("--cache-path", default=str(DEFAULT_CACHE_PATH))
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    rows = (
        supabase.table("policy")
        .select(
            "policy_id,title,source_name,policy_category,service_category,max_amount,"
            "max_amount_type,max_amount_status,max_amount_note,max_amount_evidence,"
            "support_method,deadline,summary,raw_text,attachment_text,roi_support_type"
        )
        .eq("roi_support_type", "검토 필요")
        .limit(args.limit or 200)
        .execute()
        .data
        or []
    )

    cache_path = Path(args.cache_path)
    cache = load_cache(cache_path)
    reviewed: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    for index, row in enumerate(rows, start=1):
        policy_id = clean_text(row.get("policy_id"))
        cache_key = f"{policy_id}:{row.get('max_amount')}:{clean_text(row.get('title'))}"
        result = rule_result(row)
        source = "rule"
        if result is None:
            if not args.force and cache_key in cache:
                result = cache[cache_key]
                source = "cache"
            else:
                try:
                    result = call_gemini(row, model=args.model)
                    cache[cache_key] = result
                    save_cache(cache_path, cache)
                    source = "gemini"
                    time.sleep(args.sleep)
                except Exception as exc:
                    result = {
                        "roi_support_type": "검토 필요",
                        "max_amount_type": "unknown",
                        "reason": f"Gemini 검토 실패: {exc}",
                        "confidence": "low",
                    }
                    source = "gemini_error"

        counts[result["roi_support_type"]] = counts.get(result["roi_support_type"], 0) + 1
        payload = {
            "roi_support_type": result["roi_support_type"],
            "roi_support_reason": result["reason"],
            "max_amount_type": result["max_amount_type"],
            "max_amount_type_ko": amount_type_to_korean(
                result["max_amount_type"],
                row.get("max_amount"),
            ),
            "max_amount_type_reason": build_max_amount_type_reason(
                row,
                amount_type=result["max_amount_type"],
                amount=row.get("max_amount"),
            ),
            "roi_support_synced_at": datetime.now(timezone.utc).isoformat(),
        }
        (
            payload["roi_apply_method"],
            payload["roi_apply_method_ko"],
            payload["roi_apply_reason"],
        ) = classify_roi_apply_method(
            max_amount=row.get("max_amount"),
            max_amount_type=result["max_amount_type"],
            roi_support_type=result["roi_support_type"],
            support_method=row.get("support_method"),
            is_non_cash=result["max_amount_type"] == "non_cash",
        )
        reviewed.append({"policy_id": policy_id, **payload, "source": source})
        print(
            f"{index}/{len(rows)} | {source} | {policy_id} | "
            f"{payload['roi_support_type']} | {payload['max_amount_type']} | {clean_text(row.get('title'), 80)}"
            ,
            flush=True,
        )
        if args.apply:
            supabase.table("policy").update(payload).eq("policy_id", policy_id).execute()

    print(f"reviewed={len(reviewed)} apply={args.apply} counts={counts}", flush=True)
    if not args.apply:
        print("Dry-run complete. Add --apply to update policy.", flush=True)


if __name__ == "__main__":
    main()
