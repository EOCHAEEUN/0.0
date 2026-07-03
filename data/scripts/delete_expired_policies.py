from __future__ import annotations

import argparse
import os
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


SCRIPT_DIR = Path(__file__).resolve().parent

for env_path in [
    Path.cwd() / ".env",
    SCRIPT_DIR / ".env",
    SCRIPT_DIR.parent / ".env",
    SCRIPT_DIR.parent.parent / ".env",
    SCRIPT_DIR.parent.parent / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


DEFAULT_TABLES = [
    "policy",
    "policy_external_collected",
    "policy_validation_new",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete policies whose non-null deadline is before the cutoff date."
    )
    parser.add_argument("--cutoff", default=date.today().isoformat())
    parser.add_argument("--table", action="append", default=[])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--batch-size", type=int, default=100)
    return parser.parse_args()


def supabase_client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    return create_client(url, key)


def parse_deadline(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def fetch_expired_rows(client, table: str, cutoff: date) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        page = (
            client.table(table)
            .select("policy_id,title,deadline")
            .not_.is_("deadline", "null")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        for row in page:
            deadline = parse_deadline(row.get("deadline"))
            if deadline and deadline < cutoff:
                rows.append(row)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def delete_rows(client, table: str, rows: list[dict[str, Any]], batch_size: int) -> int:
    deleted = 0
    policy_ids = [str(row.get("policy_id") or "").strip() for row in rows]
    policy_ids = [policy_id for policy_id in policy_ids if policy_id]
    for start in range(0, len(policy_ids), batch_size):
        batch = policy_ids[start : start + batch_size]
        if not batch:
            continue
        client.table(table).delete().in_("policy_id", batch).execute()
        deleted += len(batch)
    return deleted


def main() -> None:
    args = parse_args()
    cutoff = date.fromisoformat(args.cutoff)
    tables = args.table or DEFAULT_TABLES
    client = supabase_client()

    print(f"cutoff={cutoff.isoformat()} apply={args.apply}")
    total = 0
    for table in tables:
        rows = fetch_expired_rows(client, table, cutoff)
        total += len(rows)
        print(f"{table}: expired={len(rows)}")
        for row in rows[:5]:
            print(
                "  preview | "
                f"{row.get('policy_id')} | "
                f"deadline={row.get('deadline')} | "
                f"title={str(row.get('title') or '')[:80]}"
            )
        if args.apply and rows:
            deleted = delete_rows(client, table, rows, args.batch_size)
            print(f"{table}: deleted={deleted}")
    print(f"total_expired={total}")


if __name__ == "__main__":
    main()
