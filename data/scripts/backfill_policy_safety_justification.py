from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone
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

POLICY_FIELDS = "policy_id,safety_justification_usable"
SAFETY_FIELDS = (
    "policy_id,policy_primary_nature,safety_justification_usable,"
    "safety_justification_strength,recommended_safety_viewpoints,"
    "application_reflection_recommendation,judgment_reason,updated_at"
)
POLICY_UPDATE_FIELDS = (
    "policy_primary_nature",
    "safety_justification_usable",
    "safety_justification_strength",
    "recommended_safety_viewpoints",
    "application_reflection_recommendation",
)


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def fetch_all(supabase: Client, table: str, select: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        batch = supabase.table(table).select(select).range(start, end).execute().data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size
    return rows


def build_payload(safety_row: dict[str, Any]) -> dict[str, Any]:
    payload = {
        field: safety_row.get(field)
        for field in POLICY_UPDATE_FIELDS
        if clean_text(safety_row.get(field))
    }
    reason = clean_text(safety_row.get("judgment_reason"))
    if reason:
        payload["safety_justification_reason"] = reason
    payload["safety_justification_synced_at"] = datetime.now(timezone.utc).isoformat()
    return payload


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill policy safety-justification summary fields from policy_ai_safety_justification."
    )
    parser.add_argument("--apply", action="store_true", help="Actually update policy. Default is dry-run.")
    parser.add_argument("--overwrite", action="store_true", help="Update rows even when policy already has safety fields.")
    parser.add_argument("--batch-size", type=int, default=100)
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    policy_rows = fetch_all(supabase, "policy", POLICY_FIELDS)
    safety_rows = fetch_all(supabase, "policy_ai_safety_justification", SAFETY_FIELDS)

    policy_by_id = {
        clean_text(row.get("policy_id")): row
        for row in policy_rows
        if clean_text(row.get("policy_id"))
    }
    safety_by_id = {
        clean_text(row.get("policy_id")): row
        for row in safety_rows
        if clean_text(row.get("policy_id")) and clean_text(row.get("safety_justification_usable"))
    }

    targets: list[tuple[str, dict[str, Any]]] = []
    for policy_id, policy_row in policy_by_id.items():
        if not args.overwrite and clean_text(policy_row.get("safety_justification_usable")):
            continue
        safety_row = safety_by_id.get(policy_id)
        if not safety_row:
            continue
        payload = build_payload(safety_row)
        if payload:
            targets.append((policy_id, payload))

    blank_count = sum(
        1 for row in policy_rows if not clean_text(row.get("safety_justification_usable"))
    )
    print(
        f"policy_rows={len(policy_rows)} "
        f"policy_blank={blank_count} "
        f"safety_rows={len(safety_rows)} "
        f"backfill_targets={len(targets)} "
        f"overwrite={args.overwrite} "
        f"apply={args.apply}"
    )
    for policy_id, payload in targets[:20]:
        print(
            "  target | "
            f"{policy_id} | "
            f"{payload.get('safety_justification_usable')} | "
            f"{payload.get('application_reflection_recommendation')}"
        )

    if not args.apply:
        print("Dry-run complete. Add --apply to update policy.")
        return

    updated = 0
    for policy_id, payload in targets:
        supabase.table("policy").update(payload).eq("policy_id", policy_id).execute()
        updated += 1
        if updated % args.batch_size == 0 or updated == len(targets):
            print(f"  updated {updated}/{len(targets)}")

    print(f"Done. Updated: {updated}")


if __name__ == "__main__":
    main()
