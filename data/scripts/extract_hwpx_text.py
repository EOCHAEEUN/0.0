from __future__ import annotations

import argparse
import io
import sys
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

import hwp_attachment_pipeline_common as common


LOG_FIELDS = [
    "policy_id",
    "hwpx_path",
    "txt_path",
    "text_length",
    "parse_status",
    "error_message",
    "created_at",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract UTF-8 text from converted HWPX files.")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    return parser.parse_args()


def xml_text(data: bytes) -> str:
    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError:
        return ""
    return common.clean_text(" ".join(part for part in root.itertext() if common.clean_text(part)))


def extract_hwpx(path: Path) -> str:
    parts: list[str] = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            normalized = name.replace("\\", "/")
            lower = normalized.lower()
            if not (
                normalized.startswith("Contents/")
                or normalized == "Preview/PrvText.txt"
                or lower.endswith(".xml")
            ):
                continue
            try:
                raw = archive.read(name)
            except Exception:
                continue
            if lower.endswith(".xml"):
                text = xml_text(raw)
            elif lower.endswith(".txt"):
                text = raw.decode("utf-8", errors="ignore")
            else:
                text = ""
            if text:
                parts.append(text)
    return common.clean_text("\n".join(parts))


def policy_id_for(hwpx_path: Path) -> str:
    manifest = common.read_csv_rows(common.MANIFEST_PATH)
    for row in manifest:
        local_path = Path(row.get("local_path", ""))
        if local_path.stem == hwpx_path.stem:
            return row.get("policy_id", "")
    return hwpx_path.stem.split("_", 2)[0]


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    common.ensure_directories()
    rows: list[dict[str, Any]] = []
    files = sorted(common.HWPX_CONVERTED_DIR.glob("*.hwpx"))
    if args.limit:
        files = files[: args.limit]
    for hwpx_path in files:
        policy_id = policy_id_for(hwpx_path)
        txt_path = common.TEXT_EXTRACTED_DIR / f"{hwpx_path.stem}.txt"
        if txt_path.exists() and not args.force:
            text = txt_path.read_text(encoding="utf-8", errors="replace")
            status = "parsed_hwpx" if len(text.strip()) >= 200 else "needs_review"
            error = ""
        else:
            try:
                text = extract_hwpx(hwpx_path)
                txt_path.write_text(text, encoding="utf-8")
                if not text.strip():
                    status = "empty_text"
                elif len(text.strip()) < 200:
                    status = "needs_review"
                else:
                    status = "parsed_hwpx"
                error = ""
            except Exception as exc:
                text = ""
                status = "parse_failed"
                error = str(exc)
        rows.append({
            "policy_id": policy_id,
            "hwpx_path": str(hwpx_path),
            "txt_path": str(txt_path),
            "text_length": len(text),
            "parse_status": status,
            "error_message": error,
            "created_at": common.utc_now(),
        })
        print(f"{hwpx_path.name} | {status} | {len(text)}")
    common.write_csv(common.LOG_DIR / "attachment_parse_log.csv", rows, LOG_FIELDS)


if __name__ == "__main__":
    main()
