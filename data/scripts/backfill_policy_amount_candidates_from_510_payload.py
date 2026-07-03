from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

import policy_amount_utils as amount_utils


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
DEFAULT_PAYLOAD_PATH = (
    ROOT
    / "data"
    / "reports"
    / "policy_amount_url_reparse"
    / "support_candidate_payload_510"
    / "policy_amount_510_support_candidate_payload_20260703_141051.json"
)

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

CANDIDATE_FIELDS = [
    "amount_candidates",
    "selected_amount_candidate",
    "support_ratio",
]
DERIVED_EMPTY_ONLY_FIELDS = [
    "max_amount_numeric_manwon",
    "max_amount_actual",
    "max_amount_type",
    "max_amount_type_ko",
]
POLICY_SELECT_FIELDS = [
    "policy_id",
    *CANDIDATE_FIELDS,
    *DERIVED_EMPTY_ONLY_FIELDS,
]
DETAIL_UPDATE_FIELDS = {
    "amount_candidates",
    "selected_amount_candidate",
    "support_ratio",
    "max_amount_numeric_manwon",
    "max_amount_actual",
    "max_amount_type",
    "max_amount_type_ko",
}


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def is_empty(value: Any) -> bool:
    return value is None or value == [] or value == {}


def strip_null_chars(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace("\x00", "")
    if isinstance(value, list):
        return [strip_null_chars(item) for item in value]
    if isinstance(value, dict):
        return {key: strip_null_chars(item) for key, item in value.items()}
    return value


def load_payload(path: Path) -> list[dict[str, Any]]:
    return strip_null_chars(json.loads(path.read_text(encoding="utf-8")))


def fetch_all_policy_rows(supabase: Client) -> dict[str, dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    select = ",".join(POLICY_SELECT_FIELDS)
    while True:
        end = start + batch_size - 1
        response = supabase.table("policy").select(select).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            return {row["policy_id"]: row for row in rows}
        start += batch_size


def normalize_candidate_json(value: Any) -> Any:
    if isinstance(value, list):
        return [normalize_candidate_json(item) for item in value]
    if isinstance(value, dict):
        normalized = dict(value)
        if "support_ratio" in normalized:
            normalized["support_ratio"] = amount_utils.normalize_support_ratio(normalized.get("support_ratio"))
        return strip_null_chars(normalized)
    return strip_null_chars(value)


def build_update(existing: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    update: dict[str, Any] = {}

    payload_candidates = payload.get("amount_candidates")
    if is_empty(existing.get("amount_candidates")) and payload_candidates:
        update["amount_candidates"] = normalize_candidate_json(payload_candidates)

    payload_selected = payload.get("selected_amount_candidate")
    selected_will_apply = False
    if is_empty(existing.get("selected_amount_candidate")) and payload_selected:
        update["selected_amount_candidate"] = normalize_candidate_json(payload_selected)
        selected_will_apply = True

    payload_ratio = amount_utils.normalize_support_ratio(payload.get("support_ratio"))
    if existing.get("support_ratio") is None and payload_ratio is not None:
        update["support_ratio"] = payload_ratio

    if selected_will_apply:
        for field in DERIVED_EMPTY_ONLY_FIELDS:
            if is_empty(existing.get(field)) and not is_empty(payload.get(field)):
                update[field] = payload.get(field)

    return update


def summarize_updates(updates: list[tuple[str, dict[str, Any]]]) -> dict[str, Any]:
    field_counts: dict[str, int] = {}
    for _, update in updates:
        for field in update:
            field_counts[field] = field_counts.get(field, 0) + 1
    return {
        "rows_to_update": len(updates),
        "field_counts": dict(sorted(field_counts.items())),
        "preview": [
            {"policy_id": policy_id, "fields": sorted(update)}
            for policy_id, update in updates[:10]
        ],
    }


def apply_updates(supabase: Client, updates: list[tuple[str, dict[str, Any]]]) -> None:
    for policy_id, update in updates:
        supabase.table("policy").update(update).eq("policy_id", policy_id).execute()
        detail_update = {
            field: value
            for field, value in update.items()
            if field in DETAIL_UPDATE_FIELDS
        }
        if detail_update:
            supabase.table("policy_01_amount_detail").update(detail_update).eq("policy_id", policy_id).execute()


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill empty amount candidate fields from the legacy 510-row payload."
    )
    parser.add_argument("--payload", default=str(DEFAULT_PAYLOAD_PATH))
    parser.add_argument("--apply", action="store_true", help="Actually update DB. Default is dry-run.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    payload_rows = load_payload(Path(args.payload))
    payload_by_id = {
        row.get("policy_id"): row
        for row in payload_rows
        if row.get("policy_id")
    }
    supabase = client()
    existing_by_id = fetch_all_policy_rows(supabase)

    updates: list[tuple[str, dict[str, Any]]] = []
    missing_policy_ids: list[str] = []
    for policy_id, payload in payload_by_id.items():
        existing = existing_by_id.get(policy_id)
        if not existing:
            missing_policy_ids.append(policy_id)
            continue
        update = build_update(existing, payload)
        if update:
            updates.append((policy_id, update))

    if args.apply:
        apply_updates(supabase, updates)

    print(json.dumps({
        "apply": args.apply,
        "payload_rows": len(payload_rows),
        "payload_ids": len(payload_by_id),
        "payload_ids_missing_in_policy": len(missing_policy_ids),
        **summarize_updates(updates),
    }, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
