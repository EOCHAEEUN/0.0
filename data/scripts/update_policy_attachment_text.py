from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

from supabase import create_client

import hwp_attachment_pipeline_common as common


LOG_FIELDS = [
    "policy_id",
    "txt_path",
    "old_text_length",
    "new_text_length",
    "update_status",
    "error_message",
    "created_at",
]

HWP_BLOCK_BEGIN = "[HWP_ATTACHMENT_TEXT_BEGIN]"
HWP_BLOCK_END = "[HWP_ATTACHMENT_TEXT_END]"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update attachment_text from extracted HWP TXT files.")
    parser.add_argument("--target-table", default=common.DEFAULT_TABLE)
    parser.add_argument("--dry-run", type=int, choices=[0, 1], default=1)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--replace-existing",
        action="store_true",
        help="Replace attachment_text instead of appending HWP text to existing extracted text.",
    )
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--policy-id", action="append", default=[])
    return parser.parse_args()


def supabase_client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    return create_client(url, key)


def policy_for_txt(txt_path: Path) -> str:
    manifest = common.read_csv_rows(common.MANIFEST_PATH)
    for row in manifest:
        local_path = Path(row.get("local_path", ""))
        if local_path.stem == txt_path.stem:
            return row.get("policy_id", "")
    return common.policy_id_from_filename(txt_path)


def grouped_text_files(files: list[Path]) -> dict[str, list[Path]]:
    grouped: dict[str, list[Path]] = {}
    for txt_path in files:
        policy_id = policy_for_txt(txt_path)
        grouped.setdefault(policy_id, []).append(txt_path)
    return grouped


def combined_hwp_text(paths: list[Path]) -> str:
    parts: list[str] = []
    for txt_path in sorted(paths):
        text = txt_path.read_text(encoding="utf-8", errors="replace").strip()
        if text:
            parts.append(f"[HWP attachment: {txt_path.name}]\n{text}")
    return "\n\n".join(parts).strip()


def remove_previous_hwp_block(text: str) -> str:
    if not text:
        return ""
    while HWP_BLOCK_BEGIN in text and HWP_BLOCK_END in text:
        start = text.find(HWP_BLOCK_BEGIN)
        end = text.find(HWP_BLOCK_END, start)
        if start < 0 or end < 0:
            break
        end += len(HWP_BLOCK_END)
        text = f"{text[:start].rstrip()}\n\n{text[end:].lstrip()}".strip()
    return text.strip()


def merge_attachment_text(existing_text: str, hwp_text: str, replace_existing: bool) -> str:
    hwp_text = hwp_text.strip()
    if replace_existing:
        return hwp_text
    base = remove_previous_hwp_block(existing_text)
    if not hwp_text:
        return base
    hwp_block = f"{HWP_BLOCK_BEGIN}\n{hwp_text}\n{HWP_BLOCK_END}"
    return "\n\n".join(part for part in [base, hwp_block] if part).strip()


def main() -> None:
    args = parse_args()
    dry_run = bool(args.dry_run) and not args.apply
    common.ensure_directories()
    client = supabase_client()
    rows: list[dict[str, Any]] = []
    files = sorted(common.TEXT_EXTRACTED_DIR.glob("*.txt"))
    if args.policy_id:
        wanted = set(args.policy_id)
        files = [path for path in files if policy_for_txt(path) in wanted]
    if args.limit:
        files = files[: args.limit]
    grouped_files = grouped_text_files(files)

    for policy_id, txt_paths in sorted(grouped_files.items()):
        hwp_text = combined_hwp_text(txt_paths)
        status = "dry_run" if dry_run else "updated"
        error = ""
        old_len = 0
        text = ""
        try:
            existing = (
                client.table(args.target_table)
                .select("policy_id,attachment_text")
                .eq("policy_id", policy_id)
                .limit(1)
                .execute()
                .data
                or []
            )
            if not existing:
                status = "policy_not_found"
            else:
                existing_text = existing[0].get("attachment_text") or ""
                old_len = len(existing_text)
                text = merge_attachment_text(existing_text, hwp_text, args.replace_existing)
                if len(hwp_text) < 200:
                    status = "skipped_short_text"
                elif not dry_run:
                    payload = {
                        "attachment_text": text,
                        "attachment_parse_status": "converted_hwp_to_hwpx",
                    }
                    try:
                        client.table(args.target_table).update(payload).eq("policy_id", policy_id).execute()
                    except Exception:
                        payload.pop("attachment_parse_status", None)
                        client.table(args.target_table).update(payload).eq("policy_id", policy_id).execute()
        except Exception as exc:
            status = "update_failed"
            error = str(exc)
        rows.append({
            "policy_id": policy_id,
            "txt_path": "; ".join(str(path) for path in sorted(txt_paths)),
            "old_text_length": old_len,
            "new_text_length": len(text),
            "update_status": status,
            "error_message": error,
            "created_at": common.utc_now(),
        })
        print(f"{policy_id} | {status} | old={old_len} new={len(text)}")
    common.write_csv(common.LOG_DIR / "attachment_text_update_log.csv", rows, LOG_FIELDS)


if __name__ == "__main__":
    main()
