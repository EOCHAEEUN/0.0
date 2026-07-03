from __future__ import annotations

import argparse
import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

import policy_amount_utils as amount_utils


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

TABLES = ["policy", "policy_01_amount_detail"]
SELECT_FIELDS = (
    "policy_id,support_ratio,amount_candidates,"
    "selected_amount_candidate,support_items"
)


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_all(supabase: Client, table: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = supabase.table(table).select(SELECT_FIELDS).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            return rows
        start += batch_size


def normalize_json_value(value: Any) -> tuple[Any, bool]:
    if isinstance(value, list):
        changed = False
        normalized_items = []
        for item in value:
            normalized_item, item_changed = normalize_json_value(item)
            normalized_items.append(normalized_item)
            changed = changed or item_changed
        return normalized_items, changed

    if isinstance(value, dict):
        normalized = deepcopy(value)
        changed = False
        if "support_ratio" in normalized:
            old_ratio = normalized.get("support_ratio")
            new_ratio = amount_utils.normalize_support_ratio(old_ratio)
            if new_ratio != old_ratio:
                normalized["support_ratio"] = new_ratio
                changed = True
        for key, item in list(normalized.items()):
            if key == "support_ratio":
                continue
            normalized_item, item_changed = normalize_json_value(item)
            if item_changed:
                normalized[key] = normalized_item
                changed = True
        return normalized, changed

    return value, False


def build_update(row: dict[str, Any]) -> dict[str, Any]:
    update: dict[str, Any] = {}

    old_ratio = row.get("support_ratio")
    new_ratio = amount_utils.normalize_support_ratio(old_ratio)
    if new_ratio != old_ratio:
        update["support_ratio"] = new_ratio

    for field in ["amount_candidates", "selected_amount_candidate", "support_items"]:
        normalized, changed = normalize_json_value(row.get(field))
        if changed:
            update[field] = normalized

    return update


def count_out_of_range(rows: list[dict[str, Any]]) -> int:
    total = 0
    for row in rows:
        ratio = row.get("support_ratio")
        try:
            numeric = float(ratio)
        except (TypeError, ValueError):
            continue
        if numeric < 0 or numeric > 1:
            total += 1
    return total


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize support_ratio values in policy amount fields to the 0..1 scale."
    )
    parser.add_argument("--apply", action="store_true", help="Actually update DB. Default is dry-run.")
    parser.add_argument("--table", choices=TABLES, action="append", help="Limit to one table. Repeatable.")
    parser.add_argument("--limit", type=int, default=0, help="Limit rows updated per table.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    tables = args.table or TABLES
    summary: dict[str, Any] = {}

    for table in tables:
        rows = fetch_all(supabase, table)
        updates: list[tuple[str, dict[str, Any]]] = []
        for row in rows:
            policy_id = row.get("policy_id")
            if not policy_id:
                continue
            update = build_update(row)
            if update:
                updates.append((policy_id, update))
        if args.limit:
            updates = updates[: args.limit]

        summary[table] = {
            "rows": len(rows),
            "support_ratio_out_of_range_before": count_out_of_range(rows),
            "rows_to_update": len(updates),
            "preview": [
                {"policy_id": policy_id, "fields": sorted(update)}
                for policy_id, update in updates[:5]
            ],
        }

        if args.apply:
            for policy_id, update in updates:
                supabase.table(table).update(update).eq("policy_id", policy_id).execute()

            refreshed = fetch_all(supabase, table)
            summary[table]["support_ratio_out_of_range_after"] = count_out_of_range(refreshed)

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
