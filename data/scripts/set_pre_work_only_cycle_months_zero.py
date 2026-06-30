"""Set cycle_months=0 for pre-work-only safety legal rules."""

from __future__ import annotations

import json
import os
import time
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


def main() -> None:
    load_dotenv(Path("backend/.env"))
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    sql = Path("database/migrations/20260626_set_pre_work_only_cycle_months_zero.sql").read_text(
        encoding="utf-8"
    )
    supabase.rpc("execute_sql", {"sql": f"{sql}\nNOTIFY pgrst, 'reload schema';"}).execute()
    time.sleep(1)

    rows = (
        supabase.table("safety_rule_legal")
        .select("rule_id,inspection_type,cycle_months,pre_work_check_required,evidence_text")
        .order("rule_id")
        .execute()
        .data
        or []
    )
    zero_rows = [row for row in rows if row.get("cycle_months") == 0]

    print(f"rows={len(rows)}")
    print("cycle_counts=" + json.dumps(Counter(row.get("cycle_months") for row in rows), ensure_ascii=False))
    print(f"zero_count={len(zero_rows)}")
    print(json.dumps(zero_rows, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
