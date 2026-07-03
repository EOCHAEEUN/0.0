from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


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

FINANCE_AMOUNT_TYPES = {"loan", "guarantee"}
FINANCE_EXCLUSION_KEYWORDS = (
    "융자",
    "대출",
    "특례보증",
    "신용보증",
    "기업보증",
    "기술보증",
    "보증연계",
    "보증서",
    "이차보전",
    "수출보험",
    "금융지원",
    "정책자금",
    "경영안정자금",
    "육성자금",
    "협력자금",
)
SELECT_FIELDS = (
    "policy_id,title,max_amount_type,roi_support_type,max_amount_note,"
    "max_amount_evidence,support_method,summary"
)


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def fetch_all(supabase: Client, table: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        batch = supabase.table(table).select(SELECT_FIELDS).range(start, end).execute().data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size
    return rows


def finance_reason(row: dict[str, Any]) -> str | None:
    amount_type = clean_text(row.get("max_amount_type")).lower()
    text = " ".join(
        clean_text(row.get(field))
        for field in [
            "title",
            "summary",
            "max_amount_note",
            "max_amount_evidence",
            "support_method",
        ]
    )
    for keyword in FINANCE_EXCLUSION_KEYWORDS:
        if keyword in text:
            if amount_type in FINANCE_AMOUNT_TYPES:
                return f"max_amount_type={amount_type}, keyword={keyword}"
            return f"keyword={keyword}"
    return None


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove loan/guarantee/finance-style rows from policy."
    )
    parser.add_argument("--apply", action="store_true", help="Actually delete. Default is dry-run.")
    parser.add_argument("--batch-size", type=int, default=100)
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    rows = fetch_all(supabase, "policy")
    targets = [
        {**row, "finance_remove_reason": reason}
        for row in rows
        if (reason := finance_reason(row))
    ]

    print(f"policy_rows={len(rows)} finance_remove_targets={len(targets)} apply={args.apply}")
    for row in targets[:30]:
        print(
            "  target | "
            f"{row.get('policy_id')} | "
            f"{row.get('roi_support_type')} | "
            f"{row.get('max_amount_type')} | "
            f"{row.get('finance_remove_reason')} | "
            f"{clean_text(row.get('title'))}"
        )

    if not args.apply:
        print("Dry-run complete. Add --apply to delete these rows from policy.")
        return

    deleted = 0
    target_ids = [clean_text(row.get("policy_id")) for row in targets if clean_text(row.get("policy_id"))]
    for start in range(0, len(target_ids), args.batch_size):
        batch = target_ids[start:start + args.batch_size]
        if not batch:
            continue
        supabase.table("policy").delete().in_("policy_id", batch).execute()
        deleted += len(batch)
        print(f"  deleted {deleted}/{len(target_ids)}")

    print(f"Done. Deleted: {deleted}")


if __name__ == "__main__":
    main()
