from __future__ import annotations

import csv
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_current_review"

for env_path in [Path.cwd() / ".env", ROOT / ".env", ROOT / "backend" / ".env", SCRIPT_DIR / ".env"]:
    if env_path.exists():
        load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()

SELECT_FIELDS = (
    "policy_id,title,organization,url,summary,support_method,amount_candidates,"
    "selected_amount_candidate,support_ratio,max_amount_numeric_manwon,max_amount_actual,"
    "max_amount_type,roi_apply_method,roi_apply_method_ko,roi_apply_reason,"
    "amount_manual_review_required,amount_manual_review_status,"
    "amount_manual_review_category,amount_manual_review_reason"
)

FINANCE_TERMS = [
    "융자",
    "대출",
    "보증",
    "이차보전",
    "이자",
    "금리",
    "보증료",
    "운전자금",
    "시설자금",
    "상환",
    "거치",
    "loan",
    "guarantee",
    "interest",
]
ITEM_FEE_TERMS = [
    "수수료",
    "인증",
    "교육",
    "컨설팅",
    "상담",
    "멘토링",
    "임대",
    "사용료",
    "fee",
    "education",
    "consulting",
    "non_cash",
]
SELF_OR_TOTAL_TERMS = [
    "자부담",
    "기업부담",
    "민간부담",
    "총사업비",
    "총 사업비",
    "총예산",
    "총 예산",
    "총지원규모",
    "총 지원규모",
    "사업규모",
    "매출",
    "revenue",
    "self_funding",
    "total_budget",
    "total_support_scale",
    "total_project_cost",
]
DIRECT_RATIO_TERMS = [
    "사업비",
    "소요비용",
    "공급가액",
    "지원금",
    "지원비율",
    "정부지원",
    "국비",
    "보조금",
    "바우처",
    "이내 지원",
]


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
        batch = supabase.table("policy").select(SELECT_FIELDS).range(start, start + 999).execute().data or []
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        start += 1000


def filled(value: Any) -> bool:
    return value is not None and value != "" and value != [] and value != {}


def selected(row: dict[str, Any]) -> bool:
    value = row.get("selected_amount_candidate")
    return isinstance(value, dict) and bool(value)


def numeric(row: dict[str, Any]) -> bool:
    return row.get("max_amount_numeric_manwon") is not None


def ok_status(row: dict[str, Any]) -> bool:
    return row.get("amount_manual_review_status") in {"not_required", "reviewed"}


def confirmed_amount(row: dict[str, Any]) -> bool:
    return row.get("roi_apply_method") == "subtract" and ok_status(row) and selected(row) and numeric(row)


def confirmed_ratio(row: dict[str, Any]) -> bool:
    return row.get("roi_apply_method") == "ratio_cap" and ok_status(row) and row.get("support_ratio") is not None


def candidate_text(row: dict[str, Any]) -> str:
    parts = [
        row.get("title"),
        row.get("summary"),
        row.get("support_method"),
        row.get("max_amount_type"),
        row.get("roi_apply_method"),
        row.get("amount_manual_review_category"),
        row.get("amount_manual_review_reason"),
    ]
    for candidate in row.get("amount_candidates") or []:
        if not isinstance(candidate, dict):
            continue
        parts.extend(
            [
                candidate.get("max_amount_type"),
                candidate.get("amount_type"),
                candidate.get("roi_apply_method"),
                candidate.get("display_amount"),
                candidate.get("evidence"),
                candidate.get("local_context"),
                candidate.get("raw_text"),
                candidate.get("label"),
            ]
        )
    return clean(" ".join(clean(part) for part in parts), 6000).lower()


def ratio_context_text(row: dict[str, Any]) -> str:
    ratio_items = ratio_candidates(row)
    parts = [row.get("title"), row.get("max_amount_type"), row.get("roi_apply_method")]
    if ratio_items:
        for candidate in ratio_items:
            parts.extend(
                [
                    candidate.get("max_amount_type"),
                    candidate.get("amount_type"),
                    candidate.get("roi_apply_method"),
                    candidate.get("display_amount"),
                    candidate.get("evidence"),
                    candidate.get("local_context"),
                    candidate.get("raw_text"),
                    candidate.get("label"),
                ]
            )
    else:
        parts.extend([row.get("summary"), row.get("support_method")])
    return clean(" ".join(clean(part) for part in parts), 4000).lower()


def has_any(text: str, terms: list[str]) -> bool:
    return any(term.lower() in text for term in terms)


def ratio_candidates(row: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for index, candidate in enumerate(row.get("amount_candidates") or []):
        if not isinstance(candidate, dict):
            continue
        if candidate.get("support_ratio") is not None or clean(candidate.get("max_amount_type")) == "support_ratio":
            items.append({"index": index, **candidate})
    return items


def classify(row: dict[str, Any]) -> tuple[str, list[str]]:
    if row.get("support_ratio") is None:
        return "no_support_ratio", ["support_ratio 없음"]
    try:
        ratio = float(row.get("support_ratio"))
    except (TypeError, ValueError):
        return "blocked_bad_ratio", ["support_ratio 숫자 아님"]
    if not 0 < ratio <= 1:
        return "blocked_bad_ratio", ["support_ratio 0~1 범위 밖"]
    if confirmed_amount(row):
        return "already_confirmed_amount", ["확정 대표금액 차감 우선"]
    if confirmed_ratio(row):
        return "already_confirmed_ratio", ["기존 ratio_cap 확정"]

    # Judge the ratio on its own evidence. A policy row can contain mixed
    # candidates; unrelated consulting/fee/total-budget candidates should not
    # automatically kill an otherwise usable support ratio.
    text = ratio_context_text(row)
    reasons: list[str] = []
    if has_any(text, FINANCE_TERMS):
        reasons.append("금융/융자/보증/이차보전 문맥")
    if has_any(text, ITEM_FEE_TERMS):
        reasons.append("수수료/인증/교육/컨설팅/비현금 문맥")
    if has_any(text, SELF_OR_TOTAL_TERMS):
        reasons.append("자부담/총사업비/총규모/매출 문맥")

    if reasons:
        return "blocked_context", reasons

    direct_hint = has_any(text, DIRECT_RATIO_TERMS)
    if ok_status(row):
        if direct_hint:
            return "estimated_ratio_ok", ["지원비율 직접 적용 가능 문맥"]
        return "estimated_ratio_needs_light_review", ["위험 문맥은 없지만 직접지원 문맥 약함"]

    if direct_hint:
        return "estimated_ratio_pending_review", ["pending/review 필요, 단 직접지원 문맥 있음"]
    return "estimated_ratio_pending_weak", ["pending/review 필요, 직접지원 문맥 약함"]


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()), escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rows = fetch_rows(client())
    output: list[dict[str, Any]] = []
    for row in rows:
        klass, reasons = classify(row)
        ratio_items = ratio_candidates(row)
        output.append(
            {
                "policy_id": row.get("policy_id"),
                "title": row.get("title"),
                "organization": row.get("organization"),
                "support_ratio": row.get("support_ratio"),
                "ratio_audit_class": klass,
                "ratio_audit_reasons": "; ".join(reasons),
                "roi_apply_method": row.get("roi_apply_method"),
                "manual_status": row.get("amount_manual_review_status"),
                "manual_required": row.get("amount_manual_review_required"),
                "manual_category": row.get("amount_manual_review_category"),
                "has_selected": selected(row),
                "has_numeric": numeric(row),
                "ratio_candidate_count": len(ratio_items),
                "amount_candidate_count": len(row.get("amount_candidates") or []),
                "url": row.get("url"),
            }
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = REPORT_DIR / f"ratio_estimate_audit_{timestamp}.csv"
    summary_path = REPORT_DIR / f"ratio_estimate_audit_summary_{timestamp}.md"
    write_csv(csv_path, output)

    class_counts = Counter(item["ratio_audit_class"] for item in output)
    method_counts = Counter(
        item["roi_apply_method"] or "NULL"
        for item in output
        if item["ratio_audit_class"].startswith("estimated_ratio")
    )
    status_counts = Counter(
        item["manual_status"] or "NULL"
        for item in output
        if item["ratio_audit_class"].startswith("estimated_ratio")
    )
    usable_strict = class_counts["estimated_ratio_ok"]
    usable_with_light_review = usable_strict + class_counts["estimated_ratio_needs_light_review"]
    usable_with_pending = (
        usable_with_light_review
        + class_counts["estimated_ratio_pending_review"]
        + class_counts["estimated_ratio_pending_weak"]
    )
    summary = {
        "dry_run_only": True,
        "total": len(rows),
        "support_ratio_filled": sum(item["support_ratio"] is not None for item in output),
        "class_counts": dict(class_counts),
        "usable_strict_estimated_ratio": usable_strict,
        "usable_with_light_review": usable_with_light_review,
        "usable_with_pending_label": usable_with_pending,
        "estimated_ratio_roi_method_counts": dict(method_counts),
        "estimated_ratio_manual_status_counts": dict(status_counts),
        "csv": str(csv_path),
        "summary": str(summary_path),
    }
    lines = [
        "DRY-RUN only. No database rows were updated.",
        "",
        json.dumps(summary, ensure_ascii=False, indent=2),
    ]
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
