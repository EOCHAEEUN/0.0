from __future__ import annotations

import argparse
import os
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


SCRIPT_DIR = Path(__file__).resolve().parent

for env_path in [
    Path.cwd() / ".env",
    SCRIPT_DIR / ".env",
    SCRIPT_DIR.parent / ".env",
    SCRIPT_DIR.parent.parent / ".env",
    SCRIPT_DIR / "backend" / ".env",
    SCRIPT_DIR.parent / "backend" / ".env",
    SCRIPT_DIR.parent.parent / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()

DEFAULT_SOURCE_TABLE = os.getenv("POLICY_VALIDATION_TARGET_TABLE", "policy_validation_new").strip()
DEFAULT_TARGET_TABLE = os.getenv("POLICY_SYNC_TARGET_TABLE", "policy").strip()
DEFAULT_BATCH_SIZE = int(os.getenv("POLICY_SYNC_BATCH_SIZE", "100"))

AMOUNT_STATUS_CONFIRMED = "\ud655\uc815"
AMOUNT_STATUS_RATIO_ONLY = "\ube44\uc728 \ud655\uc778"
AMOUNT_STATUS_NEEDS_REVIEW = "\ud655\uc778 \ud544\uc694"


def clean_text(value: Any, max_len: int | None = None) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def clean_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    text = str(value).strip()
    return [text] if text else []


def numeric_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def date_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError:
        return None


def normalize_amount_status(status: Any, amount: Any) -> str | None:
    text = clean_text(status)
    if text in {AMOUNT_STATUS_CONFIRMED, "extracted"}:
        return "extracted"
    if text in {AMOUNT_STATUS_RATIO_ONLY, "ratio_only"}:
        return "no_cash_amount"
    if text in {AMOUNT_STATUS_NEEDS_REVIEW, "not_found"}:
        return "needs_review"
    if text:
        return text
    return "extracted" if amount is not None else "pending"


def build_policy_url(row: dict[str, Any]) -> str:
    url = clean_text(row.get("url"))
    if url:
        return url

    source_api_json = row.get("source_api_json")
    if isinstance(source_api_json, dict):
        api_url = clean_text(source_api_json.get("pblancUrl"))
        if api_url:
            return api_url

    policy_id = clean_text(row.get("policy_id"))
    if policy_id:
        return f"https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId={policy_id}"

    return "https://www.bizinfo.go.kr"


def build_deadline_note(row: dict[str, Any]) -> str | None:
    parts = []
    display = clean_text(row.get("deadline_display"))
    deadline_type = clean_text(row.get("deadline_type"))
    deadline_status = clean_text(row.get("deadline_status"))

    if display:
        parts.append(display)
    if deadline_type:
        parts.append(f"type={deadline_type}")
    if deadline_status:
        parts.append(f"status={deadline_status}")
    if row.get("is_early_close_possible") is True:
        parts.append("예산 소진 시 조기마감 가능")

    return " / ".join(parts) if parts else None


def build_policy_payload(row: dict[str, Any]) -> dict[str, Any] | None:
    policy_id = clean_text(row.get("policy_id"))
    title = clean_text(row.get("title"))
    organization = clean_text(row.get("organization")) or "기관 미상"
    if not policy_id or not title:
        return None

    max_amount = numeric_or_none(row.get("max_amount_numeric_manwon"))

    payload: dict[str, Any] = {
        "policy_id": policy_id,
        "title": title,
        "organization": organization,
        "policy_category": row.get("policy_category"),
        "policy_subcategory": row.get("policy_subcategory"),
        "service_category": row.get("service_category"),
        "service_subcategory": row.get("service_subcategory"),
        "max_amount": max_amount,
        "max_amount_actual": row.get("max_amount_actual"),
        "max_amount_note": row.get("max_amount_note"),
        "max_amount_source": "policy_validation_new",
        "max_amount_evidence": row.get("max_amount_evidence"),
        "amount_extraction_status": normalize_amount_status(row.get("max_amount_status"), max_amount),
        "posted_at": date_or_none(row.get("posted_at")),
        "deadline": date_or_none(row.get("deadline")),
        "deadline_display": row.get("deadline_display"),
        "deadline_note": build_deadline_note(row),
        "required_documents": row.get("required_documents"),
        "required_documents_json": row.get("required_documents_json"),
        "required_documents_status": row.get("required_documents_status"),
        "required_documents_count": numeric_or_none(row.get("required_documents_count")),
        "industry_codes": clean_list(row.get("industry_codes")),
        "region": row.get("region"),
        "employee_min": numeric_or_none(row.get("employee_min")),
        "employee_max": numeric_or_none(row.get("employee_max")),
        "revenue_min_manwon": numeric_or_none(row.get("revenue_min_manwon")),
        "revenue_max_manwon": numeric_or_none(row.get("revenue_max_manwon")),
        "revenue_rules": row.get("revenue_rules"),
        "company_age_min": numeric_or_none(row.get("company_age_min")),
        "company_age_max": numeric_or_none(row.get("company_age_max")),
        "eligible_company_types": clean_list(row.get("eligible_company_types")),
        "eligibility_text": row.get("eligibility_text"),
        "eligibility_extraction_status": row.get("eligibility_extraction_status"),
        "eligibility_evidence": row.get("eligibility_evidence"),
        "url": build_policy_url(row),
        "summary": row.get("summary"),
        "source_name": row.get("source_name") or "bizinfo",
        "source_id": policy_id,
        "hashtags": clean_list(row.get("hashtags")),
        "relevance_score": numeric_or_none(row.get("relevance_score")),
        "is_selected": row.get("is_selected"),
        "selected_reason": row.get("selected_reason"),
    }

    if "support_method" in row:
        payload["support_method"] = row.get("support_method")

    return {key: value for key, value in payload.items() if value is not None}


def fetch_rows(
    supabase: Client,
    source_table: str,
    *,
    batch_size: int,
    selected_only: bool,
    limit: int,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0

    while True:
        remaining = limit - len(rows) if limit > 0 else batch_size
        if limit > 0 and remaining <= 0:
            break

        page_size = min(batch_size, remaining) if limit > 0 else batch_size
        end = start + page_size - 1
        query = supabase.table(source_table).select("*").order("policy_id").range(start, end)
        if selected_only:
            query = query.eq("is_selected", True)

        response = query.execute()
        batch = response.data or []
        rows.extend(batch)

        if len(batch) < page_size:
            break
        start += page_size

    return rows


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync policy_validation_new rows into the service policy table."
    )
    parser.add_argument("--source-table", default=DEFAULT_SOURCE_TABLE)
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--limit", type=int, default=0, help="0 means all rows")
    parser.add_argument("--selected-only", action="store_true", help="Sync only rows where is_selected=true")
    parser.add_argument("--execute", action="store_true", help="Actually upsert into policy. Default is dry-run.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    if args.target_table != "policy":
        raise ValueError(f"target table must be policy, got {args.target_table}")
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    print(f"Source table: {args.source_table}")
    print(f"Target table: {args.target_table}")
    print(f"Mode: {'EXECUTE' if args.execute else 'DRY-RUN'}")
    print(f"Selected only: {args.selected_only}")
    print(f"Limit: {args.limit} (0 means all)")

    rows = fetch_rows(
        supabase,
        args.source_table,
        batch_size=args.batch_size,
        selected_only=args.selected_only,
        limit=args.limit,
    )
    payloads = [payload for row in rows if (payload := build_policy_payload(row))]

    print(f"Fetched rows: {len(rows)}")
    print(f"Mapped payloads: {len(payloads)}")

    for payload in payloads[:5]:
        print(
            "  preview | "
            f"{payload.get('policy_id')} | "
            f"amount={payload.get('max_amount')} | "
            f"status={payload.get('amount_extraction_status')} | "
            f"deadline={payload.get('deadline') or '-'} | "
            f"selected={payload.get('is_selected')}"
        )

    if not args.execute:
        print("Dry-run complete. Add --execute to upsert into policy.")
        return

    upserted = 0
    for start in range(0, len(payloads), args.batch_size):
        batch = payloads[start:start + args.batch_size]
        if not batch:
            continue
        supabase.table(args.target_table).upsert(batch, on_conflict="policy_id").execute()
        upserted += len(batch)
        print(f"  upserted {upserted}/{len(payloads)}")

    print(f"Done. Upserted: {upserted}")


if __name__ == "__main__":
    main()
