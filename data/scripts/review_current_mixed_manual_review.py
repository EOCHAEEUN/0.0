from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


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

TARGET_CATEGORY = "mixed_manual_review"
DIRECT_TYPES = {"support_amount", "subsidy", "voucher"}
NON_CASH_TYPES = {"non_cash", "fee", "education_fee", "consulting_fee", "equipment_usage_fee"}
FINANCE_TYPES = {"loan", "guarantee", "interest_support"}
TOTAL_TYPES = {"total_support_scale", "total_budget", "total_project_cost"}
RISK_WORDS = [
    "/",
    "월",
    "명당",
    "인당",
    "건당",
    "자부담",
    "부담금",
    "수수료",
    "총사업비",
    "총 사업비",
    "총 지원규모",
    "사업규모",
    "예산",
    "컨소시엄",
    "인건비",
    "채용",
]
CLEAR_LIMIT_WORDS = ["최대", "한도", "이내", "이하", "까지", "기업당", "업체당", "법인", "과제당"]

SELECT_FIELDS = (
    "policy_id,title,organization,url,amount_candidates,selected_amount_candidate,"
    "support_ratio,amount_manual_review_status,amount_manual_review_category,"
    "amount_manual_review_reason,roi_apply_method"
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
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def fetch_rows(supabase: Client) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = (
            supabase.table("policy")
            .select(SELECT_FIELDS)
            .eq("amount_manual_review_category", TARGET_CATEGORY)
            .range(start, end)
            .execute()
        )
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


def context(candidate: dict[str, Any]) -> str:
    return clean(
        candidate.get("evidence")
        or candidate.get("local_context")
        or candidate.get("raw_text")
        or candidate.get("display_amount"),
        600,
    )


def is_direct_candidate(candidate: dict[str, Any]) -> bool:
    if clean(candidate.get("max_amount_type")) not in DIRECT_TYPES:
        return False
    if amount_manwon(candidate) is None:
        return False
    if candidate.get("is_roi_usable") is False:
        return False
    roi_method = clean(candidate.get("roi_apply_method"))
    return not roi_method or roi_method == "subtract"


def classify(row: dict[str, Any]) -> dict[str, Any]:
    candidates = [
        candidate
        for candidate in row.get("amount_candidates") or []
        if isinstance(candidate, dict)
    ]
    direct = [candidate for candidate in candidates if is_direct_candidate(candidate)]
    types = [clean(candidate.get("max_amount_type")) or "unknown" for candidate in candidates]
    direct_context = " ".join(context(candidate) for candidate in direct)
    has_risk = any(word in direct_context for word in RISK_WORDS)
    has_clear_limit = any(word in direct_context for word in CLEAR_LIMIT_WORDS)

    if not candidates:
        category = "reparse_needed_no_candidates"
        reason = "후보 JSON이 없어 원문/첨부 재파싱 필요"
    elif not direct:
        if any(kind in NON_CASH_TYPES for kind in types):
            category = "non_cash_or_fee_only"
            reason = "비현금/수수료/컨설팅성 후보만 있어 ROI 직접 차감 불가"
        elif any(kind in FINANCE_TYPES for kind in types):
            category = "finance_only"
            reason = "융자/보증/이차보전 계열이라 ROI 직접 차감 제외"
        elif any(kind in TOTAL_TYPES for kind in types):
            category = "total_scale_only"
            reason = "총규모/총사업비 계열이라 기업당 한도 확인 필요"
        elif any(kind == "support_ratio" for kind in types) or row.get("support_ratio") is not None:
            category = "ratio_only"
            reason = "금액 대표값 없이 지원비율 중심"
        else:
            category = "reparse_needed_no_direct_cash"
            reason = "후보는 있으나 직접 현금/바우처 금액 후보가 없음"
    elif len(direct) == 1 and has_clear_limit and not has_risk:
        category = "auto_adopt_candidate_possible"
        reason = "직접지원 후보 1개이고 최대/한도 문맥이 명확하며 위험 단위 문맥 없음"
    elif len(direct) == 1:
        category = "manual_check_single_direct_candidate"
        reason = "직접지원 후보 1개이나 한도/단위/총규모 문맥 확인 필요"
    else:
        amounts = {amount_manwon(candidate) for candidate in direct}
        if len(amounts) == 1 and has_clear_limit and not has_risk:
            category = "auto_adopt_same_amount_possible"
            reason = "직접지원 후보 여러 개의 금액이 같고 한도 문맥이 명확"
        else:
            category = "manual_check_multi_direct_candidates"
            reason = "직접지원 후보가 여러 개라 대표 선택 필요"

    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "stage2_category": category,
        "stage2_reason": reason,
        "candidate_count": len(candidates),
        "direct_cash_candidate_count": len(direct),
        "candidate_types": ", ".join(sorted(set(types))),
        "direct_amounts_manwon": ", ".join(str(amount_manwon(candidate)) for candidate in direct[:8]),
        "selected_flags": ", ".join(str(candidate.get("is_selected_amount")) for candidate in direct[:8]),
        "direct_candidate_summary": " || ".join(
            f"{amount_manwon(candidate)}만원/{clean(candidate.get('max_amount_type'))}/{context(candidate)[:180]}"
            for candidate in direct[:6]
        ),
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
    parser = argparse.ArgumentParser(description="Read-only review for current mixed_manual_review policies.")
    parser.add_argument("--output-dir", default=str(REPORT_DIR))
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    rows = fetch_rows(client())
    audit_rows = [classify(row) for row in rows]
    counts: dict[str, int] = {}
    for row in audit_rows:
        counts[row["stage2_category"]] = counts.get(row["stage2_category"], 0) + 1

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    audit_path = output_dir / f"mixed_manual_review_current_audit_{timestamp}.csv"
    summary_path = output_dir / f"mixed_manual_review_current_summary_{timestamp}.md"
    write_csv(audit_path, audit_rows)
    summary_path.write_text(
        "\n".join([
            "DRY-RUN only. No database rows were updated.",
            f"source_rows={len(rows)}",
            "",
            "## stage2 counts",
            *[f"- {key}: {counts[key]}" for key in sorted(counts)],
            "",
            f"audit_csv={audit_path}",
        ])
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "source_rows": len(rows),
        "counts": counts,
        "audit_csv": str(audit_path),
        "summary_md": str(summary_path),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
