from __future__ import annotations

import argparse
import os
import re
from typing import Any

from supabase import create_client

import hwp_attachment_pipeline_common as common
import policy_deadline_normalization as deadline_norm


DESIRED_COLUMNS = [
    "policy_id",
    "deadline",
    "deadline_display",
    "deadline_note",
    "deadline_type",
    "deadline_status",
    "deadline_raw_text",
    "deadline_evidence",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize non-date deadline_note values.")
    parser.add_argument("--target-table", default="policy")
    parser.add_argument("--dry-run", type=int, choices=[0, 1], default=1)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    return parser.parse_args()


def supabase_client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    return create_client(url, key)


def table_columns(client, table_name: str) -> set[str]:
    rows = client.table(table_name).select("*").limit(1).execute().data or []
    return set(rows[0].keys()) if rows else {"policy_id"}


def fetch_rows(client, table_name: str, columns: set[str], limit: int) -> list[dict[str, Any]]:
    select_columns = ",".join(column for column in DESIRED_COLUMNS if column in columns)
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        page = (
            client.table(table_name)
            .select(select_columns)
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        rows.extend(page)
        if len(page) < page_size or (limit and len(rows) >= limit):
            break
        offset += page_size
    return rows[:limit] if limit else rows


def normalized_note_for_update(row: dict[str, Any]) -> str:
    deadline_type = deadline_norm.classify_deadline_note(
        row.get("deadline_type"),
        row.get("deadline_status"),
        row.get("deadline_display"),
        row.get("deadline_note"),
        row.get("deadline_raw_text"),
        row.get("deadline_evidence"),
    )
    if not deadline_type:
        return ""
    date_text = " ".join(
        str(row.get(key) or "")
        for key in ["deadline", "deadline_display", "deadline_note"]
    )
    has_date = bool(re.search(r"20\d{2}[-./]\d{1,2}[-./]\d{1,2}", date_text))
    if has_date and deadline_type == "unknown":
        return common.clean_text(row.get("deadline_display") or row.get("deadline_note"))
    return deadline_norm.CANONICAL_DEADLINE_NOTES[deadline_type]


def main() -> None:
    args = parse_args()
    dry_run = bool(args.dry_run) and not args.apply
    client = supabase_client()
    columns = table_columns(client, args.target_table)
    if "deadline_note" not in columns:
        raise RuntimeError(f"{args.target_table}.deadline_note does not exist.")

    rows = fetch_rows(client, args.target_table, columns, args.limit)
    changed = 0
    for row in rows:
        policy_id = common.clean_text(row.get("policy_id"))
        old_note = common.clean_text(row.get("deadline_note"))
        new_note = normalized_note_for_update(row)
        if not policy_id or not new_note or old_note == new_note:
            continue
        changed += 1
        print(f"{policy_id} | {old_note or '-'} -> {new_note}")
        if not dry_run:
            client.table(args.target_table).update({"deadline_note": new_note}).eq("policy_id", policy_id).execute()

    print(f"processed={len(rows)} changed={changed} dry_run={dry_run}")


if __name__ == "__main__":
    main()
