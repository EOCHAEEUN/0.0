from __future__ import annotations

import argparse
import csv
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from supabase import Client, create_client

import collect_external_policy_sources as collector
import upload_final as core


DEFAULT_SELECT_COLUMNS = ",".join(
    [
        "policy_id",
        "source_name",
        "source_id",
        "title",
        "region",
        "url",
        "detail_text",
        "attachment_text",
        "deadline_start_date",
        "deadline",
        "deadline_type",
        "deadline_display",
        "deadline_status",
        "is_early_close_possible",
        "temp_extraction_json",
    ]
)
ENRICHMENT_KEY = "technopark_deadline_enrichment_v2"
AMBIGUOUS_SHORT_DATE_PATTERN = re.compile(
    r"^\s*\d{1,2}\s*-\s*\d{1,2}\s*$"
)


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Recheck deadline fields for existing TechnoPark rows in "
            "policy_external_collected. This script does not recollect list "
            "pages or download attachments."
        )
    )
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
        help="Default 1. Use 0 to update only deadline fields in Supabase.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Also replace existing confirmed deadline values. Without this "
            "flag, only missing/unknown/review-needed rows are updated."
        ),
    )
    parser.add_argument(
        "--use-stored-detail",
        action="store_true",
        help=(
            "Use the existing detail_text without requesting the URL. "
            "By default the URL is fetched and detail_text is a fallback."
        ),
    )
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument(
        "--csv-output",
        default="data/processed/external_policy_deadline_preview.csv",
        help="Dry-run/result comparison CSV path.",
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


def fetch_rows(
    supabase: Client,
    table_name: str,
    policy_ids: list[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page_size = 500
    offset = 0
    while True:
        response_rows = (
            supabase.table(table_name)
            .select(DEFAULT_SELECT_COLUMNS)
            .eq("source_name", "technopark")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
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


def fetch_detail_text(
    session: requests.Session,
    row: dict[str, Any],
    use_stored_detail: bool,
) -> tuple[str, str]:
    stored_text = core.clean_text(row.get("detail_text"), 30000)
    has_attachment_text = bool(
        core.clean_text(row.get("attachment_text"))
    )
    if use_stored_detail:
        return stored_text, "stored_detail_text"

    detail_url = core.clean_text(row.get("url"))
    if not detail_url:
        if stored_text:
            return stored_text, "stored_detail_text_fallback"
        if has_attachment_text:
            return "", "detail_unavailable"
        raise ValueError("TechnoPark detail URL not found")

    try:
        response = session.get(
            detail_url,
            headers=collector.SCRIPT_HEADERS,
            timeout=50,
            allow_redirects=True,
        )
        response.raise_for_status()
        if not response.encoding or response.encoding.lower() in {
            "iso-8859-1",
            "ascii",
        }:
            response.encoding = response.apparent_encoding or "utf-8"
        detail_text = collector._trim_detail_text(
            collector._extract_main_page_text(response.text),
            core.clean_text(row.get("title")),
        )
        if detail_text:
            return detail_text, "url_html"
    except Exception:
        if not stored_text and not has_attachment_text:
            raise

    if stored_text:
        return stored_text, "stored_detail_text_fallback"
    return "", "detail_unavailable"


def extract_deadline_info(
    row: dict[str, Any],
    detail_text: str,
    detail_source: str,
) -> tuple[dict[str, Any], str]:
    region = core.clean_text(row.get("region"))
    detail_url = core.clean_text(row.get("url"))
    attachment_text = core.clean_text(
        row.get("attachment_text"),
        50000,
    )

    for text, text_source in [
        (detail_text, detail_source),
        (attachment_text, "attachment_text"),
    ]:
        if not text:
            continue
        deadline_info = collector.extract_technopark_application_period(
            text,
            region=region,
            detail_url=detail_url,
        )
        parsed = as_dict(deadline_info.get("parsed"))
        display = core.clean_text(deadline_info.get("display"))
        if AMBIGUOUS_SHORT_DATE_PATTERN.fullmatch(display):
            continue
        if deadline_info and (
            parsed.get("deadline")
            or parsed.get("deadline_type") not in {"", "unknown"}
        ):
            return deadline_info, text_source

    title = core.clean_text(row.get("title"), 500)
    if title:
        parsed = core.parse_deadline(
            title,
            reference_year=core.infer_reference_year(
                title,
                detail_text or attachment_text,
            ),
        )
        if parsed.get("deadline"):
            return (
                {
                    "period": parsed.get("deadline_raw_text") or title,
                    "display": parsed.get("deadline_display"),
                    "label": "제목 마감표현",
                    "priority": "title",
                    "region": region or None,
                    "detail_host": None,
                    "parsed": parsed,
                    "position": 0,
                },
                "title",
            )

    return {}, ""


def should_replace_existing(
    row: dict[str, Any],
    parsed: dict[str, Any],
    force: bool,
) -> tuple[bool, str]:
    if force:
        return True, "force"

    current_deadline = core.clean_text(row.get("deadline"))
    current_type = core.clean_text(row.get("deadline_type"))
    current_status = core.clean_text(row.get("deadline_status"))
    if not current_deadline:
        return True, "missing_deadline"
    if current_type in {"", "unknown"}:
        return True, "unknown_type"
    if current_status in {"", "없음", "확인 필요"}:
        return True, "review_needed"

    extracted_deadline = core.clean_text(parsed.get("deadline"))
    if extracted_deadline == current_deadline:
        return True, "same_deadline_metadata_refresh"
    return False, "existing_confirmed_deadline"


def merge_temp_extraction(
    current_value: Any,
    deadline_info: dict[str, Any],
    text_source: str,
) -> dict[str, Any]:
    current = as_dict(current_value)
    parsed = as_dict(deadline_info.get("parsed"))
    current[ENRICHMENT_KEY] = {
        "deadline_label": deadline_info.get("label"),
        "deadline_priority": deadline_info.get("priority"),
        "deadline_raw_text": deadline_info.get("display"),
        "deadline_evidence": " ".join(
            part
            for part in [
                core.clean_text(deadline_info.get("label")),
                core.clean_text(deadline_info.get("display")),
            ]
            if part
        ),
        "deadline_confidence": parsed.get("deadline_confidence"),
        "date_memo": parsed.get("date_memo"),
        "detail_host": deadline_info.get("detail_host"),
        "text_source": text_source,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    return current


def build_update_payload(
    row: dict[str, Any],
    deadline_info: dict[str, Any],
    text_source: str,
) -> dict[str, Any]:
    parsed = as_dict(deadline_info.get("parsed"))
    return {
        "deadline_start_date": parsed.get("deadline_start_date"),
        "deadline": parsed.get("deadline"),
        "deadline_type": parsed.get("deadline_type"),
        "deadline_display": deadline_info.get("display")
        or parsed.get("deadline_display"),
        "deadline_status": parsed.get("deadline_status"),
        "is_early_close_possible": bool(
            parsed.get("is_early_close_possible")
        ),
        "temp_extraction_json": merge_temp_extraction(
            row.get("temp_extraction_json"),
            deadline_info,
            text_source,
        ),
    }


def write_csv(path_value: str, rows: list[dict[str, Any]]) -> Path:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "policy_id",
        "region",
        "title",
        "status",
        "replace_reason",
        "text_source",
        "label",
        "priority",
        "deadline_before",
        "deadline_after",
        "deadline_display_before",
        "deadline_display_after",
        "deadline_type_before",
        "deadline_type_after",
        "deadline_status_before",
        "deadline_status_after",
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
        args.policy_id,
    )

    session = requests.Session()
    processed = 0
    extracted = 0
    updated = 0
    skipped = 0
    failed = 0
    report_rows: list[dict[str, Any]] = []

    print(f"target_table={table_name}")
    print("source=technopark")
    print(f"dry_run={dry_run}")
    print(f"force={args.force}")
    print(f"use_stored_detail={args.use_stored_detail}")
    print(f"candidate_rows={len(rows)}")

    for row in rows:
        if args.limit and processed >= args.limit:
            break
        processed += 1
        policy_id = core.clean_text(row.get("policy_id"))
        try:
            detail_text, detail_source = fetch_detail_text(
                session,
                row,
                args.use_stored_detail,
            )
            deadline_info, text_source = extract_deadline_info(
                row,
                detail_text,
                detail_source,
            )
            parsed = as_dict(deadline_info.get("parsed"))
            if not deadline_info or (
                not parsed.get("deadline")
                and parsed.get("deadline_type") == "unknown"
            ):
                skipped += 1
                status = "not_found"
                replace_reason = "deadline_not_found"
            else:
                extracted += 1
                replace, replace_reason = should_replace_existing(
                    row,
                    parsed,
                    args.force,
                )
                if not replace:
                    skipped += 1
                    status = "skipped_existing_confirmed"
                else:
                    update_payload = build_update_payload(
                        row,
                        deadline_info,
                        text_source,
                    )
                    status = "dry_run"
                    if not dry_run:
                        (
                            supabase.table(table_name)
                            .update(update_payload)
                            .eq("policy_id", policy_id)
                            .execute()
                        )
                        updated += 1
                        status = "updated"

            print(
                f"[{processed}] {policy_id} | "
                f"{row.get('deadline') or '-'} -> "
                f"{parsed.get('deadline') or '-'} | {status}"
            )
            report_rows.append(
                {
                    "policy_id": policy_id,
                    "region": row.get("region"),
                    "title": row.get("title"),
                    "status": status,
                    "replace_reason": replace_reason,
                    "text_source": text_source,
                    "label": deadline_info.get("label"),
                    "priority": deadline_info.get("priority"),
                    "deadline_before": row.get("deadline"),
                    "deadline_after": parsed.get("deadline"),
                    "deadline_display_before": row.get("deadline_display"),
                    "deadline_display_after": deadline_info.get("display"),
                    "deadline_type_before": row.get("deadline_type"),
                    "deadline_type_after": parsed.get("deadline_type"),
                    "deadline_status_before": row.get("deadline_status"),
                    "deadline_status_after": parsed.get("deadline_status"),
                    "error_message": "",
                }
            )
        except Exception as exc:
            failed += 1
            print(f"[ERROR] {policy_id}: {exc}")
            report_rows.append(
                {
                    "policy_id": policy_id,
                    "region": row.get("region"),
                    "title": row.get("title"),
                    "status": "failed",
                    "replace_reason": "",
                    "text_source": "",
                    "label": "",
                    "priority": "",
                    "deadline_before": row.get("deadline"),
                    "deadline_after": "",
                    "deadline_display_before": row.get("deadline_display"),
                    "deadline_display_after": "",
                    "deadline_type_before": row.get("deadline_type"),
                    "deadline_type_after": "",
                    "deadline_status_before": row.get("deadline_status"),
                    "deadline_status_after": "",
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
    print(f"Extracted rows: {extracted}")
    print(f"Updated rows: {updated}")
    print(f"Skipped rows: {skipped}")
    print(f"Failed rows: {failed}")


if __name__ == "__main__":
    main()
