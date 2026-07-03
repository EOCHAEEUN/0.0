"""Add and backfill practical compliance proof columns for safety_rule_legal."""

from __future__ import annotations

import json
import os
import time
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


FIELDS = [
    "enforcement_trigger_type",
    "enforcement_trigger_type_label",
    "enforcement_trigger_label",
    "required_compliance_action",
    "proof_method",
    "submission_timing",
    "avoid_penalty_note",
]


def main() -> None:
    load_dotenv(Path("backend/.env"))
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    sql = Path("database/migrations/20260626_add_safety_rule_legal_compliance_proof.sql").read_text(
        encoding="utf-8"
    )
    supabase.rpc("execute_sql", {"sql": f"{sql}\nNOTIFY pgrst, 'reload schema';"}).execute()
    time.sleep(2)

    rows = (
        supabase.table("safety_rule_legal")
        .select(
            "rule_id,inspection_type,legal_check_group,enforcement_trigger_type,"
            "enforcement_trigger_type_label,enforcement_trigger_label,"
            "required_compliance_action,proof_method,"
            "submission_timing,avoid_penalty_note"
        )
        .order("rule_id")
        .execute()
        .data
        or []
    )
    missing = [row for row in rows if any(not row.get(field) for field in FIELDS)]

    print(f"rows={len(rows)}")
    print(f"missing={len(missing)}")
    print(
        "trigger_counts="
        + json.dumps(Counter(row["enforcement_trigger_type"] for row in rows), ensure_ascii=False)
    )
    print(
        "label_counts="
        + json.dumps(Counter(row["enforcement_trigger_label"] for row in rows), ensure_ascii=False)
    )
    for row in rows[:8]:
        print(json.dumps(row, ensure_ascii=False))


if __name__ == "__main__":
    main()
