from __future__ import annotations

import argparse
import os
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


SCRIPT_DIR = Path(__file__).resolve().parent

for env_path in [
    Path.cwd() / ".env",
    SCRIPT_DIR / ".env",
    SCRIPT_DIR.parent / ".env",
    SCRIPT_DIR.parent.parent / ".env",
    SCRIPT_DIR.parent.parent / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete expired policy rows through the execute_sql RPC."
    )
    parser.add_argument("--cutoff", default=date.today().isoformat())
    parser.add_argument("--table", action="append", default=[])
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    return create_client(url, key)


def main() -> None:
    args = parse_args()
    cutoff = date.fromisoformat(args.cutoff).isoformat()
    tables = args.table or [
        "policy_validation_new",
        "policy_external_collected",
    ]
    statements: list[str] = []
    for table in tables:
        if table not in {"policy_validation_new", "policy_external_collected", "policy"}:
            raise ValueError(f"Unsupported table for SQL cleanup: {table}")
        expired_where = (
            "deadline IS NOT NULL "
            "AND deadline::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' "
            f"AND substring(deadline::text from 1 for 10)::date < DATE '{cutoff}'"
        )
        if table == "policy":
            statements.append(
                f"""
                CREATE TEMP TABLE IF NOT EXISTS expired_policy_ids_for_cleanup (
                    policy_id text PRIMARY KEY
                ) ON COMMIT DROP;

                TRUNCATE expired_policy_ids_for_cleanup;

                INSERT INTO expired_policy_ids_for_cleanup (policy_id)
                SELECT policy_id
                FROM public.policy
                WHERE {expired_where}
                ON CONFLICT DO NOTHING;

                DO $$
                DECLARE
                    ref record;
                BEGIN
                    FOR ref IN
                        SELECT kcu.table_schema, kcu.table_name, kcu.column_name
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu
                          ON tc.constraint_name = kcu.constraint_name
                         AND tc.table_schema = kcu.table_schema
                        JOIN information_schema.constraint_column_usage ccu
                          ON ccu.constraint_name = tc.constraint_name
                         AND ccu.table_schema = tc.table_schema
                        WHERE tc.constraint_type = 'FOREIGN KEY'
                          AND ccu.table_schema = 'public'
                          AND ccu.table_name = 'policy'
                          AND ccu.column_name = 'policy_id'
                    LOOP
                        EXECUTE format(
                            'DELETE FROM %I.%I WHERE %I IN (SELECT policy_id FROM expired_policy_ids_for_cleanup)',
                            ref.table_schema,
                            ref.table_name,
                            ref.column_name
                        );
                    END LOOP;
                END $$;

                DELETE FROM public.policy
                WHERE policy_id IN (SELECT policy_id FROM expired_policy_ids_for_cleanup);
                """
            )
        else:
            statements.append(
                f"""
                DELETE FROM public.{table}
                WHERE {expired_where};
                """
            )

    sql = "\n".join(statements)
    print(f"cutoff={cutoff} apply={args.apply} tables={','.join(tables)}")
    if not args.apply:
        print(sql)
        return
    result = client().rpc("execute_sql", {"sql": sql}).execute()
    print(result.data)


if __name__ == "__main__":
    main()
