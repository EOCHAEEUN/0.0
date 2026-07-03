from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent

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

DEFAULT_FIELDS = [
    "amount_candidates",
    "selected_amount_candidate",
    "support_ratio",
    "max_amount_numeric_manwon",
    "max_amount_actual",
    "max_amount_type",
    "roi_apply_method",
    "roi_apply_method_ko",
    "roi_apply_reason",
    "amount_manual_review_required",
    "amount_manual_review_status",
    "amount_manual_review_category",
    "amount_manual_review_reason",
]


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_all(supabase: Client, table: str, fields: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    select = "policy_id," + ",".join(fields)
    while True:
        end = start + batch_size - 1
        response = supabase.table(table).select(select).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            return rows
        start += batch_size


def same_value(left: Any, right: Any) -> bool:
    return json.dumps(left, sort_keys=True, ensure_ascii=False, default=str) == json.dumps(
        right,
        sort_keys=True,
        ensure_ascii=False,
        default=str,
    )


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only audit for policy/detail amount field sync.")
    parser.add_argument("--field", action="append", help="Field to compare. Repeatable.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    fields = args.field or DEFAULT_FIELDS
    supabase = client()
    policy_rows = fetch_all(supabase, "policy", fields)
    detail_rows = fetch_all(supabase, "policy_01_amount_detail", fields)
    detail_by_id = {row["policy_id"]: row for row in detail_rows}

    counts = {field: 0 for field in fields}
    samples: dict[str, Any] = {}
    mismatch_policy_ids = set()
    missing_detail = []

    for policy in policy_rows:
        policy_id = policy["policy_id"]
        detail = detail_by_id.get(policy_id)
        if not detail:
            missing_detail.append(policy_id)
            continue
        for field in fields:
            if not same_value(policy.get(field), detail.get(field)):
                counts[field] += 1
                mismatch_policy_ids.add(policy_id)
                samples.setdefault(
                    field,
                    {
                        "policy_id": policy_id,
                        "policy": policy.get(field),
                        "detail": detail.get(field),
                    },
                )

    print(json.dumps({
        "policy_rows": len(policy_rows),
        "detail_rows": len(detail_rows),
        "missing_detail_rows": len(missing_detail),
        "mismatch_rows": len(mismatch_policy_ids),
        "mismatch_by_field": counts,
        "samples": samples,
    }, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
