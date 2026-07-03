from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_url_reparse"
DEFAULT_HOLD_CSV = (
    REPORT_DIR
    / "large_amount_delta_resolution"
    / "large_amount_delta_hold_breakdown_20260703_121239.csv"
)
DEFAULT_CACHE_PATH = ROOT / "data" / "cache" / "large_amount_delta_hold_gemini_cache.json"
DEFAULT_MODEL = (
    os.getenv("GEMINI_MODEL")
    or os.getenv("DATA_LLM_MODEL")
    or "gemini-2.5-flash-lite"
).replace("google/", "").removeprefix("models/")
GEMINI_TIMEOUT_SECONDS = 60

TARGET_HOLD_GROUPS = {
    "limit_candidate_large_delta",
    "manual_review_pattern",
    "possible_unit_scale_error",
    "extreme_delta",
}
VALID_DECISIONS = {"adopt_new", "keep_old", "hold"}
VALID_AMOUNT_TYPES = {
    "support_amount",
    "subsidy",
    "voucher",
    "support_ratio",
    "loan",
    "guarantee",
    "non_cash",
    "unknown",
}
VALID_ROI_METHODS = {"subtract", "recommend_only", "exclude", "review", "ratio_cap"}
HARD_RISK_WORDS = [
    "벌금",
    "징역",
    "벌칙",
    "제재",
    "부정",
    "매출액",
    "연매출",
    "누적",
    "제외",
    "총 지원금",
    "총지원금",
    "합계액",
]
DIRECT_CASH_TYPES = {"support_amount", "subsidy", "voucher"}


for env_path in [
    Path.cwd() / ".env",
    ROOT / ".env",
    ROOT / "backend" / ".env",
    SCRIPT_DIR / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or ""
).strip()


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def read_csv(path: Path) -> list[dict[str, str]]:
    content = path.read_text(encoding="utf-8-sig").replace("\x00", "")
    return list(csv.DictReader(content.splitlines()))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    fields = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


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


def prompt_for_row(row: dict[str, str]) -> str:
    return f"""
너는 제조업/중소기업 지원사업 공고의 대표 지원금 검수자다.
아래 한 건에 대해 기존 DB 금액과 새 파싱 후보 금액 중 어느 쪽을 대표금액으로 볼지 판단해라.
반드시 JSON 객체 하나만 반환해라.

판정값:
- adopt_new: 새 파싱 금액이 기업/과제/사업장 단위의 대표 최대 지원금으로 명확함
- keep_old: 새 파싱 금액이 매출조건, 벌칙, 누적/총액, 제외기준, 금융한도, 다른 항목 금액 등이라 기존값 유지가 더 안전함
- hold: 둘 중 확정하기 어렵거나 표/단위/행 연결이 불명확함

주의:
- 융자/대출/팩토링/보증/이차보전은 ROI 직접 차감 금액으로 채택하지 말고 keep_old 또는 hold
- 월별/명당/건당/점당/연간한도는 대표금액으로 바로 채택하지 말고 hold
- 총사업비, 총지원금, 누적금액, 합계액, 매출액 조건, 벌금/징역은 새 대표금액으로 채택하지 말 것
- 확신이 낮으면 hold

공고:
policy_id: {clean(row.get("policy_id"))}
title: {clean(row.get("title"))}
organization: {clean(row.get("organization"))}
url: {clean(row.get("url"))}

기존값:
old_amount_manwon: {clean(row.get("old_amount_manwon"))}
old_amount_actual: {clean(row.get("old_amount_actual"), 500)}
old_amount_type: {clean(row.get("old_amount_type"))}
old_roi_apply_method: {clean(row.get("old_roi_apply_method"))}

새 파싱 후보:
new_amount_manwon: {clean(row.get("new_amount_manwon"))}
new_amount_actual: {clean(row.get("new_amount_actual"))}
new_amount_type: {clean(row.get("new_amount_type"))}
new_roi_apply_method: {clean(row.get("new_roi_apply_method"))}
delta_ratio: {clean(row.get("delta_ratio"))}
hold_group: {clean(row.get("hold_group"))}
pattern: {clean(row.get("pattern"))}

새 후보 근거 문맥:
{clean(row.get("new_selected_context"), 1800)}

후보 전체 요약:
{clean(row.get("candidate_summary"), 2000)}

반환 JSON 형식:
{{
  "decision": "adopt_new|keep_old|hold",
  "representative_amount_manwon": 1000,
  "amount_type": "support_amount|subsidy|voucher|support_ratio|loan|guarantee|non_cash|unknown",
  "roi_apply_method": "subtract|recommend_only|exclude|review|ratio_cap",
  "confidence": "high|medium|low",
  "reason": "한국어 한 문장",
  "evidence_text": "근거 문구"
}}
""".strip()


def call_gemini(prompt: str, *, model: str) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing")
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
    if not text:
        raise ValueError("Gemini response text is empty")
    return extract_json(text)


def normalize_review(parsed: dict[str, Any]) -> dict[str, Any]:
    decision = clean(parsed.get("decision")).lower()
    if decision not in VALID_DECISIONS:
        decision = "hold"
    amount_type = clean(parsed.get("amount_type")).lower()
    if amount_type not in VALID_AMOUNT_TYPES:
        amount_type = "unknown"
    roi_method = clean(parsed.get("roi_apply_method")).lower()
    if roi_method not in VALID_ROI_METHODS:
        roi_method = "review"
    confidence = clean(parsed.get("confidence")).lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "low"
    return {
        "gemini_decision": decision,
        "gemini_amount_manwon": parsed.get("representative_amount_manwon"),
        "gemini_amount_type": amount_type,
        "gemini_roi_apply_method": roi_method,
        "gemini_confidence": confidence,
        "gemini_reason": clean(parsed.get("reason"), 700),
        "gemini_evidence_text": clean(parsed.get("evidence_text"), 700),
    }


def sanity_decision(row: dict[str, str], review: dict[str, Any]) -> tuple[str, str]:
    context = clean(row.get("new_selected_context"), 2000)
    if review["gemini_decision"] == "adopt_new":
        if review["gemini_confidence"] != "high":
            return "hold", "Gemini adopt_new이지만 high confidence가 아니므로 보류"
        if review["gemini_amount_type"] not in DIRECT_CASH_TYPES:
            return "hold", "Gemini adopt_new이나 금액 타입이 현금성 직접지원이 아님"
        if review["gemini_roi_apply_method"] != "subtract":
            return "hold", "Gemini adopt_new이나 ROI 직접 차감 방식이 아님"
        if any(keyword in context for keyword in HARD_RISK_WORDS):
            return "hold", "새 후보 근거에 하드 위험 키워드가 있어 보류"
    return review["gemini_decision"], "Gemini 결과를 sanity check 기준으로 수용"


def row_hash(row: dict[str, str], model: str) -> str:
    source = json.dumps(
        {
            "model": model,
            "policy_id": clean(row.get("policy_id")),
            "old": clean(row.get("old_amount_manwon")),
            "new": clean(row.get("new_amount_manwon")),
            "context": clean(row.get("new_selected_context"), 2000),
            "candidates": clean(row.get("candidate_summary"), 2000),
            "hold_group": clean(row.get("hold_group")),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Review ambiguous large_amount_delta hold rows with Gemini. No DB updates."
    )
    parser.add_argument("--hold-csv", default=str(DEFAULT_HOLD_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "large_amount_delta_gemini_review"))
    parser.add_argument("--cache-path", default=str(DEFAULT_CACHE_PATH))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=0, help="0 means all target rows")
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--use-gemini", action="store_true", help="Actually call Gemini. Default only writes prompt samples.")
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    rows = [
        row for row in read_csv(Path(args.hold_csv))
        if clean(row.get("hold_group")) in TARGET_HOLD_GROUPS
    ]
    if args.limit:
        rows = rows[: args.limit]

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prompt_path = output_dir / f"large_amount_delta_gemini_prompts_{timestamp}.txt"

    prompts = []
    for index, row in enumerate(rows[:5], start=1):
        prompts.extend(["", "=" * 80, f"SAMPLE {index}", prompt_for_row(row)])
    prompt_path.write_text("\n".join(prompts), encoding="utf-8")

    reviews: list[dict[str, Any]] = []
    cache_path = Path(args.cache_path)
    cache = load_cache(cache_path)
    if args.use_gemini:
        for index, row in enumerate(rows, start=1):
            key = row_hash(row, args.model)
            try:
                if not args.no_cache and key in cache:
                    parsed = cache[key]["parsed"]
                    source = "cache"
                else:
                    parsed = call_gemini(prompt_for_row(row), model=args.model)
                    cache[key] = {"parsed": parsed, "policy_id": clean(row.get("policy_id"))}
                    save_cache(cache_path, cache)
                    source = "gemini"
                review = normalize_review(parsed)
                final_decision, sanity_reason = sanity_decision(row, review)
                status = "ok"
            except Exception as exc:  # noqa: BLE001
                review = {
                    "gemini_decision": "hold",
                    "gemini_amount_manwon": "",
                    "gemini_amount_type": "unknown",
                    "gemini_roi_apply_method": "review",
                    "gemini_confidence": "low",
                    "gemini_reason": f"Gemini 검토 실패: {clean(exc, 500)}",
                    "gemini_evidence_text": "",
                }
                final_decision = "hold"
                sanity_reason = "Gemini 실패로 보류"
                source = "error"
                status = "error"
            reviews.append(
                {
                    **row,
                    **review,
                    "final_suggested_action": final_decision,
                    "sanity_reason": sanity_reason,
                    "review_source": source,
                    "review_status": status,
                }
            )
            print(
                f"[{index}/{len(rows)}] {clean(row.get('policy_id'))} "
                f"gemini={review['gemini_decision']} confidence={review['gemini_confidence']} "
                f"final={final_decision} source={source}"
            )
            if args.sleep:
                time.sleep(args.sleep)
    else:
        for row in rows:
            reviews.append(
                {
                    **row,
                    "gemini_decision": "",
                    "gemini_amount_manwon": "",
                    "gemini_amount_type": "",
                    "gemini_roi_apply_method": "",
                    "gemini_confidence": "",
                    "gemini_reason": "prompt_only",
                    "gemini_evidence_text": "",
                    "final_suggested_action": "hold",
                    "sanity_reason": "Gemini 미실행",
                    "review_source": "prompt_only",
                    "review_status": "prompt_only",
                }
            )

    csv_path = output_dir / f"large_amount_delta_gemini_review_{timestamp}.csv"
    json_path = output_dir / f"large_amount_delta_gemini_review_{timestamp}.json"
    md_path = output_dir / f"large_amount_delta_gemini_review_{timestamp}.md"
    write_csv(csv_path, reviews)
    json_path.write_text(json.dumps(reviews, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    counts: dict[str, int] = {}
    final_counts: dict[str, int] = {}
    for row in reviews:
        counts[clean(row.get("gemini_decision")) or "prompt_only"] = counts.get(clean(row.get("gemini_decision")) or "prompt_only", 0) + 1
        final_counts[row["final_suggested_action"]] = final_counts.get(row["final_suggested_action"], 0) + 1
    lines = [
        f"hold_csv={args.hold_csv}",
        f"target_rows={len(rows)}",
        f"use_gemini={args.use_gemini}",
        f"model={args.model}",
        "",
        f"gemini_decisions={counts}",
        f"final_suggested_actions={final_counts}",
        "",
        "## samples",
    ]
    for row in reviews[:20]:
        lines.extend(
            [
                "",
                f"### {row.get('policy_id')} | {row.get('title')}",
                f"- hold_group: {row.get('hold_group')}",
                f"- old -> new: {row.get('old_amount_manwon')} -> {row.get('new_amount_manwon')} ({row.get('delta_ratio')})",
                f"- gemini: {row.get('gemini_decision')} / {row.get('gemini_confidence')} / {row.get('gemini_amount_type')} / {row.get('gemini_roi_apply_method')}",
                f"- final: {row.get('final_suggested_action')} ({row.get('sanity_reason')})",
                f"- reason: {row.get('gemini_reason')}",
            ]
        )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print("No database rows were updated.")
    print(f"target_rows={len(rows)}")
    print(f"use_gemini={args.use_gemini}")
    print(f"gemini_decisions={counts}")
    print(f"final_suggested_actions={final_counts}")
    print(f"prompts={prompt_path}")
    print(f"csv={csv_path}")
    print(f"json={json_path}")
    print(f"md={md_path}")


if __name__ == "__main__":
    main()
