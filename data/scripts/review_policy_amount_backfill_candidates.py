from __future__ import annotations

import argparse
import csv
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

import policy_amount_utils as amount_utils


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent

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
DEFAULT_TABLE = os.getenv("POLICY_SYNC_TARGET_TABLE", "policy").strip()
DEFAULT_OUTPUT_DIR = ROOT / "data" / "reports" / "policy_amount_backfill"

SELECT_COLUMNS = ",".join(
    [
        "policy_id",
        "title",
        "organization",
        "summary",
        "support_method",
        "max_amount",
        "max_amount_numeric_manwon",
        "max_amount_actual",
        "max_amount_type",
        "max_amount_type_ko",
        "max_amount_evidence",
        "max_amount_basis_text",
        "max_amount_basis_evidence_text",
        "roi_apply_method",
        "amount_candidates",
        "selected_amount_candidate",
        "support_ratio",
        "raw_text",
    ]
)

RISK_BASIS_KEYWORDS = [
    "전체예산",
    "지원규모",
    "총사업비",
    "총 사업비",
    "매출액",
    "연매출",
    "수수료",
    "자부담",
    "민간부담",
    "교육비",
    "컨설팅",
    "장비사용료",
    "과제비",
]


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean_text(value: Any, max_len: int | None = None) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, default=str)
    else:
        text = str(value)
    text = re.sub(r"\s+", " ", text).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def numeric_or_none(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_all(supabase: Client, table: str, limit: int = 0) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        if limit and len(rows) >= limit:
            return rows[:limit]
        page_size = min(batch_size, limit - len(rows)) if limit else batch_size
        end = start + page_size - 1
        response = (
            supabase.table(table)
            .select(SELECT_COLUMNS)
            .order("policy_id")
            .range(start, end)
            .execute()
        )
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows


def source_text(row: dict[str, Any]) -> str:
    parts = [
        row.get("title"),
        row.get("summary"),
        row.get("support_method"),
        row.get("max_amount_actual"),
        row.get("max_amount_evidence"),
        row.get("max_amount_basis_text"),
        row.get("max_amount_basis_evidence_text"),
        row.get("raw_text"),
    ]
    return "\n".join(clean_text(part, 60000) for part in parts if clean_text(part))


def risk_reasons(row: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    amount = numeric_or_none(row.get("max_amount_numeric_manwon") or row.get("max_amount"))
    amount_type = clean_text(row.get("max_amount_type")).lower()
    roi_method = clean_text(row.get("roi_apply_method")).lower()
    basis = " ".join(
        clean_text(row.get(key), 2000)
        for key in [
            "max_amount_basis_text",
            "max_amount_basis_evidence_text",
            "max_amount_evidence",
            "max_amount_actual",
        ]
    )

    if roi_method == "subtract" and amount is not None and amount >= 100000:
        reasons.append("subtract 금액이 10억원 이상")
    if roi_method == "subtract" and any(keyword in basis for keyword in RISK_BASIS_KEYWORDS):
        reasons.append("subtract 근거에 전체예산/총사업비/조건성 키워드 포함")
    if amount_type in {"unknown", "support_ratio"}:
        reasons.append(f"max_amount_type={amount_type}")
    if amount_type in {"loan", "guarantee", "non_cash"} and roi_method == "subtract":
        reasons.append(f"{amount_type}인데 subtract")
    if re.search(r"(미기재|확인 필요|찾지 못함|미확인)", basis) and re.search(r"\d", clean_text(row.get("max_amount_actual"))):
        reasons.append("근거는 미확인성인데 actual에는 숫자 금액 존재")
    if "억" in clean_text(row.get("max_amount_actual")) and not re.search(
        r"(기업당|과제당|사업장당|업체당|1개사|개별기업)",
        basis,
    ):
        reasons.append("억 단위 금액이나 기업당/과제당 근거 부족")
    return reasons


def compare_with_new_selection(
    row: dict[str, Any],
    candidates: list[dict[str, Any]],
    selected: dict[str, Any] | None,
) -> list[str]:
    reasons: list[str] = []
    old_amount = numeric_or_none(row.get("max_amount_numeric_manwon") or row.get("max_amount"))
    old_type = clean_text(row.get("max_amount_type")).lower() or "unknown"
    new_amount = numeric_or_none(selected.get("amount_manwon")) if selected else None
    new_type = clean_text(selected.get("max_amount_type")).lower() if selected else None

    if candidates and not selected:
        reasons.append("후보는 있으나 대표 후보 없음")
    if selected and old_type != new_type:
        reasons.append(f"기존 타입 {old_type} -> 새 타입 {new_type}")
    if old_amount is not None and new_amount is None:
        reasons.append("기존 금액은 있으나 새 대표 금액 없음")
    if old_amount is not None and new_amount is not None:
        delta = abs(old_amount - new_amount)
        if delta >= 1 and delta / max(old_amount, 1) >= 0.2:
            reasons.append(f"대표 금액 20% 이상 차이: 기존 {old_amount:g}만원, 새 {new_amount:g}만원")
    return reasons


def update_decision(
    row: dict[str, Any],
    candidates: list[dict[str, Any]],
    selected: dict[str, Any] | None,
    risk_reasons: list[str],
) -> tuple[bool, str]:
    if risk_reasons:
        return False, "risk_reasons_present"
    if not selected:
        return False, "selected_candidate_missing"
    selected_type = clean_text(selected.get("max_amount_type")).lower()
    selected_method = clean_text(selected.get("roi_apply_method")).lower()
    if selected_type not in {"support_amount", "subsidy", "voucher", "loan", "guarantee", "interest_support", "non_cash"}:
        return False, f"selected_type_not_auto_safe:{selected_type or 'none'}"
    if selected_method not in {"subtract", "exclude", "recommend_only"}:
        return False, f"selected_method_not_auto_safe:{selected_method or 'none'}"
    evidence = clean_text(selected.get("local_context") or selected.get("evidence") or selected.get("raw_text"))
    if selected_method == "subtract" and any(keyword in evidence for keyword in RISK_BASIS_KEYWORDS):
        return False, "subtract_selected_evidence_has_excluded_keyword"
    if len(candidates) == 0:
        return False, "candidate_missing"
    return True, "auto_update_candidate"


def review_row(row: dict[str, Any]) -> dict[str, Any]:
    text = source_text(row)
    candidates, selected = amount_utils.normalize_candidate_selection(
        amount_utils.extract_amount_candidates(text)
    )
    derived = amount_utils.derive_policy_amount_fields(selected, candidates)
    base_reasons = risk_reasons(row)
    comparison_reasons = compare_with_new_selection(row, candidates, selected)
    reasons = base_reasons + comparison_reasons
    auto_update, decision_reason = update_decision(row, candidates, selected, reasons)

    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "risk_reasons": reasons,
        "risk_count": len(reasons),
        "auto_update_candidate": auto_update,
        "decision_reason": decision_reason,
        "old_amount_manwon": numeric_or_none(row.get("max_amount_numeric_manwon") or row.get("max_amount")),
        "old_amount_type": row.get("max_amount_type"),
        "old_roi_apply_method": row.get("roi_apply_method"),
        "old_actual": row.get("max_amount_actual"),
        "old_basis": row.get("max_amount_basis_text"),
        "candidate_count": len(candidates),
        "new_selected_amount_manwon": selected.get("amount_manwon") if selected else None,
        "new_selected_type": selected.get("max_amount_type") if selected else None,
        "new_roi_apply_method": selected.get("roi_apply_method") if selected else None,
        "new_support_ratio": derived.get("support_ratio"),
        "new_selected_candidate": selected,
        "new_amount_candidates": candidates,
    }


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "policy_id",
        "title",
        "organization",
        "risk_count",
        "risk_reasons",
        "auto_update_candidate",
        "decision_reason",
        "old_amount_manwon",
        "old_amount_type",
        "old_roi_apply_method",
        "candidate_count",
        "new_selected_amount_manwon",
        "new_selected_type",
        "new_roi_apply_method",
        "new_support_ratio",
        "old_actual",
        "old_basis",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            flat = {field: row.get(field) for field in fields}
            flat["risk_reasons"] = " | ".join(row.get("risk_reasons") or [])
            writer.writerow(flat)


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Dry-run review for existing policy amount backfill candidates. No DB updates."
    )
    parser.add_argument("--table", default=DEFAULT_TABLE)
    parser.add_argument("--limit", type=int, default=0, help="0 means all rows")
    parser.add_argument("--top", type=int, default=50, help="Number of high-risk rows to print")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    rows = fetch_all(supabase, args.table, limit=args.limit)
    reviewed = [review_row(row) for row in rows]
    reviewed.sort(key=lambda row: (row["risk_count"], row["candidate_count"]), reverse=True)
    high_risk = [row for row in reviewed if row["risk_count"] > 0]

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    json_path = output_dir / f"policy_amount_backfill_review_{timestamp}.json"
    csv_path = output_dir / f"policy_amount_backfill_review_{timestamp}.csv"
    write_json(json_path, reviewed)
    write_csv(csv_path, reviewed)

    print(f"table={args.table}")
    print(f"rows={len(rows)}")
    print(f"high_risk_rows={len(high_risk)}")
    print(f"json={json_path}")
    print(f"csv={csv_path}")
    print("\nTop high-risk rows:")
    for row in high_risk[: args.top]:
        print(
            "  "
            f"{row['policy_id']} | risks={row['risk_count']} | "
            f"old={row.get('old_amount_manwon')} {row.get('old_amount_type')} "
            f"{row.get('old_roi_apply_method')} | "
            f"new={row.get('new_selected_amount_manwon')} {row.get('new_selected_type')} "
            f"{row.get('new_roi_apply_method')} | "
            f"{'; '.join(row.get('risk_reasons') or [])}"
        )

    print("\nDRY-RUN only. No database rows were updated.")


if __name__ == "__main__":
    main()
