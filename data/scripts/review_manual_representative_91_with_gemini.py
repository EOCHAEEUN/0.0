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

import policy_amount_utils as amount_utils


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_url_reparse"
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_TARGET_CSV = (
    REPORT_DIR
    / "manual_representative_91"
    / "manual_representative_91_gemini_targets_20260703_135643.csv"
)
DEFAULT_CACHE_PATH = ROOT / "data" / "cache" / "manual_representative_91_gemini_cache.json"
DEFAULT_MODEL = (
    os.getenv("GEMINI_MODEL")
    or os.getenv("DATA_LLM_MODEL")
    or "gemini-2.5-flash-lite"
).replace("google/", "").removeprefix("models/")
GEMINI_TIMEOUT_SECONDS = 60

CASH_TYPES = {"support_amount", "subsidy", "voucher"}
VALID_DECISIONS = {"adopt_candidate", "keep_no_representative", "hold"}
VALID_AMOUNT_TYPES = {
    "support_amount",
    "subsidy",
    "voucher",
    "support_ratio",
    "loan",
    "guarantee",
    "non_cash",
    "total_support_scale",
    "total_budget",
    "total_project_cost",
    "revenue_condition",
    "fee",
    "self_funding",
    "education_fee",
    "equipment_usage_fee",
    "consulting_fee",
    "unknown",
}
VALID_ROI_METHODS = {"subtract", "ratio_cap", "recommend_only", "exclude", "review"}
HARD_RISK_WORDS = {
    "총사업비",
    "총 사업비",
    "총예산",
    "전체예산",
    "매출액",
    "연매출",
    "자부담",
    "기업부담금",
    "민간부담",
    "수수료",
    "보증",
    "융자",
    "대출",
    "팩토링",
}


for env_path in [
    Path.cwd() / ".env",
    ROOT / ".env",
    ROOT / "backend" / ".env",
    SCRIPT_DIR / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)

GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()


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
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()), escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


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


def sanitize_error(exc: Exception) -> str:
    text = clean(exc, 700)
    if GEMINI_API_KEY:
        text = text.replace(GEMINI_API_KEY, "[REDACTED_API_KEY]")
    return re.sub(r"key=[^&\s)]+", "key=[REDACTED_API_KEY]", text)


def candidate_text(candidate: dict[str, Any], max_len: int = 300) -> str:
    return clean(
        candidate.get("local_context")
        or candidate.get("evidence")
        or candidate.get("raw_text"),
        max_len,
    )


def indexed_candidates(row: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, candidate in enumerate(row.get("new_amount_candidates") or []):
        result.append(
            {
                "index": index,
                "amount_manwon": candidate.get("amount_manwon"),
                "display_amount": candidate.get("display_amount"),
                "current_type": candidate.get("max_amount_type"),
                "current_roi_method": candidate.get("roi_apply_method"),
                "support_ratio": candidate.get("support_ratio"),
                "context": candidate_text(candidate),
            }
        )
    return result


def prompt_for_row(row: dict[str, Any], target: dict[str, str]) -> str:
    return f"""
너는 중소기업/제조업 지원사업 공고에서 ROI 직접 차감 가능한 대표 지원금을 고르는 2차 검수자다.
반드시 JSON 객체 하나만 반환해라.

decision:
- adopt_candidate: 후보 중 하나가 기업당/과제당/건당/사업장당 최대 현금성 지원금으로 명확함
- keep_no_representative: 후보가 총규모, 자부담, 수수료, 교육/컨설팅/장비사용료, 금융성 한도, 지원비율뿐이라 대표금액을 만들면 안 됨
- hold: 다중 프로그램 중 대표 선택, 표 연결, 월/명/연간 환산, 컨소시엄 기준 등이 애매함

채택 조건:
- high confidence일 때만 채택 후보가 될 수 있다.
- 금액 타입은 support_amount, subsidy, voucher 중 하나여야 한다.
- roi_apply_method는 subtract여야 한다.
- 근거문장에 기업당/과제당/건당/사업장당/최대/한도/이내 같은 한도 문맥이 있어야 한다.

보류 조건:
- 월/명/연간/컨소시엄/총액/전체예산/총사업비/자부담/수수료/보증/대출/융자가 섞이면 hold 또는 keep_no_representative.
- 다중 프로그램 공고에서 어떤 프로그램을 대표로 삼아야 할지 운영 판단이 필요하면 hold.

공고:
policy_id: {clean(row.get("policy_id"))}
title: {clean(row.get("title"))}
organization: {clean(row.get("organization"))}
url: {clean(row.get("url"))}
old_amount_manwon: {clean(row.get("old_amount_manwon"))}
stage2_category: {clean(target.get("stage2_category_ko"))}
stage2_reason: {clean(target.get("stage2_reason"))}

후보 목록(JSON):
{json.dumps(indexed_candidates(row), ensure_ascii=False, indent=2)}

반환 JSON 형식:
{{
  "decision": "adopt_candidate|keep_no_representative|hold",
  "candidate_index": 0,
  "representative_amount_manwon": 1000,
  "amount_type": "support_amount|subsidy|voucher|support_ratio|loan|guarantee|non_cash|total_support_scale|total_budget|total_project_cost|revenue_condition|fee|self_funding|education_fee|equipment_usage_fee|consulting_fee|unknown",
  "roi_apply_method": "subtract|ratio_cap|recommend_only|exclude|review",
  "confidence": "high|medium|low",
  "reason": "한국어 한 문장",
  "evidence_text": "근거 문구"
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


def call_gemini(prompt: str, *, model: str) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    response = requests.post(
        url,
        params={"key": GEMINI_API_KEY},
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
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
    try:
        candidate_index = int(parsed.get("candidate_index"))
    except Exception:
        candidate_index = -1
    return {
        "gemini_decision": decision,
        "gemini_candidate_index": candidate_index,
        "gemini_amount_manwon": parsed.get("representative_amount_manwon"),
        "gemini_amount_type": amount_type,
        "gemini_roi_apply_method": roi_method,
        "gemini_confidence": confidence,
        "gemini_reason": clean(parsed.get("reason"), 700),
        "gemini_evidence_text": clean(parsed.get("evidence_text"), 700),
    }


def selected_candidate(row: dict[str, Any], review: dict[str, Any]) -> dict[str, Any] | None:
    candidates = row.get("new_amount_candidates") or []
    index = review["gemini_candidate_index"]
    if index < 0 or index >= len(candidates):
        return None
    selected = dict(candidates[index])
    amount_type = review["gemini_amount_type"]
    roi_method = review["gemini_roi_apply_method"]
    selected.update(
        {
            "max_amount_type": amount_type,
            "max_amount_type_ko": amount_utils.AMOUNT_TYPE_KO.get(amount_type, amount_utils.AMOUNT_TYPE_KO["unknown"]),
            "roi_apply_method": roi_method,
            "roi_apply_method_ko": amount_utils.ROI_METHOD_KO.get(roi_method, amount_utils.ROI_METHOD_KO["review"]),
            "is_roi_usable": roi_method == "subtract",
            "is_selected_amount": True,
            "reason": review["gemini_reason"] or selected.get("reason"),
        }
    )
    if review.get("gemini_evidence_text"):
        selected["evidence"] = review["gemini_evidence_text"]
    return selected


def sanity_decision(row: dict[str, Any], review: dict[str, Any]) -> tuple[str, str]:
    if review["gemini_decision"] != "adopt_candidate":
        return review["gemini_decision"], "Gemini가 대표 후보 없음 또는 보류로 판단"
    if review["gemini_confidence"] != "high":
        return "hold", "Gemini 채택 의견이나 high confidence가 아님"
    if review["gemini_amount_type"] not in CASH_TYPES:
        return "hold", "Gemini 채택 의견이나 현금성 대표금액 타입이 아님"
    if review["gemini_roi_apply_method"] != "subtract":
        return "hold", "Gemini 채택 의견이나 ROI 직접 차감 방식이 아님"
    selected = selected_candidate(row, review)
    if not selected:
        return "hold", "Gemini 후보 index가 유효하지 않음"
    if selected.get("amount_manwon") is None:
        return "hold", "선택 후보에 금액이 없음"
    context = candidate_text(selected, 1400)
    if any(word in context for word in HARD_RISK_WORDS):
        return "hold", "선택 후보 근거에 총액/자부담/금융성 위험 키워드가 있음"
    return "adopt_candidate", "Gemini high confidence와 sanity check 통과"


def payload_from_selected(row: dict[str, Any], selected: dict[str, Any]) -> dict[str, Any]:
    candidates = []
    for candidate in row.get("new_amount_candidates") or []:
        copied = dict(candidate)
        copied["is_selected_amount"] = False
        candidates.append(copied)
    for candidate in candidates:
        if candidate.get("amount_manwon") == selected.get("amount_manwon") and candidate.get("raw_text") == selected.get("raw_text"):
            candidate.update(selected)
            break
    else:
        candidates.append(selected)
    derived = amount_utils.derive_policy_amount_fields(selected, candidates)
    payload = {"policy_id": row.get("policy_id")}
    for field in [
        "amount_candidates",
        "selected_amount_candidate",
        "support_ratio",
        "max_amount_actual",
        "max_amount_status",
        "max_amount_type",
        "max_amount_type_ko",
        "max_amount_type_reason",
        "max_amount_numeric_manwon",
        "max_amount_evidence",
        "max_amount_note",
        "roi_apply_method",
        "roi_apply_method_ko",
        "roi_apply_reason",
    ]:
        if field in derived:
            payload[field] = derived[field]
    return payload


def row_hash(row: dict[str, Any], target: dict[str, str], model: str) -> str:
    source = json.dumps(
        {
            "model": model,
            "policy_id": clean(row.get("policy_id")),
            "stage2_category": clean(target.get("stage2_category")),
            "candidates": indexed_candidates(row),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini review for manual representative 91 stage2 targets.")
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--target-csv", default=str(DEFAULT_TARGET_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "manual_representative_91_gemini"))
    parser.add_argument("--cache-path", default=str(DEFAULT_CACHE_PATH))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--use-gemini", action="store_true")
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    reparse_rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in reparse_rows}
    targets = read_csv(Path(args.target_csv))
    if args.limit:
        targets = targets[: args.limit]

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    prompts: list[str] = []
    for index, target in enumerate(targets[:5], start=1):
        row = rows_by_id.get(clean(target.get("policy_id")), {})
        prompts.extend(["", "=" * 80, f"SAMPLE {index}", prompt_for_row(row, target)])
    prompt_path = output_dir / f"manual_representative_91_gemini_prompts_{timestamp}.txt"
    prompt_path.write_text("\n".join(prompts), encoding="utf-8")

    cache_path = Path(args.cache_path)
    cache = load_cache(cache_path)
    reviews: list[dict[str, Any]] = []
    payloads: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []

    for index, target in enumerate(targets, start=1):
        policy_id = clean(target.get("policy_id"))
        row = rows_by_id.get(policy_id)
        if not row:
            continue
        if args.use_gemini:
            key = row_hash(row, target, args.model)
            try:
                if not args.no_cache and key in cache:
                    parsed = cache[key]["parsed"]
                    source = "cache"
                else:
                    parsed = call_gemini(prompt_for_row(row, target), model=args.model)
                    cache[key] = {"parsed": parsed, "policy_id": policy_id}
                    save_cache(cache_path, cache)
                    source = "gemini"
                review = normalize_review(parsed)
                final_decision, sanity_reason = sanity_decision(row, review)
                status = "ok"
            except Exception as exc:  # noqa: BLE001
                review = {
                    "gemini_decision": "hold",
                    "gemini_candidate_index": -1,
                    "gemini_amount_manwon": "",
                    "gemini_amount_type": "unknown",
                    "gemini_roi_apply_method": "review",
                    "gemini_confidence": "low",
                    "gemini_reason": f"Gemini 검토 실패: {sanitize_error(exc)}",
                    "gemini_evidence_text": "",
                }
                final_decision = "hold"
                sanity_reason = "Gemini 실패로 보류"
                source = "error"
                status = "error"
        else:
            review = {
                "gemini_decision": "",
                "gemini_candidate_index": "",
                "gemini_amount_manwon": "",
                "gemini_amount_type": "",
                "gemini_roi_apply_method": "",
                "gemini_confidence": "",
                "gemini_reason": "prompt_only",
                "gemini_evidence_text": "",
            }
            final_decision = "hold"
            sanity_reason = "Gemini 미실행"
            source = "prompt_only"
            status = "prompt_only"

        selected = selected_candidate(row, review) if final_decision == "adopt_candidate" else None
        if selected:
            payload = payload_from_selected(row, selected)
            payloads.append(payload)
            audit_rows.append(
                {
                    "policy_id": policy_id,
                    "title": row.get("title"),
                    "organization": row.get("organization"),
                    "stage2_category": target.get("stage2_category"),
                    "stage2_category_ko": target.get("stage2_category_ko"),
                    "old_amount_manwon": row.get("old_amount_manwon"),
                    "new_amount_manwon": payload.get("max_amount_numeric_manwon"),
                    "new_amount_actual": payload.get("max_amount_actual"),
                    "new_amount_type": payload.get("max_amount_type"),
                    "new_roi_apply_method": payload.get("roi_apply_method"),
                    "gemini_candidate_index": review.get("gemini_candidate_index"),
                    "gemini_confidence": review.get("gemini_confidence"),
                    "gemini_reason": review.get("gemini_reason"),
                    "selected_context": candidate_text(selected, 900),
                }
            )

        reviews.append(
            {
                **target,
                **review,
                "final_suggested_action": final_decision,
                "sanity_reason": sanity_reason,
                "review_source": source,
                "review_status": status,
            }
        )
        if args.use_gemini:
            print(f"[{index}/{len(targets)}] {policy_id} final={final_decision} source={source}")
            if args.sleep:
                time.sleep(args.sleep)

    review_csv_path = output_dir / f"manual_representative_91_gemini_review_{timestamp}.csv"
    review_json_path = output_dir / f"manual_representative_91_gemini_review_{timestamp}.json"
    payload_path = output_dir / f"manual_representative_91_gemini_adopt_payload_{timestamp}.json"
    audit_csv_path = output_dir / f"manual_representative_91_gemini_adopt_audit_{timestamp}.csv"
    summary_path = output_dir / f"manual_representative_91_gemini_summary_{timestamp}.md"

    write_csv(review_csv_path, reviews)
    write_json(review_json_path, reviews)
    write_json(payload_path, payloads)
    write_csv(audit_csv_path, audit_rows)

    final_counts: dict[str, int] = {}
    for row in reviews:
        action = clean(row.get("final_suggested_action"))
        final_counts[action] = final_counts.get(action, 0) + 1
    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"use_gemini={args.use_gemini}",
        f"target_rows={len(targets)}",
        f"adopt_payload_rows={len(payloads)}",
        "",
        "## final_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(final_counts.items()))
    lines.extend(
        [
            "",
            "## outputs",
            f"- prompts: `{prompt_path}`",
            f"- review_csv: `{review_csv_path}`",
            f"- review_json: `{review_json_path}`",
            f"- adopt_payload: `{payload_path}`",
            f"- adopt_audit: `{audit_csv_path}`",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"use_gemini={args.use_gemini}")
    print(f"target_rows={len(targets)}")
    print(f"adopt_payload_rows={len(payloads)}")
    print(f"prompts={prompt_path}")
    print(f"review_csv={review_csv_path}")
    print(f"payload={payload_path}")
    print(f"audit_csv={audit_csv_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
