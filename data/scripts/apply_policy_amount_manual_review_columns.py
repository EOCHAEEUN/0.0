from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[2]
MIGRATION_SQL = ROOT / "database" / "migrations" / "20260703_add_policy_amount_manual_review_columns.sql"
DEFAULT_UPDATE_SQL = (
    ROOT
    / "data"
    / "reports"
    / "policy_amount_url_reparse"
    / "support_candidate_payload_510"
    / "policy_amount_manual_review_category_update_20260703_135023.sql"
)


for env_path in [
    Path.cwd() / ".env",
    ROOT / ".env",
    ROOT / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


def client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not url:
        raise RuntimeError("SUPABASE_URL is missing from .env files.")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(url, key)


def read_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply manual review columns and category updates for policy amount audit."
    )
    parser.add_argument("--migration-sql", default=str(MIGRATION_SQL))
    parser.add_argument("--update-sql", default=str(DEFAULT_UPDATE_SQL))
    parser.add_argument("--apply", action="store_true", help="Actually execute SQL through execute_sql RPC.")
    args = parser.parse_args()

    migration_path = Path(args.migration_sql)
    update_path = Path(args.update_sql)
    migration_sql = read_sql(migration_path)
    update_sql = read_sql(update_path)
    combined_sql = f"{migration_sql}\n\n{update_sql}\n\nNOTIFY pgrst, 'reload schema';"

    print(f"migration_sql={migration_path}")
    print(f"update_sql={update_path}")
    print(f"combined_sql_chars={len(combined_sql)}")
    if not args.apply:
        print("dry_run=true")
        print("would_apply_manual_review_columns=true")
        print("would_update_manual_review_categories=true")
        return

    client().rpc("execute_sql", {"sql": combined_sql}).execute()
    print("dry_run=false")
    print("manual_review_columns_applied=true")
    print("manual_review_categories_updated=true")


if __name__ == "__main__":
    main()
