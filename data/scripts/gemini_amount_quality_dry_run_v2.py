from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_current_review"
CACHE_PATH = ROOT / "data" / "cache" / "gemini_amount_quality_dry_run_v2_cache.json"
DEFAULT_MODEL = (
    os.getenv("GEMINI_MODEL")
    or os.getenv("DATA_LLM_MODEL")
    or "gemini-2.5-flash-lite"
).replace("google/", "").removeprefix("models/")

for env_path in [Path.cwd() / ".env", ROOT / ".env", ROOT / "backend" / ".env", SCRIPT_DIR / ".env"]:
    if env_path.exists():
        load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()

SELECT_FIELDS = (
    "policy_id,title,organization,url,summary,support_method,raw_text,attachment_text,"
    "amount_candidates,selected_amount_candidate,support_ratio,max_amount_actual,"
    "max_amount_numeric_manwon,max_amount_type,roi_apply_method,"
    "amount_manual_review_status,amount_manual_review_category"
)
DIRECT_TYPES = {"support_amount", "subsidy", "voucher"}
EXCLUDE_TYPES = {
    "loan",
    "guarantee",
    "interest_support",
    "non_cash",
    "fee",
    "self_funding",
    "education_fee",
    "equipment_usage_fee",
    "consulting_fee",
    "total_budget",
    "project_budget",
    "total_project_cost",
    "total_support_scale",
    "revenue_condition",
}
VALID_DECISIONS = {"adopt_selected", "adopt_ratio", "recommend_only", "exclude", "hold"}
VALID_CONFIDENCE = {"high", "medium", "low"}
VALID_ROI_METHODS = {"subtract", "ratio_cap", "recommend_only", "exclude", "review"}
RETRY_STATUSES = {429, 500, 502, 503, 504}


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len].rstrip() if max_len and len(text) > max_len else text


def client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Supabase env is missing.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_rows(supabase: Client) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        response = supabase.table("policy").select(SELECT_FIELDS).range(start, start + 999).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        start += 1000


def amount_manwon(candidate: dict[str, Any]) -> float | None:
    try:
        value = float(candidate.get("amount_manwon") or candidate.get("amount_numeric_manwon"))
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def compact_candidates(row: dict[str, Any]) -> list[dict[str, Any]]:
    items = []
    for index, candidate in enumerate(row.get("amount_candidates") or []):
        if not isinstance(candidate, dict):
            continue
        items.append(
            {
                "index": index,
                "amount_manwon": amount_manwon(candidate),
                "display_amount": clean(candidate.get("display_amount"), 120),
                "amount_type": clean(candidate.get("max_amount_type")),
                "roi_apply_method": clean(candidate.get("roi_apply_method")),
                "support_ratio": candidate.get("support_ratio"),
                "is_roi_usable": candidate.get("is_roi_usable"),
                "is_selected_amount": candidate.get("is_selected_amount"),
                "context": clean(
                    candidate.get("evidence")
                    or candidate.get("local_context")
                    or candidate.get("raw_text")
                    or candidate.get("display_amount")
                    or candidate.get("label"),
                    360,
                ),
            }
        )
    return items


def is_direct_candidate(candidate: dict[str, Any]) -> bool:
    return (
        clean(candidate.get("max_amount_type")) in DIRECT_TYPES
        and amount_manwon(candidate) is not None
        and candidate.get("is_roi_usable") is not False
        and clean(candidate.get("roi_apply_method")) in {"", "subtract"}
    )


def row_group(row: dict[str, Any]) -> str:
    selected = row.get("selected_amount_candidate")
    if isinstance(selected, dict) and row.get("max_amount_numeric_manwon") is None:
        return "selected_no_numeric"
    if row.get("amount_candidates") and not selected:
        direct = [c for c in row.get("amount_candidates") or [] if isinstance(c, dict) and is_direct_candidate(c)]
        types = {clean(c.get("max_amount_type")) for c in row.get("amount_candidates") or [] if isinstance(c, dict)}
        if direct:
            return "candidate_direct_no_selected"
        if types & EXCLUDE_TYPES:
            return "exclude_or_total_no_selected"
        if row.get("support_ratio") is not None:
            return "ratio_only_no_selected"
        return "no_direct_cash_no_selected"
    return "other"


def select_targets(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    groups = {
        "selected_no_numeric": [],
        "candidate_direct_no_selected": [],
        "no_direct_cash_no_selected": [],
        "exclude_or_total_no_selected": [],
        "ratio_only_no_selected": [],
    }
    for row in rows:
        group = row_group(row)
        if group in groups:
            row["_quality_group"] = group
            groups[group].append(row)
    selected = []
    for group, count in [
        ("selected_no_numeric", 5),
        ("candidate_direct_no_selected", 5),
        ("no_direct_cash_no_selected", 5),
        ("exclude_or_total_no_selected", 5),
        ("ratio_only_no_selected", 3),
    ]:
        selected.extend(groups[group][:count])
        if len(selected) >= limit:
            break
    return selected[:limit]


def prompt_for_row(row: dict[str, Any]) -> str:
    text_blob = "\n".join(
        [
            clean(row.get("summary"), 900),
            clean(row.get("support_method"), 900),
            clean(row.get("raw_text"), 1800),
            clean(row.get("attachment_text"), 1800),
        ]
    )
    return f"""
You are reviewing Korean SME support-policy notices for ROI calculation.
Return exactly one JSON object.

Decisions:
- adopt_selected: a direct cash/voucher/subsidy maximum is clearly usable for one company/project/business owner.
- adopt_ratio: no fixed cap is clear, but a support ratio is clearly usable.
- recommend_only or exclude: non-cash, consulting, education, certification, fee, equipment rental, loan, guarantee, interest subsidy.
- hold: total budget/project cost/total support scale/self-funding/monthly/person/case/period context, or unclear evidence.

High confidence rule:
- confidence=high only when the evidence sentence clearly has max/limit/within/per company/per project/per business owner context.
- amount_manwon must be in Korean manwon units. 1 eok KRW=10000, 1 million KRW=100, 10 million KRW=1000.
- If no candidate index is correct, use null and cite a new evidence sentence.

Policy:
policy_id: {clean(row.get("policy_id"))}
title: {clean(row.get("title"))}
organization: {clean(row.get("organization"))}
url: {clean(row.get("url"))}
quality_group: {clean(row.get("_quality_group"))}
manual_status: {clean(row.get("amount_manual_review_status"))}
manual_category: {clean(row.get("amount_manual_review_category"))}
current_support_ratio: {row.get("support_ratio")}
current_selected_amount_candidate:
{json.dumps(row.get("selected_amount_candidate") if isinstance(row.get("selected_amount_candidate"), dict) else None, ensure_ascii=False, indent=2, default=str)}

amount_candidates:
{json.dumps(compact_candidates(row), ensure_ascii=False, indent=2, default=str)}

source text:
{text_blob}

JSON schema:
{{
  "decision": "adopt_selected|adopt_ratio|recommend_only|exclude|hold",
  "candidate_index": 0,
  "amount_manwon": 1000,
  "support_ratio": 0.7,
  "amount_type": "support_amount|subsidy|voucher|support_ratio|loan|guarantee|non_cash|total_support_scale|total_budget|total_project_cost|revenue_condition|fee|self_funding|education_fee|equipment_usage_fee|consulting_fee|unknown",
  "roi_apply_method": "subtract|ratio_cap|recommend_only|exclude|review",
  "confidence": "high|medium|low",
  "evidence_text": "short original Korean evidence",
  "reason": "brief Korean reason"
}}
""".strip()


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
        raise ValueError("Gemini response is not a JSON object.")
    return parsed


def normalize_review(parsed: dict[str, Any]) -> dict[str, Any]:
    decision = clean(parsed.get("decision")).lower()
    confidence = clean(parsed.get("confidence")).lower()
    roi_method = clean(parsed.get("roi_apply_method")).lower()
    if decision not in VALID_DECISIONS:
        decision = "hold"
    if confidence not in VALID_CONFIDENCE:
        confidence = "low"
    if roi_method not in VALID_ROI_METHODS:
        roi_method = "review"
    try:
        amount = round(float(parsed.get("amount_manwon")), 2) if parsed.get("amount_manwon") not in [None, ""] else None
    except (TypeError, ValueError):
        amount = None
    try:
        ratio = float(parsed.get("support_ratio")) if parsed.get("support_ratio") not in [None, ""] else None
    except (TypeError, ValueError):
        ratio = None
    if ratio is not None and 1 < ratio <= 100:
        ratio /= 100
    if ratio is not None and not (0 < ratio <= 1):
        ratio = None
    try:
        candidate_index = int(parsed.get("candidate_index")) if parsed.get("candidate_index") not in [None, ""] else None
    except (TypeError, ValueError):
        candidate_index = None
    return {
        "decision": decision,
        "candidate_index": candidate_index,
        "amount_manwon": amount,
        "support_ratio": ratio,
        "amount_type": clean(parsed.get("amount_type")) or "unknown",
        "roi_apply_method": roi_method,
        "confidence": confidence,
        "evidence_text": clean(parsed.get("evidence_text"), 700),
        "reason": clean(parsed.get("reason"), 700),
    }


def call_gemini(prompt: str, model: str) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing.")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.0, "responseMimeType": "application/json"},
    }
    response = None
    for attempt in range(4):
        response = requests.post(url, params={"key": GEMINI_API_KEY}, json=payload, timeout=60)
        if response.status_code not in RETRY_STATUSES:
            break
        time.sleep(1.5 * (attempt + 1))
    assert response is not None
    response.raise_for_status()
    data = response.json()
    text = clean((((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [{}])[0].get("text"))
    if not text:
        raise ValueError("Gemini response text is empty.")
    return normalize_review(extract_json(text))


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


def cache_key(row: dict[str, Any], prompt: str, model: str) -> str:
    digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
    return f"{model}:{row.get('policy_id')}:{digest}"


def sanitize_error(exc: Exception) -> str:
    text = clean(exc, 500)
    if GEMINI_API_KEY:
        text = text.replace(GEMINI_API_KEY, "[REDACTED_API_KEY]")
    return re.sub(r"key=[^&\s)]+", "key=[REDACTED_API_KEY]", text)


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()), escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only Gemini quality dry-run for policy amount selection.")
    parser.add_argument("--limit", type=int, default=18)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--sleep", type=float, default=0.5)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = fetch_rows(client())
    targets = select_targets(rows, args.limit)
    cache = load_cache(CACHE_PATH)
    results: list[dict[str, Any]] = []

    for index, row in enumerate(targets, start=1):
        prompt = prompt_for_row(row)
        key = cache_key(row, prompt, args.model)
        source = "cache"
        try:
            if key in cache:
                review = cache[key]
            else:
                review = call_gemini(prompt, args.model)
                cache[key] = review
                save_cache(CACHE_PATH, cache)
                source = "gemini"
                time.sleep(args.sleep)
        except Exception as exc:
            review = {
                "decision": "hold",
                "candidate_index": None,
                "amount_manwon": None,
                "support_ratio": None,
                "amount_type": "unknown",
                "roi_apply_method": "review",
                "confidence": "low",
                "evidence_text": "",
                "reason": f"Gemini failed: {sanitize_error(exc)}",
            }
            source = "error"
        results.append(
            {
                "policy_id": row.get("policy_id"),
                "title": row.get("title"),
                "quality_group": row.get("_quality_group"),
                "current_manual_status": row.get("amount_manual_review_status"),
                "current_manual_category": row.get("amount_manual_review_category"),
                "current_support_ratio": row.get("support_ratio"),
                "candidate_count": len(row.get("amount_candidates") or []),
                "gemini_decision": review.get("decision"),
                "gemini_confidence": review.get("confidence"),
                "gemini_amount_manwon": review.get("amount_manwon"),
                "gemini_support_ratio": review.get("support_ratio"),
                "gemini_amount_type": review.get("amount_type"),
                "gemini_roi_apply_method": review.get("roi_apply_method"),
                "gemini_candidate_index": review.get("candidate_index"),
                "gemini_evidence_text": review.get("evidence_text"),
                "gemini_reason": review.get("reason"),
                "source": source,
                "url": row.get("url"),
            }
        )
        print(f"[{index}/{len(targets)}] {row.get('policy_id')} {source} {review.get('decision')} {review.get('confidence')}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = REPORT_DIR / f"gemini_amount_quality_dry_run_v2_{timestamp}.csv"
    json_path = REPORT_DIR / f"gemini_amount_quality_dry_run_v2_{timestamp}.json"
    summary_path = REPORT_DIR / f"gemini_amount_quality_dry_run_v2_summary_{timestamp}.md"
    write_csv(csv_path, results)
    json_path.write_text(json.dumps(results, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    def counts(field: str) -> dict[str, int]:
        output: dict[str, int] = {}
        for item in results:
            key = str(item.get(field))
            output[key] = output.get(key, 0) + 1
        return output

    high_adopt = sum(
        1
        for item in results
        if item["gemini_decision"] in {"adopt_selected", "adopt_ratio"} and item["gemini_confidence"] == "high"
    )
    error_count = sum(1 for item in results if item["source"] == "error")
    summary = {
        "sample_rows": len(results),
        "high_confidence_adopt_or_ratio": high_adopt,
        "error_count": error_count,
        "decision_counts": counts("gemini_decision"),
        "confidence_counts": counts("gemini_confidence"),
        "group_counts": counts("quality_group"),
        "csv": str(csv_path),
        "json": str(json_path),
        "summary": str(summary_path),
    }
    summary_path.write_text(
        "DRY-RUN only. No database rows were updated.\n"
        + json.dumps(summary, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
