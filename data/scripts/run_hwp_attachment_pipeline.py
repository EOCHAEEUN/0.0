from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import hwp_attachment_pipeline_common as common


SCRIPT_DIR = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the full HWP attachment pipeline: download, convert, extract, update text, enrich amount/deadline."
    )
    parser.add_argument("--target-table", default=common.DEFAULT_TABLE)
    parser.add_argument("--apply", action="store_true", help="Write downloads and DB updates. Default is dry-run for DB steps.")
    parser.add_argument("--force", action="store_true", help="Re-download/re-convert existing local files.")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--policy-id", action="append", default=[])
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--skip-convert", action="store_true")
    parser.add_argument("--skip-extract", action="store_true")
    parser.add_argument("--skip-update-text", action="store_true")
    parser.add_argument("--skip-enrich", action="store_true")
    return parser.parse_args()


def run_step(name: str, command: list[str]) -> None:
    print(f"\n== {name} ==")
    result = subprocess.run(command, cwd=SCRIPT_DIR.parent.parent)
    if result.returncode != 0:
        raise SystemExit(f"{name} failed with exit code {result.returncode}")


def add_common_filters(command: list[str], args: argparse.Namespace) -> list[str]:
    command.extend(["--target-table", args.target_table])
    if args.limit:
        command.extend(["--limit", str(args.limit)])
    for policy_id in args.policy_id:
        command.extend(["--policy-id", policy_id])
    return command


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    common.ensure_directories()

    dry_run = "0" if args.apply else "1"

    if not args.skip_download:
        command = [sys.executable, str(SCRIPT_DIR / "download_hwp_attachments.py"), "--dry-run", dry_run]
        add_common_filters(command, args)
        if args.apply:
            command.append("--apply")
        if args.force:
            command.append("--force")
        run_step("download_hwp_attachments", command)

    if not args.skip_convert:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "convert_hwp_to_hwpx_batch.py"),
            "--timeout",
            str(args.timeout),
            "--retries",
            str(args.retries),
        ]
        if args.force:
            command.append("--force")
        if args.limit:
            command.extend(["--limit", str(args.limit)])
        run_step("convert_hwp_to_hwpx", command)

    if not args.skip_extract:
        command = [sys.executable, str(SCRIPT_DIR / "extract_hwpx_text.py")]
        if args.force:
            command.append("--force")
        if args.limit:
            command.extend(["--limit", str(args.limit)])
        run_step("extract_hwpx_text", command)

    if not args.skip_update_text:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "update_policy_attachment_text.py"),
            "--dry-run",
            dry_run,
        ]
        add_common_filters(command, args)
        if args.apply:
            command.append("--apply")
        run_step("update_policy_attachment_text", command)

    if not args.skip_enrich:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "enrich_policy_amount_deadline.py"),
            "--dry-run",
            dry_run,
        ]
        add_common_filters(command, args)
        if args.apply:
            command.append("--apply")
        run_step("enrich_policy_amount_deadline", command)

    mode = "apply" if args.apply else "dry-run"
    print(f"\nHWP attachment pipeline completed in {mode} mode for {args.target_table}.")


if __name__ == "__main__":
    main()
