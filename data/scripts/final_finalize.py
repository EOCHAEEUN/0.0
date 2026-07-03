from __future__ import annotations

import argparse
import collections
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent

for env_path in [
    REPO_ROOT / ".env",
    REPO_ROOT / "backend" / ".env",
    REPO_ROOT / "data" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


def run_step(name: str, command: list[str], *, continue_on_error: bool) -> None:
    print(f"\n== {name} ==", flush=True)
    print(" ".join(command), flush=True)
    result = subprocess.run(command, cwd=REPO_ROOT)
    if result.returncode != 0:
        message = f"{name} failed with exit code {result.returncode}"
        if continue_on_error:
            print(f"[WARN] {message}", flush=True)
            return
        raise SystemExit(message)


def supabase_client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or ""
    ).strip()
    if not url:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(url, key)


def verify_counts() -> dict[str, Any]:
    client = supabase_client()
    rows = (
        client.table("policy")
        .select(
            "policy_id,title,deadline,max_amount,max_amount_type,max_amount_type_ko,roi_support_type,"
            "safety_justification_usable,application_reflection_recommendation,"
            "max_amount_note,max_amount_evidence,support_method,summary"
        )
        .limit(3000)
        .execute()
        .data
        or []
    )
    finance_keywords = (
        "융자",
        "대출",
        "특례보증",
        "신용보증",
        "기업보증",
        "기술보증",
        "보증연계",
        "보증서",
        "이차보전",
        "수출보험",
        "금융지원",
        "정책자금",
        "경영안정자금",
        "육성자금",
        "협력자금",
    )
    finance_hits = []
    for row in rows:
        text = " ".join(
            str(row.get(field) or "")
            for field in ["title", "summary", "max_amount_note", "max_amount_evidence", "support_method"]
        )
        if any(keyword in text for keyword in finance_keywords):
            finance_hits.append(row)

    return {
        "total": len(rows),
        "roi_support_type": dict(
            collections.Counter(row.get("roi_support_type") or "<blank>" for row in rows).most_common()
        ),
        "max_amount_type": dict(
            collections.Counter((str(row.get("max_amount_type") or "") or "<blank>").lower() for row in rows).most_common()
        ),
        "max_amount_type_ko": dict(
            collections.Counter(row.get("max_amount_type_ko") or "<blank>" for row in rows).most_common()
        ),
        "safety_justification_usable": dict(
            collections.Counter(row.get("safety_justification_usable") or "<blank>" for row in rows).most_common()
        ),
        "application_reflection_recommendation": dict(
            collections.Counter(row.get("application_reflection_recommendation") or "<blank>" for row in rows).most_common()
        ),
        "expired_before_2026_07_01": sum(
            1 for row in rows if row.get("deadline") and str(row.get("deadline")) < "2026-07-01"
        ),
        "roi_direct_positive_amount": sum(
            1
            for row in rows
            if row.get("roi_support_type") == "ROI 직접 반영"
            and (row.get("max_amount") or 0) > 0
        ),
        "roi_direct_bad_amount": sum(
            1
            for row in rows
            if row.get("roi_support_type") == "ROI 직접 반영"
            and not ((row.get("max_amount") or 0) > 0)
        ),
        "loan_guarantee_type_remaining": sum(
            1
            for row in rows
            if str(row.get("max_amount_type") or "").lower() in {"loan", "guarantee"}
        ),
        "finance_keyword_remaining": len(finance_hits),
        "safety_blank": sum(1 for row in rows if not row.get("safety_justification_usable")),
    }


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Final policy cleanup, ROI review, safety classification, and count verification."
    )
    parser.add_argument("--apply", action="store_true", help="Write DB updates. Default is dry-run.")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument("--skip-remove-finance", action="store_true")
    parser.add_argument("--skip-roi-backfill", action="store_true")
    parser.add_argument("--skip-roi-gemini-review", action="store_true")
    parser.add_argument("--skip-linked-support-refine", action="store_true")
    parser.add_argument("--skip-safety-backfill", action="store_true")
    parser.add_argument("--skip-safety-gemini", action="store_true")
    parser.add_argument("--skip-verify", action="store_true")
    parser.add_argument("--roi-review-limit", type=int, default=0, help="0 means all.")
    parser.add_argument("--safety-limit", type=int, default=0, help="0 means all.")
    parser.add_argument("--sleep", type=float, default=0.2)
    return parser.parse_args()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    args = resolve_args()

    if not args.skip_remove_finance:
        command = [sys.executable, str(SCRIPT_DIR / "remove_finance_policy_rows.py")]
        if args.apply:
            command.append("--apply")
        run_step("remove_finance_policy_rows", command, continue_on_error=args.continue_on_error)

    if not args.skip_roi_backfill:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "backfill_policy_roi_support_type.py"),
            "--source-table",
            "policy_validation_new",
            "--target-table",
            "policy",
        ]
        if args.apply:
            command.append("--apply")
        run_step("backfill_policy_roi_support_type", command, continue_on_error=args.continue_on_error)

    if not args.skip_roi_gemini_review:
        command = [sys.executable, str(SCRIPT_DIR / "review_policy_roi_support_with_gemini.py")]
        if args.roi_review_limit > 0:
            command.extend(["--limit", str(args.roi_review_limit)])
        command.extend(["--sleep", str(args.sleep)])
        if args.apply:
            command.append("--apply")
        run_step("review_policy_roi_support_with_gemini", command, continue_on_error=args.continue_on_error)

    if not args.skip_linked_support_refine:
        command = [sys.executable, str(SCRIPT_DIR / "refine_policy_linked_support_quality.py")]
        if args.apply:
            command.append("--apply")
        run_step("refine_policy_linked_support_quality", command, continue_on_error=args.continue_on_error)

    if not args.skip_safety_backfill:
        command = [sys.executable, str(SCRIPT_DIR / "backfill_policy_safety_justification.py")]
        if args.apply:
            command.append("--apply")
        run_step("backfill_policy_safety_justification_existing", command, continue_on_error=args.continue_on_error)

    if not args.skip_safety_gemini:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "classify_missing_policy_safety_justification_with_gemini.py"),
            "--sleep",
            str(args.sleep),
        ]
        if args.safety_limit > 0:
            command.extend(["--limit", str(args.safety_limit)])
        if args.apply:
            command.append("--apply")
        run_step("classify_missing_policy_safety_justification", command, continue_on_error=args.continue_on_error)

    if not args.skip_safety_backfill:
        command = [sys.executable, str(SCRIPT_DIR / "backfill_policy_safety_justification.py")]
        if args.apply:
            command.append("--apply")
        run_step("backfill_policy_safety_justification_final", command, continue_on_error=args.continue_on_error)

    if not args.skip_verify:
        print("\n== verify_policy_counts ==", flush=True)
        print(json.dumps(verify_counts(), ensure_ascii=False, indent=2), flush=True)

    print("\nfinal_finalize completed.", flush=True)


if __name__ == "__main__":
    main()
