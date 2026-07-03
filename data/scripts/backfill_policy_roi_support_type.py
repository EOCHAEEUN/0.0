from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from sync_policy_from_validation import (
    amount_type_to_korean,
    build_max_amount_basis_text,
    build_max_amount_type_reason,
    classify_roi_apply_method,
    classify_roi_support,
    clean_text,
    contains_excluded_support_method,
    normalize_amount_status,
    normalize_amount_type_key,
    numeric_or_none,
)


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

DEFAULT_SOURCE_TABLE = os.getenv("POLICY_VALIDATION_TARGET_TABLE", "policy_validation_new").strip()
DEFAULT_TARGET_TABLE = os.getenv("POLICY_SYNC_TARGET_TABLE", "policy").strip()
NON_CASH_TYPES = {"loan", "guarantee", "investment", "tax", "non_cash"}


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_all(supabase: Client, table: str, select: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = supabase.table(table).select(select).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size
    return rows


def apply_schema(supabase: Client, *, apply: bool) -> None:
    sql = """
ALTER TABLE public.policy
ADD COLUMN IF NOT EXISTS roi_support_type text,
ADD COLUMN IF NOT EXISTS roi_support_reason text,
ADD COLUMN IF NOT EXISTS roi_support_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS roi_apply_method text,
ADD COLUMN IF NOT EXISTS roi_apply_method_ko text,
ADD COLUMN IF NOT EXISTS roi_apply_reason text,
ADD COLUMN IF NOT EXISTS max_amount_type_ko text,
ADD COLUMN IF NOT EXISTS max_amount_basis_text text,
ADD COLUMN IF NOT EXISTS max_amount_type_reason text;

CREATE INDEX IF NOT EXISTS idx_policy_roi_support_type
ON public.policy (roi_support_type);

CREATE INDEX IF NOT EXISTS idx_policy_roi_apply_method
ON public.policy (roi_apply_method);

NOTIFY pgrst, 'reload schema';
""".strip()
    if not apply:
        print("[dry-run] would apply schema for policy.roi_support_type fields")
        return
    supabase.rpc("execute_sql", {"sql": sql}).execute()
    print("schema_applied=True")


def build_backfill_payload(source: dict[str, Any], existing: dict[str, Any]) -> dict[str, Any]:
    amount_type = normalize_amount_type_key(source.get("max_amount_type"))
    is_non_cash = (
        amount_type in NON_CASH_TYPES
        or contains_excluded_support_method(source.get("support_method"))
    )
    amount = None if is_non_cash else numeric_or_none(source.get("max_amount_numeric_manwon"))
    roi_support_type, roi_support_reason = classify_roi_support(
        max_amount=amount,
        max_amount_type=amount_type,
        support_method=source.get("support_method"),
        is_non_cash=is_non_cash,
    )
    roi_apply_method, roi_apply_method_ko, roi_apply_reason = classify_roi_apply_method(
        max_amount=amount,
        max_amount_type=amount_type,
        roi_support_type=roi_support_type,
        support_method=source.get("support_method") or existing.get("support_method"),
        is_non_cash=is_non_cash,
    )

    payload: dict[str, Any] = {
        "max_amount": amount,
        "max_amount_type": amount_type or source.get("max_amount_type"),
        "max_amount_type_ko": amount_type_to_korean(
            amount_type or source.get("max_amount_type"),
            amount,
        ),
        "max_amount_type_reason": build_max_amount_type_reason(
            {
                "max_amount_evidence": source.get("max_amount_evidence"),
                "max_amount_note": source.get("max_amount_note") or existing.get("max_amount_note"),
                "support_method": source.get("support_method") or existing.get("support_method"),
            },
            amount_type=amount_type or source.get("max_amount_type"),
            amount=amount,
        ),
        "max_amount_status": source.get("max_amount_status"),
        "max_amount_numeric_manwon": amount,
        "max_amount_actual": None if is_non_cash else source.get("max_amount_actual"),
        "max_amount_note": source.get("max_amount_note") or existing.get("max_amount_note"),
        "max_amount_evidence": source.get("max_amount_evidence"),
        "max_amount_basis_text": build_max_amount_basis_text(
            {
                "max_amount_evidence": source.get("max_amount_evidence"),
                "max_amount_note": source.get("max_amount_note") or existing.get("max_amount_note"),
                "support_method": source.get("support_method") or existing.get("support_method"),
            }
        ),
        "amount_extraction_status": normalize_amount_status(source.get("max_amount_status"), amount),
        "support_method": source.get("support_method") or existing.get("support_method"),
        "roi_support_type": roi_support_type,
        "roi_support_reason": roi_support_reason,
        "roi_apply_method": roi_apply_method,
        "roi_apply_method_ko": roi_apply_method_ko,
        "roi_apply_reason": roi_apply_reason,
        "roi_support_synced_at": datetime.now(timezone.utc).isoformat(),
    }
    return {key: value for key, value in payload.items() if value is not None}


def build_existing_payload(existing: dict[str, Any]) -> dict[str, Any]:
    amount = numeric_or_none(existing.get("max_amount"))
    amount_type = normalize_amount_type_key(existing.get("max_amount_type"))
    is_non_cash = (
        amount_type in NON_CASH_TYPES
        or contains_excluded_support_method(existing.get("support_method"))
    )
    roi_support_type, roi_support_reason = classify_roi_support(
        max_amount=amount,
        max_amount_type=amount_type,
        support_method=existing.get("support_method"),
        is_non_cash=is_non_cash,
    )
    roi_apply_method, roi_apply_method_ko, roi_apply_reason = classify_roi_apply_method(
        max_amount=amount,
        max_amount_type=amount_type,
        roi_support_type=roi_support_type,
        support_method=existing.get("support_method"),
        is_non_cash=is_non_cash,
    )
    return {
        "max_amount_type_ko": amount_type_to_korean(
            amount_type or existing.get("max_amount_type"),
            amount,
        ),
        "max_amount_basis_text": build_max_amount_basis_text(existing),
        "max_amount_type_reason": build_max_amount_type_reason(
            existing,
            amount_type=amount_type or existing.get("max_amount_type"),
            amount=amount,
        ),
        "roi_support_type": roi_support_type,
        "roi_support_reason": roi_support_reason,
        "roi_apply_method": roi_apply_method,
        "roi_apply_method_ko": roi_apply_method_ko,
        "roi_apply_reason": roi_apply_reason,
        "roi_support_synced_at": datetime.now(timezone.utc).isoformat(),
    }


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill policy amount-type fields and Korean ROI support classification."
    )
    parser.add_argument("--source-table", default=DEFAULT_SOURCE_TABLE)
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--apply", action="store_true", help="Actually update policy. Default is dry-run.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    apply_schema(supabase, apply=args.apply)

    policy_rows = fetch_all(
        supabase,
        args.target_table,
        "policy_id,max_amount,max_amount_type,max_amount_type_ko,max_amount_status,max_amount_numeric_manwon,"
        "max_amount_actual,max_amount_note,max_amount_evidence,amount_extraction_status,"
        "support_method,max_amount_basis_text,max_amount_type_reason,roi_support_type,"
        "roi_apply_method,roi_apply_method_ko,roi_apply_reason",
    )
    validation_rows = fetch_all(
        supabase,
        args.source_table,
        "policy_id,max_amount_type,max_amount_status,max_amount_numeric_manwon,"
        "max_amount_actual,max_amount_note,max_amount_evidence,support_method",
    )
    validation_by_policy_id = {
        clean_text(row.get("policy_id")): row
        for row in validation_rows
        if clean_text(row.get("policy_id"))
    }

    changed = 0
    missing_source = 0
    counts: dict[str, int] = {}

    for row in policy_rows:
        policy_id = clean_text(row.get("policy_id"))
        source = validation_by_policy_id.get(policy_id)
        if source:
            payload = build_backfill_payload(source, row)
        else:
            missing_source += 1
            payload = build_existing_payload(row)

        counts[payload["roi_support_type"]] = counts.get(payload["roi_support_type"], 0) + 1
        changed += 1
        if args.apply:
            supabase.table(args.target_table).update(payload).eq("policy_id", policy_id).execute()

    print(f"target_rows={len(policy_rows)} source_rows={len(validation_rows)}")
    print(f"updated={changed if args.apply else 0} would_update={0 if args.apply else changed}")
    print(f"missing_source={missing_source}")
    print(f"classification_counts={counts}")


if __name__ == "__main__":
    main()
