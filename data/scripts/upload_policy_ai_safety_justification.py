"""Upload Gemini safety-justification CSV into Supabase.

Writes:
  - creates/backfills public.policy_ai_safety_justification
  - updates summary columns on public.policy

Run:
  python data/scripts/upload_policy_ai_safety_justification.py
"""

from __future__ import annotations

import argparse
import csv
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


CSV_PATH = Path("reports/policy_ai_safety_justification_classification.csv")
MIGRATION_PATH = Path("database/migrations/20260627_add_policy_ai_safety_justification.sql")
BATCH_SIZE = 100


CSV_TO_DB = {
    "policy_id": "policy_id",
    "policy_title": "policy_title",
    "policy_organization": "policy_organization",
    "정책_주성격": "policy_primary_nature",
    "정책_보조성격": "policy_secondary_natures",
    "안전개선문장_사용가능여부": "safety_justification_usable",
    "안전개선문장_사용강도": "safety_justification_strength",
    "추천_안전개선관점": "recommended_safety_viewpoints",
    "신청서_반영_추천여부": "application_reflection_recommendation",
    "판단근거": "judgment_reason",
    "부적합사유": "not_suitable_reason",
    "근거키워드": "evidence_keywords",
}

POLICY_SUMMARY_FIELDS = [
    "policy_primary_nature",
    "safety_justification_usable",
    "safety_justification_strength",
    "recommended_safety_viewpoints",
    "application_reflection_recommendation",
]


def load_env() -> None:
    for env_path in [Path(".env"), Path("backend/.env")]:
        if env_path.exists():
            load_dotenv(env_path)


def create_supabase_client():
    load_env()
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or ""
    ).strip()
    if not url:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing.")
    return create_client(url, key)


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def convert_row(row: dict[str, str], source_csv_path: Path) -> dict[str, Any]:
    converted = {
        db_field: (row.get(csv_field) or "").strip()
        for csv_field, db_field in CSV_TO_DB.items()
    }
    converted["source_csv_path"] = str(source_csv_path).replace("\\", "/")
    converted["updated_at"] = datetime.now(timezone.utc).isoformat()
    return converted


def chunked(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[index : index + size] for index in range(0, len(rows), size)]


def apply_migration(supabase) -> None:
    sql = MIGRATION_PATH.read_text(encoding="utf-8")
    supabase.rpc("execute_sql", {"sql": sql}).execute()
    time.sleep(2)


def upsert_analysis_rows(supabase, rows: list[dict[str, Any]]) -> None:
    for batch in chunked(rows, BATCH_SIZE):
        supabase.table("policy_ai_safety_justification").upsert(
            batch,
            on_conflict="policy_id",
        ).execute()


def update_policy_summary_rows(supabase, rows: list[dict[str, Any]]) -> int:
    updated = 0
    for row in rows:
        policy_id = row.get("policy_id")
        if not policy_id:
            continue
        payload = {
            field: row.get(field)
            for field in POLICY_SUMMARY_FIELDS
        }
        payload["safety_justification_reason"] = row.get("judgment_reason")
        payload["safety_justification_synced_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("policy").update(payload).eq("policy_id", policy_id).execute()
        updated += 1
    return updated


def verify_counts(supabase) -> dict[str, Any]:
    analysis_rows = (
        supabase.table("policy_ai_safety_justification")
        .select("policy_id", count="exact")
        .limit(1)
        .execute()
    )
    policy_summary_rows = (
        supabase.table("policy")
        .select("policy_id", count="exact")
        .not_.is_("safety_justification_usable", "null")
        .execute()
    )
    return {
        "analysis_table_rows": analysis_rows.count,
        "policy_summary_rows": policy_summary_rows.count,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload policy AI safety justification CSV to Supabase.")
    parser.add_argument("--csv", default=str(CSV_PATH), help="CSV path to upload.")
    parser.add_argument("--dry-run", action="store_true", help="Read and map CSV without DB writes.")
    parser.add_argument("--skip-migration", action="store_true", help="Do not run schema migration.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    csv_path = Path(args.csv)
    csv_rows = read_csv_rows(csv_path)
    mapped_rows = [convert_row(row, csv_path) for row in csv_rows]
    print(f"csv_rows={len(csv_rows)}")
    print(f"mapped_rows={len(mapped_rows)}")
    print("target_table=policy_ai_safety_justification")
    print("policy_summary_columns=" + ",".join(POLICY_SUMMARY_FIELDS))

    if args.dry_run:
        print("dry_run=true")
        for row in mapped_rows[:3]:
            print(row)
        return

    supabase = create_supabase_client()
    if not args.skip_migration:
        apply_migration(supabase)
        print("migration_applied=true")

    upsert_analysis_rows(supabase, mapped_rows)
    print(f"analysis_upserted={len(mapped_rows)}")

    updated_count = update_policy_summary_rows(supabase, mapped_rows)
    print(f"policy_summary_updates_attempted={updated_count}")

    verification = verify_counts(supabase)
    print(f"analysis_table_rows={verification['analysis_table_rows']}")
    print(f"policy_summary_rows={verification['policy_summary_rows']}")


if __name__ == "__main__":
    main()
