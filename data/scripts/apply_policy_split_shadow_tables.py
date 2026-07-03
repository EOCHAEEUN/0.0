from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[2]
SQL_PATH = ROOT / "database" / "migrations" / "20260702_create_policy_split_shadow_tables.sql"


def main() -> None:
    load_dotenv(ROOT / "backend" / ".env")
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_SERVICE_KEY"]
    sql = SQL_PATH.read_text(encoding="utf-8")
    create_client(url, key).rpc("execute_sql", {"sql": sql}).execute()
    print("applied_policy_split_shadow_tables")


if __name__ == "__main__":
    main()
