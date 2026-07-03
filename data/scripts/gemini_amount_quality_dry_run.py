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
DEFAULT_CACHE_PATH = ROOT / "data" / "cache" / "gemini_amount_quality_dry_run_cache.json"
DEFAULT_MODEL = (
    os.getenv("GEMINI_MODEL")
    or os.getenv("DATA_LLM_MODEL")
    or "gemini-2.5-flash-lite"
).replace("google/", "").removeprefix("models/")
GEMINI_TIMEOUT_SECONDS = 60

for env_path in [
    Path.cwd() / ".env",
    ROOT / ".env",
    ROOT / "backend" / ".env",
    SCRIPT_DIR / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()
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


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def sanitize_error(exc: Exception) -> str:
    text = clean(exc, 700)
    if GEMINI_API_KEY:
        text = text.replace(GEMINI_API_KEY, "[REDACTED_API_KEY]")
    return re.sub(r"key=[^&\s)]+", "key=[REDACTED_API_KEY]", text)


def fetch_rows(supabase: Client) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = supabase.table("policy").select(SELECT_FIELDS).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            return rows
        start += batch_size


def amount_manwon(candidate: dict[str, Any]) -> float | None:
    value = candidate.get("amount_manwon") or candidate.get("amount_numeric_manwon")
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount > 0 else None


def candidate_context(candidate: dict[str, Any], max_len: int = 320) -> str:
    return clean(
        candidate.get("evidence")
        or candidate.get("local_context")
        or candidate.get("raw_text")
        or candidate.get("display_amount")
        or candidate.get("label"),
        max_len,
    )


def compact_candidates(row: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = []
    for index, candidate in enumerate(row.get("amount_candidates") or []):
        if not isinstance(candidate, dict):
            continue
        candidates.append(
            {
                "index": index,
                "amount_manwon": amount_manwon(candidate),
                "display_amount": clean(candidate.get("display_amount"), 120),
                "amount_type": clean(candidate.get("max_amount_type")),
                "roi_apply_method": clean(candidate.get("roi_apply_method")),
                "support_ratio": candidate.get("support_ratio"),
                "is_roi_usable": candidate.get("is_roi_usable"),
                "is_selected_amount": candidate.get("is_selected_amount"),
                "context": candidate_context(candidate),
            }
        )
    return candidates


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
        direct = [candidate for candidate in row.get("amount_candidates") or [] if isinstance(candidate, dict) and is_direct_candidate(candidate)]
        types = {
            clean(candidate.get("max_amount_type"))
            for candidate in row.get("amount_candidates") or []
            if isinstance(candidate, dict)
        }
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
            groups[group].append(row)

    # Favor rows where LLM could realistically improve coverage, but include
    # exclusion-heavy rows to estimate false-negative risk.
    order = [
        ("selected_no_numeric", 5),
        ("candidate_direct_no_selected", 5),
        ("no_direct_cash_no_selected", 5),
        ("exclude_or_total_no_selected", 5),
        ("ratio_only_no_selected", 3),
    ]
    selected: list[dict[str, Any]] = []
    for group, count in order:
        for row in groups[group][:count]:
            row["_quality_group"] = group
            selected.append(row)
            if len(selected) >= limit:
                return selected
    return selected[:limit]


def prompt_for_row(row: dict[str, Any]) -> str:
    selected = row.get("selected_amount_candidate")
    selected_block = selected if isinstance(selected, dict) else None
    text_blob = "\n".join(
        [
            clean(row.get("summary"), 900),
            clean(row.get("support_method"), 900),
            clean(row.get("raw_text"), 1800),
            clean(row.get("attachment_text"), 1800),
        ]
    )
    return f"""
너는 중소기업 지원사업 공고에서 ROI 계산에 사용할 수 있는 지원금/지원비율을 2차 검수하는 검수자다.
반드시 JSON 객체 하나만 반환한다.

목표:
- 기업당/업체당/과제당/사업주당 직접 현금성 지원금 한도가 명확하면 adopt_selected.
- 정액 한도 없이 지원비율만 명확하면 adopt_ratio.
- 컨설팅/교육/시험/인증/수수료/장비사용료/비현금 지원이면 recommend_only 또는 exclude.
- 융자/대출/보증/이차보전은 exclude.
- 총사업비/총예산/총지원규모/매출조건/자부담은 대표 지원금이 아니므로 hold 또는 exclude.
- 월/명/건/회/기간 단위라 기업당 총액 환산이 불명확하면 hold.
- 근거 문장이 불명확하면 hold.

채택 조건:
- confidence=high는 원문 근거에 "최대/한도/이내/기업당/업체당/과제당/사업주당" 같은 한도 문맥이 있어야 한다.
- amount_manwon은 만원 단위 숫자다. 1억원=10000, 1백만원=100, 1천만원=1000, 1천원=0.1.
- 기존 후보가 틀렸다고 판단되면 candidate_index는 null로 두고 amount_manwon과 evidence_text를 원문에서 새로 제시해도 된다.
- 추정이면 confidence는 medium 또는 low로 둔다. 자동 반영 가능성은 high만 있다.

공고:
policy_id: {clean(row.get("policy_id"))}
title: {clean(row.get("title"))}
organization: {clean(row.get("organization"))}
url: {clean(row.get("url"))}
quality_group: {clean(row.get("_quality_group"))}
current_roi_apply_method: {clean(row.get("roi_apply_method"))}
manual_status: {clean(row.get("amount_manual_review_status"))}
manual_category: {clean(row.get("amount_manual_review_category"))}
support_ratio: {row.get("support_ratio")}
max_amount_actual: {clean(row.get("max_amount_actual"))}
max_amount_numeric_manwon: {row.get("max_amount_numeric_manwon")}

현재 selected_amount_candidate:
{json.dumps(selected_block, ensure_ascii=False, indent=2, default=str)}

amount_candidates:
{json.dumps(compact_candidates(row), ensure_ascii=False, indent=2, default=str)}

원문/첨부 일부:
{text_blob}

반환 JSON:
{{
  "decision": "adopt_selected|adopt_ratio|recommend_only|exclude|hold",
  "candidate_index": 0,
  "amount_manwon": 1000,
  "support_ratio": 0.7,
  "amount_type": "support_amount|subsidy|voucher|support_ratio|loan|guarantee|non_cash|total_support_scale|total_budget|total_project_cost|revenue_condition|fee|self_funding|education_fee|equipment_usage_fee|consulting_fee|unknown",
  "roi_apply_method": "subtract|ratio_cap|recommend_only|exclude|review",
  "confidence": "high|medium|low",
  "evidence_text": "원문 근거 문장",
  "reason": "판단 이유"
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
        raise ValueError("Gemini response is not a JSON object")
    return parsed


def normalize_review(parsed: dict[str, Any]) -> dict[str, Any]:
    decision = clean(parsed.get("decision")).lower()
    if decision not in VALID_DECISIONS:
        decision = "hold"
    confidence = clean(parsed.get("confidence")).lower()
    if confidence not in VALID_CONFIDENCE:
        confidence = "low"
    roi_method = clean(parsed.get("roi_apply_method")).lower()
    if roi_method not in VALID_ROI_METHODS:
        roi_method = "review"
    amount = parsed.get("amount_manwon")
    try:
        amount = round(float(amount), 2) if amount is not None and amount != "" else None
    except (TypeError, ValueError):
        amount = None
    ratio = parsed.get("support_ratio")
    try:
        ratio = float(ratio) if ratio is not None and ratio != "" else None
    except (TypeError, ValueError):
        ratio = None
    if ratio is not None and ratio > 1 and ratio <= 100:
        ratio = ratio / 100
    if ratio is not None and not (0 < ratio <= 1):
        ratio = None
    candidate_index = parsed.get("candidate_index")
    try:
        candidate_index = int(candidate_index) if candidate_index is not None and candidate_index != "" else None
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
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    response = requests.post(
        url,
        params={"key": GEMINI_API_KEY},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0, "responseMimeType": "application/json"},
        },
        timeout=GEMINI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    text = clean(
        (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [{}])[0].get("text")
    )
    if not text:
        raise ValueError("Gemini response text is empty")
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


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()), escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gemini dry-run quality sample for amount parsing. No DB updates.")
    parser.add_argument("--limit", type=int, default=18)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--sleep", type=float, default=0.15)
    parser.add_argument("--cache-path", default=str(DEFAULT_CACHE_PATH))
    parser.add_argument("--output-dir", default=str(REPORT_DIR))
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    rows = fetch_rows(client())
    targets = select_targets(rows, args.limit)
    cache_path = Path(args.cache_path)
    cache = load_cache(cache_path)

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
                save_cache(cache_path, cache)
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
    output_dir = Path(args.output_dir)
    csv_path = output_dir / f"gemini_amount_quality_dry_run_{timestamp}.csv"
    json_path = output_dir / f"gemini_amount_quality_dry_run_{timestamp}.json"
    summary_path = output_dir / f"gemini_amount_quality_dry_run_summary_{timestamp}.md"
    write_csv(csv_path, results)
    json_path.write_text(json.dumps(results, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    decision_counts: dict[str, int] = {}
    confidence_counts: dict[str, int] = {}
    group_counts: dict[str, int] = {}
    high_adopt = 0
    for row in results:
        decision_counts[row["gemini_decision"]] = decision_counts.get(row["gemini_decision"], 0) + 1
        confidence_counts[row["gemini_confidence"]] = confidence_counts.get(row["gemini_confidence"], 0) + 1
        group_counts[row["quality_group"]] = group_counts.get(row["quality_group"], 0) + 1
        if row["gemini_decision"] in {"adopt_selected", "adopt_ratio"} and row["gemini_confidence"] == "high":
            high_adopt += 1

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"sample_rows={len(results)}",
        f"high_confidence_adopt_or_ratio={high_adopt}",
        "",
        "## decision counts",
        *[f"- {key}: {decision_counts[key]}" for key in sorted(decision_counts)],
        "",
        "## confidence counts",
        *[f"- {key}: {confidence_counts[key]}" for key in sorted(confidence_counts)],
        "",
        "## group counts",
        *[f"- {key}: {group_counts[key]}" for key in sorted(group_counts)],
        "",
        f"csv={csv_path}",
        f"json={json_path}",
    ]
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "sample_rows": len(results),
                "high_confidence_adopt_or_ratio": high_adopt,
                "decision_counts": decision_counts,
                "confidence_counts": confidence_counts,
                "group_counts": group_counts,
                "csv": str(csv_path),
                "json": str(json_path),
                "summary": str(summary_path),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
