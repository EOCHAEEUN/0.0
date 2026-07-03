from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
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
RISK_WORDS = [
    "월",
    "매월",
    "월별",
    "명당",
    "인당",
    "1인",
    "건당",
    "회당",
    "1회",
    "연간",
    "년간",
    "개월",
    "개사",
    "총사업비",
    "총 사업비",
    "총예산",
    "전체예산",
    "지원규모",
    "사업규모",
    "자부담",
    "부담금",
    "민간부담",
    "수수료",
    "융자",
    "대출",
    "보증",
    "컨소시엄",
    "/",
    "~",
]
CLEAR_LIMIT_WORDS = [
    "최대",
    "한도",
    "이내",
    "이하",
    "까지",
    "기업당",
    "업체당",
    "과제당",
    "사업주",
    "법인",
    "지원금액",
    "지원금",
]
SELECT_FIELDS = (
    "policy_id,title,organization,url,amount_candidates,selected_amount_candidate,"
    "support_ratio,max_amount_numeric_manwon,roi_apply_method,"
    "amount_manual_review_status,amount_manual_review_category"
)


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
    value = candidate.get("amount_manwon")
    if value is None:
        value = candidate.get("amount_numeric_manwon")
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    return amount if amount > 0 else None


def candidate_context(candidate: dict[str, Any]) -> str:
    return clean(
        candidate.get("evidence")
        or candidate.get("local_context")
        or candidate.get("raw_text")
        or candidate.get("display_amount")
        or candidate.get("label"),
        700,
    )


def has_any(text: str, words: list[str] | set[str]) -> bool:
    return any(word in text for word in words)


def is_direct_cash(candidate: dict[str, Any]) -> bool:
    amount_type = clean(candidate.get("max_amount_type"))
    if amount_type not in DIRECT_TYPES:
        return False
    if amount_manwon(candidate) is None:
        return False
    if candidate.get("is_roi_usable") is False:
        return False
    roi_method = clean(candidate.get("roi_apply_method"))
    return not roi_method or roi_method == "subtract"


def classify_row(row: dict[str, Any]) -> dict[str, Any]:
    candidates = [
        candidate
        for candidate in row.get("amount_candidates") or []
        if isinstance(candidate, dict)
    ]
    direct = [candidate for candidate in candidates if is_direct_cash(candidate)]
    types = [clean(candidate.get("max_amount_type")) or "unknown" for candidate in candidates]
    excluded_types = [kind for kind in types if kind in EXCLUDE_TYPES]
    direct_context = " ".join(candidate_context(candidate) for candidate in direct)
    risky = has_any(direct_context, RISK_WORDS)
    clear_limit = has_any(direct_context, CLEAR_LIMIT_WORDS)

    selected: dict[str, Any] | None = None
    category = ""
    reason = ""
    confidence = ""

    if not candidates:
        category = "hold_no_candidates"
        reason = "후보 JSON 없음"
        confidence = "none"
    elif not direct:
        if excluded_types:
            category = "exclude_non_cash_finance_total"
            reason = "직접지원 후보 없이 제외/총규모/금융/비현금 유형만 있음"
        elif row.get("support_ratio") is not None:
            category = "ratio_only"
            reason = "금액 후보 없이 지원비율만 있음"
        else:
            category = "hold_no_direct_cash"
            reason = "후보는 있으나 현금성 직접지원 금액 후보 없음"
        confidence = "none"
    elif risky:
        category = "hold_unit_or_total_context"
        reason = "월/명/건/기간/총규모/자부담 등 위험 문맥 포함"
        confidence = "none"
    else:
        amounts = {amount_manwon(candidate) for candidate in direct}
        direct_sorted = sorted(direct, key=lambda item: amount_manwon(item) or 0, reverse=True)
        selected = direct_sorted[0]
        if len(direct) == 1 and clear_limit:
            category = "roi_estimate_high"
            reason = "단일 현금성 직접지원 후보이며 한도 문맥 명확"
            confidence = "high"
        elif len(direct) == 1:
            category = "roi_estimate_medium"
            reason = "단일 현금성 직접지원 후보이나 한도 문맥 약함"
            confidence = "medium"
        elif len(amounts) == 1 and clear_limit:
            category = "roi_estimate_high_same_amount"
            reason = "복수 직접지원 후보이나 금액이 같고 한도 문맥 명확"
            confidence = "high"
        else:
            category = "roi_estimate_medium_max_cash"
            reason = "복수 직접지원 후보 중 최대 현금성 금액을 추정 후보로 선택"
            confidence = "medium"

    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "stage2_category": category,
        "confidence": confidence,
        "reason": reason,
        "candidate_count": len(candidates),
        "direct_cash_candidate_count": len(direct),
        "candidate_types": ", ".join(sorted(set(types))),
        "estimated_amount_manwon": amount_manwon(selected) if selected else "",
        "estimated_type": clean(selected.get("max_amount_type")) if selected else "",
        "estimated_context": candidate_context(selected) if selected else "",
        "direct_candidate_summary": " || ".join(
            f"{amount_manwon(candidate)}만원/{clean(candidate.get('max_amount_type'))}/{candidate_context(candidate)[:180]}"
            for candidate in sorted(direct, key=lambda item: amount_manwon(item) or 0, reverse=True)[:6]
        ),
        "manual_status": row.get("amount_manual_review_status"),
        "manual_category": row.get("amount_manual_review_category"),
        "url": row.get("url"),
    }


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
    parser = argparse.ArgumentParser(description="Dry-run ROI estimate classification for rows with candidates but no selected amount.")
    parser.add_argument("--output-dir", default=str(REPORT_DIR))
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    rows = fetch_rows(client())
    targets = [
        row for row in rows
        if row.get("amount_candidates") and not row.get("selected_amount_candidate")
    ]
    audit_rows = [classify_row(row) for row in targets]
    counts: dict[str, int] = {}
    confidence_counts: dict[str, int] = {}
    amount_sum_by_confidence: dict[str, float] = {}
    for row in audit_rows:
        counts[row["stage2_category"]] = counts.get(row["stage2_category"], 0) + 1
        confidence = row["confidence"] or "none"
        confidence_counts[confidence] = confidence_counts.get(confidence, 0) + 1
        try:
            amount = float(row["estimated_amount_manwon"] or 0)
        except (TypeError, ValueError):
            amount = 0
        amount_sum_by_confidence[confidence] = amount_sum_by_confidence.get(confidence, 0) + amount

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    audit_path = output_dir / f"roi_estimate_candidates_dry_run_{timestamp}.csv"
    summary_path = output_dir / f"roi_estimate_candidates_dry_run_summary_{timestamp}.md"
    write_csv(audit_path, audit_rows)

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"target_rows={len(targets)}",
        "",
        "## category counts",
        *[f"- {key}: {counts[key]}" for key in sorted(counts)],
        "",
        "## confidence counts",
        *[f"- {key}: {confidence_counts[key]}" for key in sorted(confidence_counts)],
        "",
        "## estimated amount sum by confidence",
        *[f"- {key}: {amount_sum_by_confidence[key]:,.2f} 만원" for key in sorted(amount_sum_by_confidence)],
        "",
        f"audit_csv={audit_path}",
    ]
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps({
        "target_rows": len(targets),
        "counts": counts,
        "confidence_counts": confidence_counts,
        "estimated_amount_sum_by_confidence_manwon": amount_sum_by_confidence,
        "audit_csv": str(audit_path),
        "summary_md": str(summary_path),
        "preview_estimates": [
            row for row in audit_rows
            if row["confidence"] in {"high", "medium"}
        ][:12],
    }, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
