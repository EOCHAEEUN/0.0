from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import hwp_attachment_pipeline_common as common


# Windows + Hancom Office desktop environment only.
# This script uses COM automation (HWPFrame.HwpObject) and is not intended for
# Linux deployment targets such as Render or Vercel.

LOG_FIELDS = [
    "policy_id",
    "input_path",
    "output_path",
    "conversion_status",
    "error_message",
    "created_at",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch convert local HWP files to HWPX using Hancom COM.")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--register-filepath-module", action="store_true")
    parser.add_argument("--worker-input", default="")
    parser.add_argument("--worker-output", default="")
    parser.add_argument("--worker-register-filepath-module", action="store_true")
    return parser.parse_args()


def policy_id_for(input_path: Path) -> str:
    manifest = common.manifest_by_local_path()
    row = manifest.get(str(input_path).lower())
    if row:
        return row.get("policy_id", "")
    return input_path.stem.split("_", 2)[0]


def convert_file(hwp: Any, input_path: Path, output_path: Path) -> tuple[str, str]:
    try:
        try:
            hwp.XHwpWindows.Item(0).Visible = False
        except Exception:
            pass
        opened = hwp.Open(str(input_path), "HWP", "forceopen:true")
        if opened is False:
            return "conversion_failed", "HwpObject.Open returned false"
        saved = hwp.SaveAs(str(output_path), "HWPX")
        if saved is False:
            return "conversion_failed", "HwpObject.SaveAs returned false"
        return "converted", ""
    except Exception as exc:
        return "conversion_failed", str(exc)
    finally:
        try:
            hwp.Clear(1)
        except Exception:
            pass


def run_worker(input_path: Path, output_path: Path, register_file_path_module: bool = False) -> int:
    try:
        import win32com.client  # type: ignore # noqa: F401
    except Exception as exc:
        print(f"hwp_not_installed: {exc}", file=sys.stderr)
        return 2

    hwp = None
    ascii_input = Path(tempfile.gettempdir()) / f"factofit_hwp_{os.getpid()}.hwp"
    ascii_output = Path(tempfile.gettempdir()) / f"factofit_hwp_{os.getpid()}.hwpx"
    try:
        shutil.copy2(input_path, ascii_input)
        hwp = win32com.client.DispatchEx("HWPFrame.HwpObject")
        if register_file_path_module:
            try:
                hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
            except Exception:
                pass
        status, error = convert_file(hwp, ascii_input, ascii_output)
        if status != "converted":
            print(error, file=sys.stderr)
            return 1
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ascii_output, output_path)
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        if hwp is not None:
            try:
                hwp.Quit()
            except Exception:
                pass
        for path in [ascii_input, ascii_output]:
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass


def convert_with_timeout(
    input_path: Path,
    output_path: Path,
    timeout: int,
    register_file_path_module: bool,
) -> tuple[str, str]:
    command = [
        sys.executable,
        __file__,
        "--worker-input",
        str(input_path),
        "--worker-output",
        str(output_path),
    ]
    if register_file_path_module:
        command.append("--worker-register-filepath-module")
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode == 0:
        return "converted", ""
    if result.returncode == 2:
        return "hwp_not_installed", result.stderr.strip()
    return "conversion_failed", (result.stderr or result.stdout).strip()


def convert_with_retries(
    input_path: Path,
    output_path: Path,
    timeout: int,
    retries: int,
    register_file_path_module: bool,
) -> tuple[str, str]:
    attempts = max(1, retries + 1)
    errors: list[str] = []
    for attempt in range(1, attempts + 1):
        try:
            status, error = convert_with_timeout(
                input_path,
                output_path,
                timeout,
                register_file_path_module,
            )
        except subprocess.TimeoutExpired:
            status, error = "conversion_failed", f"conversion timeout after {timeout}s"
        if status == "converted":
            suffix = "" if attempt == 1 else f" after retry {attempt - 1}"
            return status, suffix
        errors.append(f"attempt {attempt}: {error or status}")
    return "conversion_failed", " | ".join(errors)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    args = parse_args()
    common.ensure_directories()
    rows: list[dict[str, Any]] = []

    if args.worker_input and args.worker_output:
        raise SystemExit(
            run_worker(
                Path(args.worker_input),
                Path(args.worker_output),
                args.worker_register_filepath_module,
            )
        )

    if platform.system().lower() != "windows":
        status = "unsupported_environment"
        for input_path in common.HWP_RAW_DIR.glob("*.hwp"):
            rows.append({
                "policy_id": policy_id_for(input_path),
                "input_path": str(input_path),
                "output_path": "",
                "conversion_status": status,
                "error_message": "Windows is required for Hancom COM automation.",
                "created_at": common.utc_now(),
            })
        common.write_csv(common.LOG_DIR / "hwp_conversion_log.csv", rows, LOG_FIELDS)
        print(status)
        return

    try:
        import win32com.client  # type: ignore
    except Exception as exc:
        for input_path in common.HWP_RAW_DIR.glob("*.hwp"):
            rows.append({
                "policy_id": policy_id_for(input_path),
                "input_path": str(input_path),
                "output_path": "",
                "conversion_status": "hwp_not_installed",
                "error_message": f"win32com/Hancom unavailable: {exc}",
                "created_at": common.utc_now(),
            })
        common.write_csv(common.LOG_DIR / "hwp_conversion_log.csv", rows, LOG_FIELDS)
        print("hwp_not_installed")
        return

    files = sorted(common.HWP_RAW_DIR.glob("*.hwp"))
    if not args.force:
        files = [
            input_path
            for input_path in files
            if not (common.HWPX_CONVERTED_DIR / f"{input_path.stem}.hwpx").exists()
        ]
    if args.limit:
        files = files[: args.limit]
    for input_path in files:
        output_path = common.HWPX_CONVERTED_DIR / f"{input_path.stem}.hwpx"
        if output_path.exists() and not args.force:
            status, error = "already_exists", ""
        else:
            status, error = convert_with_retries(
                input_path,
                output_path,
                args.timeout,
                args.retries,
                args.register_filepath_module,
            )
        rows.append({
            "policy_id": policy_id_for(input_path),
            "input_path": str(input_path),
            "output_path": str(output_path),
            "conversion_status": status,
            "error_message": error,
            "created_at": common.utc_now(),
        })
        print(f"{input_path.name} | {status}", flush=True)

    common.write_csv(common.LOG_DIR / "hwp_conversion_log.csv", rows, LOG_FIELDS)


if __name__ == "__main__":
    main()
