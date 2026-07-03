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
DEFAULT_ANALYSIS_CSV = (
    REPORT_DIR / "selected_candidate_missing" / "selected_candidate_missing_analysis.csv"
)
DEFAULT_CACHE_PATH = ROOT / "data" / "cache" / "selected_candidate_missing_gemini_cache.json"
DEFAULT_MODEL = (
    os.getenv("GEMINI_MODEL")
    or os.getenv("DATA_LLM_MODEL")
    or "gemini-2.5-flash-lite"
).replace("google/", "").removeprefix("models/")
GEMINI_TIMEOUT_SECONDS = 60

TARGET_GROUPS = {"mixed_with_unknown", "unknown_only"}
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
CASH_TYPES = {"support_amount", "subsidy", "voucher"}
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


def sanitize_error(exc: Exception) -> str:
    text = clean(exc, 700)
    if GEMINI_API_KEY:
        text = text.replace(GEMINI_API_KEY, "[REDACTED_API_KEY]")
    text = re.sub(r"key=[^&\s)]+", "key=[REDACTED_API_KEY]", text)
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


def candidate_text(candidate: dict[str, Any], max_len: int = 260) -> str:
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


def prompt_for_row(row: dict[str, Any], analysis: dict[str, str]) -> str:
    candidates = indexed_candidates(row)
    return f"""
너는 제조업/중소기업 지원사업 공고에서 대표 지원금 후보를 고르는 검수자다.
아래 금액 후보 중 ROI 직접 차감 가능한 대표 지원금이 명확히 있으면 후보 index를 고르고, 없으면 없다고 판단해라.
반드시 JSON 객체 하나만 반환해라.

decision:
- adopt_candidate: 후보 중 하나가 기업/과제/사업장 단위의 대표 현금성 지원금으로 명확함
- keep_no_representative: 후보가 지원비율, 총지원규모, 매출조건, 자부담, 수수료, 교육/컨설팅/장비사용료, 금융성 한도 등이라 대표금액을 만들면 안 됨
- hold: 표/문맥 연결이 불분명하거나 확신이 낮음

주의:
- 총사업비/총지원금/지원규모/전체예산/누적금액/매출액 조건은 대표 지원금이 아니다.
- 융자/대출/보증/이차보전/팩토링은 ROI 직접 차감 대표금액이 아니다.
- 교육비/컨설팅비/장비사용료/시험수수료/인증비는 보통 직접 차감 보조금이 아니라 recommend_only 또는 제외다.
- 월별/명당/건당/점당 금액은 확신이 없으면 hold.
- 확신이 낮으면 hold.

공고:
policy_id: {clean(row.get("policy_id"))}
title: {clean(row.get("title"))}
organization: {clean(row.get("organization"))}
url: {clean(row.get("url"))}
old_amount: {clean(row.get("old_amount_manwon"))}
old_amount_actual: {clean(row.get("old_actual"))}
old_amount_type: {clean(row.get("old_amount_type"))}
analysis_group: {clean(analysis.get("group"))}
candidate_types: {clean(analysis.get("candidate_types"))}

후보 목록(JSON):
{json.dumps(candidates, ensure_ascii=False, indent=2)}

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


def candidate_with_gemini_type(row: dict[str, Any], review: dict[str, Any]) -> dict[str, Any] | None:
    candidates = row.get("new_amount_candidates") or []
    index = review["gemini_candidate_index"]
    if index < 0 or index >= len(candidates):
        return None
    selected = dict(candidates[index])
    amount_type = review["gemini_amount_type"]
    roi_method = review["gemini_roi_apply_method"]
    selected["max_amount_type"] = amount_type
    selected["max_amount_type_ko"] = amount_utils.AMOUNT_TYPE_KO.get(amount_type, amount_utils.AMOUNT_TYPE_KO["unknown"])
    selected["roi_apply_method"] = roi_method
    selected["roi_apply_method_ko"] = amount_utils.ROI_METHOD_KO.get(roi_method, amount_utils.ROI_METHOD_KO["review"])
    selected["is_roi_usable"] = roi_method in {"subtract", "ratio_cap"}
    selected["is_selected_amount"] = True
    selected["reason"] = review["gemini_reason"] or selected.get("reason")
    if review.get("gemini_evidence_text"):
        selected["evidence"] = review["gemini_evidence_text"]
    return selected


def sanity_decision(row: dict[str, Any], review: dict[str, Any]) -> tuple[str, str]:
    if review["gemini_decision"] != "adopt_candidate":
        return review["gemini_decision"], "Gemini가 대표 후보 없음 또는 보류로 판단"
    if review["gemini_confidence"] != "high":
        return "hold", "Gemini adopt_candidate이나 high confidence가 아님"
    if review["gemini_amount_type"] not in CASH_TYPES:
        return "hold", "Gemini adopt_candidate이나 현금성 대표금액 타입이 아님"
    if review["gemini_roi_apply_method"] != "subtract":
        return "hold", "Gemini adopt_candidate이나 ROI 직접 차감 방식이 아님"
    selected = candidate_with_gemini_type(row, review)
    if not selected:
        return "hold", "Gemini 후보 index가 유효하지 않음"
    if selected.get("amount_manwon") is None:
        return "hold", "선택 후보에 금액이 없음"
    context = candidate_text(selected, 1400)
    if any(keyword in context for keyword in HARD_RISK_WORDS):
        return "hold", "선택 후보 근거에 하드 위험 키워드가 있음"
    return "adopt_candidate", "Gemini high confidence와 sanity check 통과"


def payload_from_selected(row: dict[str, Any], selected: dict[str, Any]) -> dict[str, Any]:
    candidates = []
    for candidate in row.get("new_amount_candidates") or []:
        copied = dict(candidate)
        copied["is_selected_amount"] = False
        candidates.append(copied)
    for candidate in candidates:
        if (
            candidate.get("amount_manwon") == selected.get("amount_manwon")
            and candidate.get("raw_text") == selected.get("raw_text")
        ):
            candidate.update(selected)
            break
    else:
        candidates.append(selected)
    derived = amount_utils.derive_policy_amount_fields(selected, candidates)
    fields = [
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
    ]
    payload = {"policy_id": row.get("policy_id")}
    for field in fields:
        if field in derived:
            payload[field] = derived[field]
    return payload


def row_hash(row: dict[str, Any], analysis: dict[str, str], model: str) -> str:
    source = json.dumps(
        {
            "model": model,
            "policy_id": clean(row.get("policy_id")),
            "group": clean(analysis.get("group")),
            "candidate_types": clean(analysis.get("candidate_types")),
            "candidates": indexed_candidates(row),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Review selected_candidate_missing unknown groups with Gemini. No DB updates."
    )
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--analysis-csv", default=str(DEFAULT_ANALYSIS_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "selected_candidate_missing_gemini"))
    parser.add_argument("--cache-path", default=str(DEFAULT_CACHE_PATH))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=0, help="0 means all target rows")
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--use-gemini", action="store_true", help="Actually call Gemini. Default writes prompt samples only.")
    parser.add_argument("--no-cache", action="store_true")
    args = parser.parse_args()

    reparse_rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in reparse_rows}
    analysis_rows = [
        row for row in read_csv(Path(args.analysis_csv))
        if clean(row.get("group")) in TARGET_GROUPS
    ]
    if args.limit:
        analysis_rows = analysis_rows[: args.limit]

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    prompt_path = output_dir / f"selected_candidate_missing_gemini_prompts_{timestamp}.txt"
    prompts: list[str] = []
    for index, analysis in enumerate(analysis_rows[:5], start=1):
        row = rows_by_id.get(clean(analysis.get("policy_id")), {})
        prompts.extend(["", "=" * 80, f"SAMPLE {index}", prompt_for_row(row, analysis)])
    prompt_path.write_text("\n".join(prompts), encoding="utf-8")

    cache_path = Path(args.cache_path)
    cache = load_cache(cache_path)
    reviews: list[dict[str, Any]] = []
    payloads: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []

    for index, analysis in enumerate(analysis_rows, start=1):
        policy_id = clean(analysis.get("policy_id"))
        row = rows_by_id.get(policy_id)
        if not row:
            continue
        if args.use_gemini:
            key = row_hash(row, analysis, args.model)
            try:
                if not args.no_cache and key in cache:
                    parsed = cache[key]["parsed"]
                    source = "cache"
                else:
                    parsed = call_gemini(prompt_for_row(row, analysis), model=args.model)
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

        selected = candidate_with_gemini_type(row, review) if final_decision == "adopt_candidate" else None
        if selected:
            payload = payload_from_selected(row, selected)
            payloads.append(payload)
            audit_rows.append(
                {
                    "policy_id": policy_id,
                    "title": row.get("title"),
                    "organization": row.get("organization"),
                    "group": analysis.get("group"),
                    "old_amount_manwon": row.get("old_amount_manwon"),
                    "old_amount_actual": row.get("old_actual"),
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
                **analysis,
                **review,
                "final_suggested_action": final_decision,
                "sanity_reason": sanity_reason,
                "review_source": source,
                "review_status": status,
            }
        )
        if args.use_gemini:
            print(
                f"[{index}/{len(analysis_rows)}] {policy_id} "
                f"gemini={review['gemini_decision']} confidence={review['gemini_confidence']} "
                f"final={final_decision} source={source}"
            )
            if args.sleep:
                time.sleep(args.sleep)

    review_csv_path = output_dir / f"selected_candidate_missing_gemini_review_{timestamp}.csv"
    review_json_path = output_dir / f"selected_candidate_missing_gemini_review_{timestamp}.json"
    payload_path = output_dir / f"selected_candidate_missing_adopt_payload_{timestamp}.json"
    audit_csv_path = output_dir / f"selected_candidate_missing_adopt_audit_{timestamp}.csv"
    md_path = output_dir / f"selected_candidate_missing_gemini_review_{timestamp}.md"
    write_csv(review_csv_path, reviews)
    write_json(review_json_path, reviews)
    write_json(payload_path, payloads)
    write_csv(audit_csv_path, audit_rows)

    gemini_counts: dict[str, int] = {}
    final_counts: dict[str, int] = {}
    for row in reviews:
        gemini_key = clean(row.get("gemini_decision")) or "prompt_only"
        final_key = clean(row.get("final_suggested_action"))
        gemini_counts[gemini_key] = gemini_counts.get(gemini_key, 0) + 1
        final_counts[final_key] = final_counts.get(final_key, 0) + 1
    lines = [
        f"reparse_json={args.reparse_json}",
        f"analysis_csv={args.analysis_csv}",
        f"target_rows={len(analysis_rows)}",
        f"use_gemini={args.use_gemini}",
        f"model={args.model}",
        "",
        f"gemini_decisions={gemini_counts}",
        f"final_suggested_actions={final_counts}",
        f"payload_rows={len(payloads)}",
        "",
        "## adopt samples",
    ]
    for row in audit_rows[:20]:
        lines.extend(
            [
                "",
                f"### {row['policy_id']} | {row['title']}",
                f"- group: {row['group']}",
                f"- old -> new: {row['old_amount_manwon']} -> {row['new_amount_manwon']}",
                f"- confidence: {row['gemini_confidence']}",
                f"- reason: {row['gemini_reason']}",
                f"- context: {clean(row['selected_context'], 280)}",
            ]
        )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print("No database rows were updated.")
    print(f"target_rows={len(analysis_rows)}")
    print(f"use_gemini={args.use_gemini}")
    print(f"gemini_decisions={gemini_counts}")
    print(f"final_suggested_actions={final_counts}")
    print(f"payload_rows={len(payloads)}")
    print(f"prompts={prompt_path}")
    print(f"review_csv={review_csv_path}")
    print(f"review_json={review_json_path}")
    print(f"payload={payload_path}")
    print(f"audit_csv={audit_csv_path}")
    print(f"md={md_path}")


if __name__ == "__main__":
    main()
