from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent


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


def add_apply(command: list[str], args: argparse.Namespace, *, dry_run_flag: bool = False) -> list[str]:
    if dry_run_flag:
        command.extend(["--dry-run", "0" if args.apply else "1"])
    if args.apply:
        command.append("--apply")
    return command


def add_limit(command: list[str], limit: int) -> list[str]:
    if limit > 0:
        command.extend(["--limit", str(limit)])
    return command


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Final policy enrichment and promotion phase for candidate tables."
    )
    parser.add_argument("--apply", action="store_true", help="Write DB updates. Default is dry-run.")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Limit rows in enrichment steps. 0 means all.")
    parser.add_argument("--skip-hwp", action="store_true")
    parser.add_argument("--skip-external-attachments", action="store_true")
    parser.add_argument("--skip-amount-deadline", action="store_true")
    parser.add_argument("--skip-normalize-deadline", action="store_true")
    parser.add_argument("--skip-sync-validation", action="store_true")
    parser.add_argument("--skip-promote-candidates", action="store_true")
    parser.add_argument("--hwp-force", action="store_true")
    parser.add_argument("--external-force", action="store_true")
    parser.add_argument("--sync-all-validation", action="store_true", help="Sync all validation rows, not only selected rows.")
    return parser.parse_args()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    args = resolve_args()

    if not args.skip_hwp:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "run_hwp_attachment_pipeline.py"),
            "--target-table",
            "policy_validation_new",
            "--skip-enrich",
        ]
        add_limit(command, args.limit)
        if args.hwp_force:
            command.append("--force")
        if args.apply:
            command.append("--apply")
        run_step("hwp_text_policy_validation_new", command, continue_on_error=args.continue_on_error)

    if not args.skip_external_attachments:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "enrich_external_policy_attachments.py"),
            "--source",
            "all",
        ]
        add_limit(command, args.limit)
        add_apply(command, args, dry_run_flag=True)
        if args.external_force:
            command.append("--force")
        run_step("external_attachment_text", command, continue_on_error=args.continue_on_error)

    if not args.skip_amount_deadline:
        for table in ["policy_validation_new", "policy_external_collected"]:
            command = [
                sys.executable,
                str(SCRIPT_DIR / "enrich_policy_amount_deadline.py"),
                "--target-table",
                table,
            ]
            add_limit(command, args.limit)
            add_apply(command, args, dry_run_flag=True)
            run_step(f"amount_deadline_{table}", command, continue_on_error=args.continue_on_error)

    if not args.skip_normalize_deadline:
        for table in ["policy_validation_new", "policy_external_collected"]:
            command = [
                sys.executable,
                str(SCRIPT_DIR / "normalize_policy_deadline_notes.py"),
                "--target-table",
                table,
            ]
            add_limit(command, args.limit)
            add_apply(command, args, dry_run_flag=True)
            run_step(f"normalize_deadline_{table}", command, continue_on_error=args.continue_on_error)

    if not args.skip_sync_validation:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "sync_policy_from_validation.py"),
            "--source-table",
            "policy_validation_new",
            "--target-table",
            "policy",
        ]
        add_limit(command, args.limit)
        if not args.sync_all_validation:
            command.append("--selected-only")
        if args.apply:
            command.append("--execute")
        run_step("sync_validation_to_policy", command, continue_on_error=args.continue_on_error)

    if not args.skip_promote_candidates:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "promote_roi_support_candidates.py"),
        ]
        if args.apply:
            command.append("--apply")
        run_step("promote_roi_support_candidates", command, continue_on_error=args.continue_on_error)

    print("\nfinal_promote completed.", flush=True)


if __name__ == "__main__":
    main()
