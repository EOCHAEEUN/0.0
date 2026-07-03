from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path
from typing import Any

import requests
from supabase import Client, create_client

import collect_external_policy_sources as collector
import upload_final as core


SOURCE_CHOICES = [
    "all",
    "smart-factory",
    "energy-agency",
    "kosmes",
    "technopark",
]
SOURCE_DB_NAMES = {
    "smart-factory": "smart_factory",
    "energy-agency": "energy_agency",
    "kosmes": "kosmes",
    "technopark": "technopark",
}
DEFAULT_SELECT_COLUMNS = ",".join(
    [
        "policy_id",
        "source_name",
        "source_id",
        "title",
        "region",
        "url",
        "attachment_text",
        "attachment_files",
        "error_message",
        "source_api_json",
    ]
)


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Recheck attachments for rows already stored in "
            "policy_external_collected without rerunning announcement collection "
            "or rebuilding summary/amount/eligibility fields."
        )
    )
    parser.add_argument("--source", choices=SOURCE_CHOICES, default="all")
    parser.add_argument(
        "--target-table",
        default=collector.DEFAULT_TARGET_TABLE,
    )
    parser.add_argument(
        "--policy-id",
        action="append",
        default=[],
        help="Process only this policy_id. May be supplied multiple times.",
    )
    parser.add_argument("--limit", type=int, default=0, help="0 means all")
    parser.add_argument(
        "--dry-run",
        type=int,
        choices=[0, 1],
        default=1,
        help="Default 1. Use 0 to update attachment columns in Supabase.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess rows that already contain at least one extracted file.",
    )
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument(
        "--csv-output",
        default="",
        help="Optional dry-run/result summary CSV path.",
    )
    return parser.parse_args()


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


def as_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def has_extracted_attachment(row: dict[str, Any]) -> bool:
    return any(
        str(file_meta.get("extraction_status") or "").startswith("extracted")
        for file_meta in as_list(row.get("attachment_files"))
    )


def source_api(row: dict[str, Any]) -> dict[str, Any]:
    return as_dict(row.get("source_api_json"))


def smart_factory_attachment_id(row: dict[str, Any]) -> str:
    api = source_api(row)
    attachments = as_dict(api.get("attachments"))
    attachment_id = core.clean_text(attachments.get("attachment_id"))
    if attachment_id:
        return attachment_id

    detail = as_dict(api.get("detail"))
    attachment_id = core.clean_text(detail.get("atchFileId"))
    if attachment_id:
        return attachment_id

    for file_meta in as_list(row.get("attachment_files")):
        attachment_id = core.clean_text(file_meta.get("attachment_id"))
        if attachment_id:
            return attachment_id
    return ""


def enrich_smart_factory(
    session: requests.Session,
    row: dict[str, Any],
) -> dict[str, Any]:
    attachment_id = smart_factory_attachment_id(row)
    if not attachment_id:
        raise ValueError("attachment_id not found in source_api_json")
    return collector.fetch_smart_factory_attachments(session, attachment_id)


def enrich_energy_agency(
    session: requests.Session,
    row: dict[str, Any],
) -> dict[str, Any]:
    board_no = core.clean_text(row.get("source_id"))
    if not board_no:
        policy_id = core.clean_text(row.get("policy_id"))
        board_no = policy_id.rsplit(":", 1)[-1] if ":" in policy_id else ""
    if not board_no:
        raise ValueError("energy agency board number not found")
    detail = collector.fetch_energy_agency_detail(session, board_no)
    return {
        "attachment_text": detail.get("attachment_text") or "",
        "attachment_files": detail.get("attachment_files") or [],
        "error_message": detail.get("error_message") or "",
        "attachment_stats": attachment_stats(
            detail.get("attachment_files"),
            detail.get("attachment_text"),
        ),
    }


def enrich_kosmes(
    session: requests.Session,
    row: dict[str, Any],
) -> dict[str, Any]:
    seq_no = core.clean_text(row.get("source_id"))
    if not seq_no:
        policy_id = core.clean_text(row.get("policy_id"))
        seq_no = policy_id.rsplit(":", 1)[-1] if ":" in policy_id else ""
    if not seq_no:
        raise ValueError("KOSMES sequence number not found")

    api = source_api(row)
    list_row = as_dict(api.get("list"))
    if not list_row:
        list_row = {
            "SLNO": seq_no,
            "TITL_NM": row.get("title"),
        }
    detail = collector.fetch_kosmes_detail(session, seq_no, list_row)
    return collector.download_kosmes_attachments(session, detail)


def enrich_technopark(
    session: requests.Session,
    row: dict[str, Any],
) -> dict[str, Any]:
    detail_url = core.clean_text(row.get("url"))
    if not detail_url:
        raise ValueError("TechnoPark detail URL not found")
    detail = collector.fetch_technopark_detail(
        session,
        {
            "link_id": row.get("source_id"),
            "title": row.get("title"),
            "region": row.get("region"),
            "detail_url": detail_url,
        },
    )
    return {
        "attachment_text": detail.get("attachment_text") or "",
        "attachment_files": detail.get("attachment_files") or [],
        "error_message": detail.get("error_message") or "",
        "attachment_stats": attachment_stats(
            detail.get("attachment_files"),
            detail.get("attachment_text"),
        ),
    }


def attachment_stats(
    files_value: Any,
    attachment_text: Any,
) -> dict[str, Any]:
    files = as_list(files_value)
    return {
        "candidate_count": len(files),
        "downloaded_count": sum(
            1
            for file_meta in files
            if file_meta.get("extraction_status")
            not in {
                "metadata_only",
                "skipped_download_limit",
                "skipped_too_large",
                "skipped_total_size_limit",
            }
        ),
        "extracted_count": sum(
            1
            for file_meta in files
            if str(file_meta.get("extraction_status") or "").startswith(
                "extracted"
            )
        ),
        "attachment_text_length": len(str(attachment_text or "")),
    }


def enrich_row(
    session: requests.Session,
    row: dict[str, Any],
) -> dict[str, Any]:
    handlers = {
        "smart_factory": enrich_smart_factory,
        "energy_agency": enrich_energy_agency,
        "kosmes": enrich_kosmes,
        "technopark": enrich_technopark,
    }
    source_name = core.clean_text(row.get("source_name"))
    handler = handlers.get(source_name)
    if not handler:
        raise ValueError(f"unsupported source_name: {source_name}")
    return handler(session, row)


def fetch_rows(
    supabase: Client,
    table_name: str,
    source: str,
    policy_ids: list[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page_size = 500
    offset = 0
    while True:
        query = (
            supabase.table(table_name)
            .select(DEFAULT_SELECT_COLUMNS)
            .range(offset, offset + page_size - 1)
        )
        if source != "all":
            query = query.eq("source_name", SOURCE_DB_NAMES[source])
        response_rows = query.execute().data or []
        rows.extend(response_rows)
        if len(response_rows) < page_size:
            break
        offset += page_size

    if policy_ids:
        wanted = set(policy_ids)
        rows = [
            row
            for row in rows
            if core.clean_text(row.get("policy_id")) in wanted
        ]
    return rows


def write_csv(path_value: str, rows: list[dict[str, Any]]) -> Path:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "policy_id",
        "source_name",
        "title",
        "status",
        "update_fields",
        "candidate_count",
        "downloaded_count",
        "extracted_count",
        "attachment_text_length",
        "error_message",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return path


def main() -> None:
    collector.load_environment()
    args = resolve_args()
    table_name = collector.validate_table_name(args.target_table)
    dry_run = bool(args.dry_run)
    supabase = create_client(
        core.SUPABASE_URL,
        core.SUPABASE_SERVICE_ROLE_KEY,
    )
    rows = fetch_rows(
        supabase,
        table_name,
        args.source,
        args.policy_id,
    )

    session = requests.Session()
    processed = 0
    updated = 0
    skipped = 0
    failed = 0
    report_rows: list[dict[str, Any]] = []

    print(f"target_table={table_name}")
    print(f"source={args.source}")
    print(f"dry_run={dry_run}")
    print(f"force={args.force}")
    print(f"candidate_rows={len(rows)}")

    for row in rows:
        if args.limit and processed >= args.limit:
            break
        policy_id = core.clean_text(row.get("policy_id"))
        if not args.force and has_extracted_attachment(row):
            skipped += 1
            continue

        processed += 1
        try:
            result = enrich_row(session, row)
            attachment_text = result.get("attachment_text") or ""
            attachment_files = result.get("attachment_files") or []
            stats = result.get("attachment_stats") or attachment_stats(
                attachment_files,
                attachment_text,
            )
            update_payload = {
                "error_message": "",
            }
            extracted_count = int(stats.get("extracted_count", 0) or 0)
            if extracted_count > 0:
                update_payload.update(
                    {
                        "attachment_text": attachment_text,
                        "attachment_files": attachment_files,
                    }
                )
            else:
                update_payload["error_message"] = (
                    result.get("error_message")
                    or (
                        "No usable attachment text extracted "
                        f"(candidates={stats.get('candidate_count', 0)})."
                    )
                )

            status = (
                "dry_run_success"
                if extracted_count > 0
                else "dry_run_error_only"
            )
            if not dry_run:
                (
                    supabase.table(table_name)
                    .update(update_payload)
                    .eq("policy_id", policy_id)
                    .execute()
                )
                updated += 1
                status = (
                    "updated"
                    if extracted_count > 0
                    else "error_updated"
                )

            print(
                f"[{processed}] {row.get('source_name')} | {policy_id} | "
                f"files={stats.get('candidate_count', 0)} | "
                f"extracted={stats.get('extracted_count', 0)} | "
                f"text={len(attachment_text)} | {status} | "
                f"fields={','.join(update_payload)}"
            )
            report_rows.append(
                {
                    "policy_id": policy_id,
                    "source_name": row.get("source_name"),
                    "title": row.get("title"),
                    "status": status,
                    "update_fields": ",".join(update_payload),
                    "candidate_count": stats.get("candidate_count", 0),
                    "downloaded_count": stats.get("downloaded_count", 0),
                    "extracted_count": stats.get("extracted_count", 0),
                    "attachment_text_length": len(attachment_text),
                    "error_message": update_payload.get("error_message") or "",
                }
            )
        except Exception as exc:
            failed += 1
            print(f"[ERROR] {policy_id}: {exc}")
            report_rows.append(
                {
                    "policy_id": policy_id,
                    "source_name": row.get("source_name"),
                    "title": row.get("title"),
                    "status": "failed",
                    "update_fields": "",
                    "candidate_count": 0,
                    "downloaded_count": 0,
                    "extracted_count": 0,
                    "attachment_text_length": 0,
                    "error_message": str(exc),
                }
            )
        time.sleep(args.sleep)

    if args.csv_output:
        output_path = write_csv(args.csv_output, report_rows)
        print(f"CSV report: {output_path}")

    print("=" * 80)
    print("Done")
    print(f"Processed rows: {processed}")
    print(f"Updated rows: {updated}")
    print(f"Skipped existing success rows: {skipped}")
    print(f"Failed rows: {failed}")


if __name__ == "__main__":
    main()
