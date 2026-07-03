from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQL_DIR = (
    ROOT
    / "data"
    / "reports"
    / "policy_amount_url_reparse"
    / "keep_old_amount_review"
)


for env_path in [Path.cwd() / ".env", ROOT / ".env", ROOT / "backend" / ".env"]:
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply keep-old amount review markers.")
    parser.add_argument("--sql", default="")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.sql:
        sql_path = Path(args.sql)
    else:
        candidates = sorted(DEFAULT_SQL_DIR.glob("keep_old_amount_review_update_*.sql"))
        if not candidates:
            raise FileNotFoundError(f"No keep-old SQL found under {DEFAULT_SQL_DIR}")
        sql_path = candidates[-1]
    sql = sql_path.read_text(encoding="utf-8").strip() + "\n\nNOTIFY pgrst, 'reload schema';"
    print(f"sql={sql_path}")
    print(f"sql_chars={len(sql)}")
    if not args.apply:
        print("dry_run=true")
        print("would_mark_keep_old_amount_rows=true")
        return
    client().rpc("execute_sql", {"sql": sql}).execute()
    print("dry_run=false")
    print("keep_old_amount_rows_marked=true")


if __name__ == "__main__":
    main()
