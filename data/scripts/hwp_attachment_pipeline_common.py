from __future__ import annotations

import csv
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import unquote, urljoin, urlparse

from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent
ATTACHMENT_DIR = DATA_DIR / "attachments"
HWP_RAW_DIR = ATTACHMENT_DIR / "hwp_raw"
HWPX_CONVERTED_DIR = ATTACHMENT_DIR / "hwpx_converted"
TEXT_EXTRACTED_DIR = ATTACHMENT_DIR / "text_extracted"
LOG_DIR = DATA_DIR / "logs"
MANIFEST_PATH = ATTACHMENT_DIR / "attachment_manifest.csv"
DEFAULT_TABLE = "policy_validation_new"


for env_path in [
    Path.cwd() / ".env",
    SCRIPT_DIR / ".env",
    DATA_DIR / ".env",
    DATA_DIR.parent / ".env",
    DATA_DIR.parent / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


def ensure_directories() -> None:
    for path in [
        HWP_RAW_DIR,
        HWPX_CONVERTED_DIR,
        TEXT_EXTRACTED_DIR,
        LOG_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def utc_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


def clean_text(value: Any, max_len: int | None = None) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def safe_filename(value: Any, max_len: int = 120) -> str:
    text = clean_text(value) or "attachment"
    text = unquote(text)
    text = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", text)
    text = re.sub(r"\s+", " ", text).strip(" ._")
    if len(text) > max_len:
        stem = Path(text).stem[: max_len - 5].rstrip(" ._")
        suffix = Path(text).suffix[:5]
        text = f"{stem}{suffix}"
    return text or "attachment"


def policy_prefix(policy_id: Any) -> str:
    return safe_filename(clean_text(policy_id).replace(":", "_"), 80)


def output_name(policy_id: Any, filename: Any, suffix: str) -> str:
    stem = safe_filename(Path(clean_text(filename) or "attachment").stem, 110)
    return f"{policy_prefix(policy_id)}_{stem}{suffix}"


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def append_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    if not rows:
        return
    existing = read_csv_rows(path)
    write_csv(path, [*existing, *rows], fieldnames)


def as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def iter_nested_values(value: Any) -> Iterable[Any]:
    if isinstance(value, dict):
        for item in value.values():
            yield from iter_nested_values(item)
    elif isinstance(value, list):
        for item in value:
            yield from iter_nested_values(item)
    else:
        yield value


def is_hwp_url(value: Any) -> bool:
    parsed = urlparse(clean_text(value))
    return unquote(parsed.path).lower().endswith(".hwp")


def known_attachment_ext(value: Any) -> str:
    path = unquote(urlparse(clean_text(value)).path).lower()
    for ext in [".hwp", ".hwpx", ".pdf", ".docx", ".doc", ".zip", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"]:
        if path.endswith(ext):
            return ext
    return ""


def content_disposition_filename(value: str) -> str:
    if not value:
        return ""
    match = re.search(r"filename\*=UTF-8''([^;]+)", value, flags=re.I)
    if match:
        return unquote(match.group(1).strip().strip('"'))
    match = re.search(r'filename="?([^";]+)"?', value, flags=re.I)
    if match:
        return unquote(match.group(1).strip())
    return ""


def manifest_by_local_path() -> dict[str, dict[str, str]]:
    rows = read_csv_rows(MANIFEST_PATH)
    return {str(Path(row.get("local_path", ""))).lower(): row for row in rows if row.get("local_path")}


def policy_id_from_filename(path: Path) -> str:
    stem = path.stem
    parts = stem.split("_")
    if len(parts) >= 2:
        return f"{parts[0]}:{parts[1]}" if parts[0].isalpha() else parts[0]
    return parts[0] if parts else ""
