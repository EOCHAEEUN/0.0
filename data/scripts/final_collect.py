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


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Final policy collection phase: Bizinfo + external source candidate collection."
    )
    parser.add_argument("--apply", action="store_true", help="Write collected rows. Default is dry-run.")
    parser.add_argument("--skip-bizinfo", action="store_true")
    parser.add_argument("--skip-external", action="store_true")
    parser.add_argument("--continue-on-error", action="store_true")
    parser.add_argument("--bizinfo-max-pages", type=int, default=0, help="0 uses upload_final.py default.")
    parser.add_argument("--bizinfo-max-policies", type=int, default=0, help="0 means all/default.")
    parser.add_argument("--external-max-pages", type=int, default=3)
    parser.add_argument("--external-max-policies", type=int, default=0, help="0 means all.")
    parser.add_argument("--min-score", type=int, default=4)
    parser.add_argument("--sleep", type=float, default=0.4)
    parser.add_argument(
        "--no-llm-summary",
        action="store_true",
        help="Disable Gemini summary cleanup in Bizinfo collection.",
    )
    parser.add_argument(
        "--external-use-llm",
        action="store_true",
        help="Enable Gemini cleanup in external source collection.",
    )
    return parser.parse_args()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    args = resolve_args()
    dry_run = "0" if args.apply else "1"

    if not args.skip_bizinfo:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "upload_final.py"),
            "--dry-run",
            dry_run,
            "--min-score",
            str(args.min_score),
            "--sleep",
            str(args.sleep),
        ]
        if args.bizinfo_max_pages > 0:
            command.extend(["--max-pages", str(args.bizinfo_max_pages)])
        if args.bizinfo_max_policies > 0:
            command.extend(["--max-policies", str(args.bizinfo_max_policies)])
        if args.no_llm_summary:
            command.append("--no-llm-summary")
        run_step("collect_bizinfo", command, continue_on_error=args.continue_on_error)

    if not args.skip_external:
        command = [
            sys.executable,
            str(SCRIPT_DIR / "collect_external_policy_sources.py"),
            "--source",
            "all",
            "--dry-run",
            dry_run,
            "--max-pages",
            str(args.external_max_pages),
            "--max-policies",
            str(args.external_max_policies),
            "--min-score",
            str(args.min_score),
            "--sleep",
            str(args.sleep),
        ]
        if args.external_use_llm:
            command.append("--use-llm")
        run_step("collect_external_sources", command, continue_on_error=args.continue_on_error)

    print("\nfinal_collect completed.", flush=True)


if __name__ == "__main__":
    main()
