from __future__ import annotations

import argparse
import json
import os
import re
from typing import Any

from supabase import create_client

import hwp_attachment_pipeline_common as common
import policy_deadline_normalization as deadline_norm
import upload_final as core


LOG_FIELDS = [
    "policy_id",
    "title",
    "old_max_amount",
    "new_max_amount",
    "amount_status",
    "old_deadline",
    "new_deadline",
    "deadline_status",
    "amount_evidence",
    "deadline_evidence",
    "error_message",
    "created_at",
]


DESIRED_COLUMNS = [
    "policy_id",
    "title",
    "organization",
    "attachment_text",
    "source_api_json",
    "raw_json",
    "raw_text",
    "eligibility_text",
    "max_amount",
    "max_amount_numeric_manwon",
    "max_amount_actual",
    "max_amount_status",
    "max_amount_type",
    "max_amount_evidence",
    "max_amount_note",
    "deadline",
    "deadline_status",
    "deadline_type",
    "deadline_display",
    "deadline_note",
    "deadline_evidence",
    "temp_extraction_json",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Re-extract amount and deadline using attachment_text.")
    parser.add_argument("--target-table", default=common.DEFAULT_TABLE)
    parser.add_argument("--dry-run", type=int, choices=[0, 1], default=1)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--policy-id", action="append", default=[])
    return parser.parse_args()


def supabase_client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    return create_client(url, key)


def table_columns(client, table_name: str) -> set[str]:
    rows = client.table(table_name).select("*").limit(1).execute().data or []
    return set(rows[0].keys()) if rows else {"policy_id"}


def fetch_rows(client, table_name: str, policy_ids: list[str], limit: int) -> tuple[list[dict[str, Any]], set[str]]:
    columns = table_columns(client, table_name)
    select_columns = ",".join(column for column in DESIRED_COLUMNS if column in columns)
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 500
    while True:
        page = client.table(table_name).select(select_columns).range(offset, offset + page_size - 1).execute().data or []
        rows.extend(page)
        if len(page) < page_size or (limit and len(rows) >= limit):
            break
        offset += page_size
    if policy_ids:
        wanted = set(policy_ids)
        rows = [row for row in rows if common.clean_text(row.get("policy_id")) in wanted]
    if limit:
        rows = rows[:limit]
    return rows, columns


def stringify_source_api(value: Any) -> str:
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value or {}, ensure_ascii=False)
    except TypeError:
        return ""


def extraction_source(row: dict[str, Any]) -> str:
    source_json = row.get("source_api_json")
    if source_json is None:
        source_json = row.get("raw_json")
    parts = [
        row.get("attachment_text"),
        stringify_source_api(source_json),
        row.get("raw_text"),
        row.get("eligibility_text"),
        row.get("title"),
        row.get("organization"),
    ]
    return core.clean_text("\n".join(str(part or "") for part in parts), 60000)


def extract_amount(row: dict[str, Any], source: str) -> dict[str, Any]:
    source_json = row.get("source_api_json")
    if source_json is None:
        source_json = row.get("raw_json")
    item = {
        "pblancId": row.get("policy_id"),
        "pblancNm": row.get("title"),
        "jrsdInsttNm": row.get("organization"),
        "bsnsSumryCn": stringify_source_api(source_json),
    }
    result = core.extract_amount_info(item, source)
    amount_type = core.clean_text(result.get("max_amount_type"))
    status = core.clean_text(result.get("max_amount_status"))
    numeric = result.get("max_amount_numeric_manwon")
    roi_direct = amount_type in {"subsidy", "voucher", "support_amount"} and numeric is not None
    if amount_type == "loan":
        roi_direct = False
        if status == "확정":
            result["max_amount_status"] = "확인 필요"
            result["max_amount_note"] = "융자 한도는 ROI 직접 차감 금액이 아니므로 검토 필요"
    result["roi_direct_deductible"] = roi_direct
    return result


def normalize_deadline_status(parsed: dict[str, Any]) -> str:
    deadline_type = core.clean_text(parsed.get("deadline_type"))
    status = core.clean_text(parsed.get("deadline_status"))
    raw = core.clean_text(parsed.get("deadline_raw_text"))
    if parsed.get("deadline"):
        return "confirmed"
    if deadline_type in {"budget_exhaustion", "first_come"} or "예산" in raw and "소진" in raw:
        return "budget_until_exhausted"
    if any(token in raw for token in ["상시", "수시"]):
        return "always_open"
    if any(token in raw for token in ["차수", "회차", "분기"]):
        return "round_based"
    if any(token in raw for token in ["별도", "추후"]):
        return "separate_notice"
    if status in {"확인 필요", "조건부"}:
        return "needs_review"
    return "not_found"


def extract_deadline(source: str) -> dict[str, Any]:
    windows = []
    for label in ["신청기간", "접수기간", "공고기간", "마감", "제출기한", "접수마감"]:
        window = core.extract_label_window(source, [label], window=900)
        if window:
            windows.append(window)
    target = "\n".join(windows) or source[:4000]
    parsed = core.parse_deadline(target)
    parsed["deadline_status_normalized"] = normalize_deadline_status(parsed)
    note_type = deadline_norm.classify_deadline_note(
        parsed.get("deadline_type"),
        parsed.get("deadline_status_normalized"),
        parsed.get("deadline_status"),
        parsed.get("deadline_display"),
        parsed.get("deadline_raw_text"),
        parsed.get("deadline_evidence"),
    )
    if note_type:
        parsed["deadline_note_normalized"] = deadline_norm.CANONICAL_DEADLINE_NOTES[note_type]
    return parsed


def merged_temp_extraction(row: dict[str, Any], amount: dict[str, Any], deadline: dict[str, Any], amount_status: str) -> dict[str, Any]:
    existing = row.get("temp_extraction_json")
    if isinstance(existing, dict):
        merged = dict(existing)
    elif isinstance(existing, str):
        try:
            parsed = json.loads(existing)
            merged = parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            merged = {}
    else:
        merged = {}
    merged["hwp_attachment_amount"] = {
        "amount_type": amount.get("max_amount_type"),
        "amount_manwon": amount.get("max_amount_numeric_manwon"),
        "roi_direct_deductible": amount.get("roi_direct_deductible"),
        "evidence": amount.get("max_amount_evidence"),
        "status": amount_status,
    }
    merged["hwp_attachment_deadline"] = deadline
    return merged


def main() -> None:
    args = parse_args()
    dry_run = bool(args.dry_run) and not args.apply
    common.ensure_directories()
    client = supabase_client()
    rows, columns = fetch_rows(client, args.target_table, args.policy_id, args.limit)
    log_rows: list[dict[str, Any]] = []

    for row in rows:
        policy_id = common.clean_text(row.get("policy_id"))
        title = common.clean_text(row.get("title"))
        error = ""
        amount = {}
        deadline = {}
        update_payload: dict[str, Any] = {}
        try:
            source = extraction_source(row)
            amount = extract_amount(row, source)
            deadline = extract_deadline(source)
            amount_status = "extracted" if amount.get("max_amount_numeric_manwon") is not None else "needs_review"
            if amount.get("max_amount_type") == "loan":
                amount_status = "needs_review"
            update_payload.update({
                "max_amount_actual": amount.get("max_amount_actual"),
                "max_amount_status": amount.get("max_amount_status"),
                "max_amount_type": amount.get("max_amount_type"),
                "max_amount_numeric_manwon": amount.get("max_amount_numeric_manwon"),
                "max_amount_evidence": amount.get("max_amount_evidence"),
                "max_amount_note": amount.get("max_amount_note"),
                "amount_extraction_status": amount_status,
                "deadline": deadline.get("deadline"),
                "deadline_status": deadline.get("deadline_status_normalized"),
                "deadline_type": deadline.get("deadline_type"),
                "deadline_display": deadline.get("deadline_display"),
                "deadline_evidence": deadline.get("deadline_evidence"),
            })
            if deadline.get("deadline_note_normalized"):
                update_payload["deadline_note"] = deadline.get("deadline_note_normalized")
            if "max_amount" in columns and amount.get("max_amount_numeric_manwon") is not None:
                update_payload["max_amount"] = amount.get("max_amount_numeric_manwon")
            update_payload["temp_extraction_json"] = merged_temp_extraction(row, amount, deadline, amount_status)
            update_payload = {key: value for key, value in update_payload.items() if key in columns}
            if not dry_run:
                payload = dict(update_payload)
                optional_keys = [
                    "amount_extraction_status",
                    "deadline_evidence",
                    "deadline_display",
                    "temp_extraction_json",
                ]
                while True:
                    try:
                        client.table(args.target_table).update(payload).eq("policy_id", policy_id).execute()
                        break
                    except Exception:
                        if not optional_keys:
                            raise
                        payload.pop(optional_keys.pop(0), None)
        except Exception as exc:
            error = str(exc)
        log_rows.append({
            "policy_id": policy_id,
            "title": title,
            "old_max_amount": row.get("max_amount_numeric_manwon") or row.get("max_amount_actual") or "",
            "new_max_amount": amount.get("max_amount_numeric_manwon") or amount.get("max_amount_actual") or "",
            "amount_status": update_payload.get("amount_extraction_status") or "not_found",
            "old_deadline": row.get("deadline") or "",
            "new_deadline": deadline.get("deadline") or "",
            "deadline_status": deadline.get("deadline_status_normalized") or "not_found",
            "amount_evidence": amount.get("max_amount_evidence") or "",
            "deadline_evidence": deadline.get("deadline_evidence") or "",
            "error_message": error,
            "created_at": common.utc_now(),
        })
        print(
            f"{policy_id} | amount={log_rows[-1]['amount_status']} "
            f"deadline={log_rows[-1]['deadline_status']} dry_run={dry_run}"
        )

    common.write_csv(common.LOG_DIR / "amount_deadline_enrich_log.csv", log_rows, LOG_FIELDS)
    print(f"processed={len(rows)} dry_run={dry_run}")


if __name__ == "__main__":
    main()
