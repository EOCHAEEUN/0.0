from __future__ import annotations

import argparse
import os
import re
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from supabase import create_client

import hwp_attachment_pipeline_common as common


MANIFEST_FIELDS = [
    "policy_id",
    "source",
    "title",
    "organization",
    "page_url",
    "file_url",
    "file_type",
    "local_path",
    "download_status",
    "error_message",
    "created_at",
]
LOG_FIELDS = [
    "policy_id",
    "title",
    "file_url",
    "status",
    "reason",
    "error_message",
    "created_at",
]
SELECT_COLUMNS = ",".join(
    [
        "policy_id",
        "title",
        "organization",
        "url",
        "source_name",
        "source_api_json",
        "attachment_files",
    ]
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download only HWP attachments from policy_validation_new.")
    parser.add_argument("--target-table", default=common.DEFAULT_TABLE)
    parser.add_argument("--dry-run", type=int, choices=[0, 1], default=1)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--policy-id", action="append", default=[])
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def fetch_rows(table_name: str, policy_ids: list[str]) -> list[dict[str, Any]]:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    service_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    supabase = create_client(supabase_url, service_key)

    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        query = supabase.table(table_name).select(SELECT_COLUMNS).range(offset, offset + page_size - 1)
        page = query.execute().data or []
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    if policy_ids:
        wanted = set(policy_ids)
        rows = [row for row in rows if common.clean_text(row.get("policy_id")) in wanted]
    return rows


def source_candidates(row: dict[str, Any]) -> tuple[list[str], list[str]]:
    hwp_urls: list[str] = []
    skipped: list[str] = []
    sources = [
        common.as_dict(row.get("source_api_json")),
        common.as_list(row.get("attachment_files")),
    ]
    for source in sources:
        for value in common.iter_nested_values(source):
            text = common.clean_text(value)
            if not text.startswith(("http://", "https://")):
                continue
            ext = common.known_attachment_ext(text)
            if ext == ".hwp":
                hwp_urls.append(text)
            elif ext:
                skipped.append(text)
    for item in common.as_list(row.get("attachment_files")):
        if not isinstance(item, dict):
            continue
        direct_url = common.clean_text(item.get("url") or item.get("file_url") or item.get("download_url"))
        filename = common.clean_text(item.get("filename"))
        ext = common.known_attachment_ext(filename) or common.clean_text(item.get("extension"))
        if direct_url and ext == ".hwp":
            hwp_urls.append(direct_url)
        elif direct_url and ext:
            skipped.append(direct_url)
    return hwp_urls, skipped


def page_candidates(session: requests.Session, page_url: str) -> tuple[list[str], list[str], str]:
    if not page_url:
        return [], [], ""
    response = session.get(page_url, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    hwp_urls: list[str] = []
    skipped: list[str] = []
    for tag in soup.find_all(["a", "button"]):
        href = tag.get("href") or tag.get("data-url") or tag.get("data-href")
        if not href:
            onclick = tag.get("onclick") or ""
            match = re.search(r"['\"]([^'\"]+)['\"]", onclick)
            href = match.group(1) if match else ""
        if not href:
            continue
        absolute = urljoin(page_url, href)
        ext = common.known_attachment_ext(absolute)
        if ext == ".hwp":
            hwp_urls.append(absolute)
        elif ext:
            skipped.append(absolute)
    return hwp_urls, skipped, ""


def unique(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def download_one(
    session: requests.Session,
    row: dict[str, Any],
    file_url: str,
    dry_run: bool,
    force: bool,
) -> dict[str, Any]:
    policy_id = common.clean_text(row.get("policy_id"))
    title = common.clean_text(row.get("title"))
    page_url = common.clean_text(row.get("url"))
    created_at = common.utc_now()
    guessed_name = common.safe_filename(file_url.rsplit("/", 1)[-1] or "attachment.hwp")
    local_path = common.HWP_RAW_DIR / common.output_name(policy_id, guessed_name, ".hwp")

    if local_path.exists() and not force:
        return {
            "policy_id": policy_id,
            "source": row.get("source_name") or "",
            "title": title,
            "organization": row.get("organization") or "",
            "page_url": page_url,
            "file_url": file_url,
            "file_type": ".hwp",
            "local_path": str(local_path),
            "download_status": "already_exists",
            "error_message": "",
            "created_at": created_at,
        }
    if dry_run:
        return {
            "policy_id": policy_id,
            "source": row.get("source_name") or "",
            "title": title,
            "organization": row.get("organization") or "",
            "page_url": page_url,
            "file_url": file_url,
            "file_type": ".hwp",
            "local_path": str(local_path),
            "download_status": "dry_run",
            "error_message": "",
            "created_at": created_at,
        }

    try:
        response = session.get(file_url, timeout=45)
        response.raise_for_status()
        cd_name = common.content_disposition_filename(response.headers.get("content-disposition", ""))
        final_name = cd_name or guessed_name
        if not final_name.lower().endswith(".hwp"):
            return {
                "policy_id": policy_id,
                "source": row.get("source_name") or "",
                "title": title,
                "organization": row.get("organization") or "",
                "page_url": page_url,
                "file_url": file_url,
                "file_type": common.known_attachment_ext(final_name) or "unknown",
                "local_path": "",
                "download_status": "skipped_non_hwp",
                "error_message": "content-disposition filename is not .hwp",
                "created_at": created_at,
            }
        local_path = common.HWP_RAW_DIR / common.output_name(policy_id, final_name, ".hwp")
        local_path.write_bytes(response.content or b"")
        return {
            "policy_id": policy_id,
            "source": row.get("source_name") or "",
            "title": title,
            "organization": row.get("organization") or "",
            "page_url": page_url,
            "file_url": file_url,
            "file_type": ".hwp",
            "local_path": str(local_path),
            "download_status": "downloaded",
            "error_message": "",
            "created_at": created_at,
        }
    except Exception as exc:
        return {
            "policy_id": policy_id,
            "source": row.get("source_name") or "",
            "title": title,
            "organization": row.get("organization") or "",
            "page_url": page_url,
            "file_url": file_url,
            "file_type": ".hwp",
            "local_path": str(local_path),
            "download_status": "download_failed",
            "error_message": str(exc),
            "created_at": created_at,
        }


def main() -> None:
    args = parse_args()
    dry_run = bool(args.dry_run) and not args.apply
    common.ensure_directories()
    session = requests.Session()
    rows = fetch_rows(args.target_table, args.policy_id)
    manifest_rows: list[dict[str, Any]] = []
    log_rows: list[dict[str, Any]] = []

    for row in rows:
        policy_id = common.clean_text(row.get("policy_id"))
        title = common.clean_text(row.get("title"))
        hwp_urls, skipped = source_candidates(row)
        if not hwp_urls:
            try:
                page_hwp, page_skipped, _ = page_candidates(session, common.clean_text(row.get("url")))
                hwp_urls.extend(page_hwp)
                skipped.extend(page_skipped)
            except Exception as exc:
                log_rows.append({
                    "policy_id": policy_id,
                    "title": title,
                    "file_url": row.get("url") or "",
                    "status": "invalid_url",
                    "reason": "detail page fetch failed",
                    "error_message": str(exc),
                    "created_at": common.utc_now(),
                })

        for url in unique(skipped):
            log_rows.append({
                "policy_id": policy_id,
                "title": title,
                "file_url": url,
                "status": "skipped_non_hwp",
                "reason": common.known_attachment_ext(url) or "non_hwp",
                "error_message": "",
                "created_at": common.utc_now(),
            })

        hwp_urls = unique(hwp_urls)
        if not hwp_urls:
            log_rows.append({
                "policy_id": policy_id,
                "title": title,
                "file_url": "",
                "status": "no_hwp_found",
                "reason": "no .hwp link in source_api_json or detail page",
                "error_message": "",
                "created_at": common.utc_now(),
            })
            continue

        for url in hwp_urls:
            result = download_one(session, row, url, dry_run, args.force)
            manifest_rows.append(result)
            log_rows.append({
                "policy_id": policy_id,
                "title": title,
                "file_url": url,
                "status": result["download_status"],
                "reason": result.get("file_type") or "",
                "error_message": result.get("error_message") or "",
                "created_at": result["created_at"],
            })
            print(f"{policy_id} | {result['download_status']} | {url}")
            if args.limit and len(manifest_rows) >= args.limit:
                break
        if args.limit and len(manifest_rows) >= args.limit:
            break

    common.write_csv(common.MANIFEST_PATH, manifest_rows, MANIFEST_FIELDS)
    common.write_csv(common.LOG_DIR / "attachment_download_log.csv", log_rows, LOG_FIELDS)
    print(f"rows={len(rows)} manifest={len(manifest_rows)} dry_run={dry_run}")


if __name__ == "__main__":
    main()
