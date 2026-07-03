"""Grant API roles access to safety preview tables."""

from __future__ import annotations

import os
import time
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


def main() -> None:
    load_dotenv(Path("backend/.env"))
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    sql = """
ALTER TABLE public.safety_viewer_policy
ADD COLUMN IF NOT EXISTS usage_status TEXT NOT NULL DEFAULT 'preview',
ADD COLUMN IF NOT EXISTS used_in_draft_at TIMESTAMPTZ;

ALTER TABLE public.user_safety_files
ADD COLUMN IF NOT EXISTS evidence_label TEXT,
ADD COLUMN IF NOT EXISTS base_evidence_label TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_viewer_policy TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_safety_files TO service_role;
NOTIFY pgrst, 'reload schema';
"""
    supabase.rpc("execute_sql", {"sql": sql}).execute()
    time.sleep(1)

    preview_rows = supabase.table("safety_viewer_policy").select("id").limit(1).execute().data
    file_rows = supabase.table("user_safety_files").select("id").limit(1).execute().data

    print("safety_viewer_policy_select_ok=true")
    print("user_safety_files_select_ok=true")
    print(f"safety_viewer_policy_sample_count={len(preview_rows or [])}")
    print(f"user_safety_files_sample_count={len(file_rows or [])}")


if __name__ == "__main__":
    main()
