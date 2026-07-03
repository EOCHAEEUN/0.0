from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[2]
SQL_PATH = ROOT / "data" / "seed" / "add_policy_attachment_text_columns.sql"


def main() -> None:
    load_dotenv(ROOT / "backend" / ".env")
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_SERVICE_KEY"]
    sql = SQL_PATH.read_text(encoding="utf-8")
    sql = f"{sql}\nNOTIFY pgrst, 'reload schema';"
    create_client(url, key).rpc("execute_sql", {"sql": sql}).execute()
    print("applied_attachment_text_columns_to_policy")


if __name__ == "__main__":
    main()
