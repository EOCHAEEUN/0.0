from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from sync_policy_from_validation import amount_type_to_korean, clean_text


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
DEFAULT_TARGET_TABLE = os.getenv("POLICY_SYNC_TARGET_TABLE", "policy").strip()


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


def apply_schema(supabase: Client, table: str, *, apply: bool) -> None:
    sql = f"""
ALTER TABLE public.{table}
ADD COLUMN IF NOT EXISTS max_amount_type_ko text;

NOTIFY pgrst, 'reload schema';
""".strip()
    if not apply:
        print(f"[dry-run] would add {table}.max_amount_type_ko")
        return
    supabase.rpc("execute_sql", {"sql": sql}).execute()
    print("schema_applied=True")


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add and backfill Korean display labels for policy.max_amount_type."
    )
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--apply", action="store_true", help="Actually update DB. Default is dry-run.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    apply_schema(supabase, args.target_table, apply=args.apply)

    rows = fetch_all(
        supabase,
        args.target_table,
        "policy_id,max_amount,max_amount_type,max_amount_type_ko",
    )
    changed = 0
    counts: dict[str, int] = {}

    for row in rows:
        policy_id = clean_text(row.get("policy_id"))
        if not policy_id:
            continue
        label = amount_type_to_korean(row.get("max_amount_type"), row.get("max_amount"))
        counts[label] = counts.get(label, 0) + 1
        if row.get("max_amount_type_ko") == label:
            continue
        changed += 1
        if args.apply:
            (
                supabase.table(args.target_table)
                .update({"max_amount_type_ko": label})
                .eq("policy_id", policy_id)
                .execute()
            )

    print(f"target_rows={len(rows)}")
    print(f"updated={changed if args.apply else 0} would_update={0 if args.apply else changed}")
    print(f"max_amount_type_ko_counts={counts}")


if __name__ == "__main__":
    main()
