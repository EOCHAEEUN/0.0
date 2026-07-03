from __future__ import annotations

import argparse
import os
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

import sync_policy_from_validation as promoter


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

TARGET_TABLE = "policy"
DIRECT_AMOUNT_TYPES = {"support_amount", "subsidy", "voucher"}
EXCLUDED_AMOUNT_TYPES = {"loan", "guarantee", "investment", "tax", "non_cash"}
EXCLUDED_METHOD_KEYWORDS = ("융자", "대출", "보증", "투자유치", "세제")
FINANCE_EXCLUSION_KEYWORDS = (
    "융자",
    "대출",
    "특례보증",
    "신용보증",
    "기업보증",
    "기술보증",
    "보증연계",
    "보증서",
    "이차보전",
    "수출보험",
    "금융지원",
    "정책자금",
    "경영안정자금",
    "육성자금",
    "협력자금",
)
PROMOTABLE_SERVICE_CATEGORIES = {
    "스마트공장",
    "설비/자동화",
    "설비/장비",
    "공정개선",
    "공동장비",
    "에너지효율",
    "시험/인증",
    "R&D/사업화",
}
DIRECT_SERVICE_CATEGORIES = {
    "스마트공장",
    "설비/자동화",
    "설비/장비",
    "공정개선",
    "공동장비",
    "에너지효율",
}
INDIRECT_SERVICE_CATEGORIES = {"시험/인증", "R&D/사업화"}
NOISE_KEYWORDS = {
    "소상공인",
    "카드수수료",
    "관광객",
    "관광",
    "농산물",
    "GAP",
    "폐업",
    "기숙사",
    "숙련기능인력",
    "외국인",
    "게임 기업",
    "전통시장",
    "입찰",
    "전시회",
    "EXPO",
    "수수료지원",
    "일경험",
    "인턴",
    "고용지원",
    "채용",
    "청년일자리",
    "일자리도약",
    "장려금",
    "기술임치",
    "보증용",
    "기업보증",
    "문화콘텐츠기업보증",
    "보증 공고",
    "분쟁 지원",
    "지식재산 국내 분쟁",
}
STALE_YEAR_KEYWORDS = {"2020년", "2021년", "2022년", "2023년", "2024년"}
SOURCE_SELECT = (
    "policy_id,title,organization,url,summary,required_documents,"
    "required_documents_json,required_documents_status,max_amount_actual,"
    "max_amount_status,max_amount_type,max_amount_numeric_manwon,posted_at,"
    "deadline_start_date,deadline,deadline_type,is_early_close_possible,"
    "deadline_display,deadline_status,policy_category,policy_subcategory,"
    "service_category,service_subcategory,max_amount_note,source_name,"
    "source_api_json,max_amount_evidence,employee_min,employee_max,"
    "revenue_min_manwon,revenue_max_manwon,company_age_min,company_age_max,"
    "eligible_company_types,eligibility_text,eligibility_evidence,"
    "eligibility_extraction_status,industry_codes,region,hashtags,"
    "has_capex_keyword,has_manufacturing_code,relevance_score,"
    "support_method,revenue_rules,source_id,temp_extraction_json,"
    "support_primary_category,support_categories,support_items"
)
EXTERNAL_SELECT = SOURCE_SELECT.replace(",relevance_score", "")
VALIDATION_SELECT = SOURCE_SELECT.replace(
    ",support_primary_category,support_categories,support_items",
    "",
)
INDUSTRIAL_SIGNAL_KEYWORDS = {
    "제조",
    "공장",
    "장비",
    "설비",
    "공정",
    "자동화",
    "스마트",
    "반도체",
    "자동차",
    "부품",
    "배터리",
    "소재",
    "시험분석",
    "성능검증",
    "안전성",
    "에너지",
    "FEMS",
    "AX",
    "AI",
}


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_all(supabase: Client, table: str, select: str = "*") -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = supabase.table(table).select(select).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size
    return rows


def amount(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def is_active(row: dict[str, Any], cutoff: str) -> bool:
    deadline = promoter.clean_text(row.get("deadline"))
    return not deadline or deadline[:10] >= cutoff


def has_excluded_method(row: dict[str, Any]) -> bool:
    method = row.get("support_method")
    if isinstance(method, list):
        text = " ".join(str(item) for item in method)
    else:
        text = str(method or "")
    return any(keyword in text for keyword in EXCLUDED_METHOD_KEYWORDS)


def has_finance_exclusion_keyword(row: dict[str, Any]) -> bool:
    text = " ".join(
        promoter.clean_text(row.get(field))
        for field in [
            "title",
            "summary",
            "detail_text",
            "raw_text",
            "attachment_text",
            "max_amount_note",
            "max_amount_evidence",
            "support_method",
        ]
    )
    return any(keyword in text for keyword in FINANCE_EXCLUSION_KEYWORDS)


def has_noise_keyword(row: dict[str, Any]) -> bool:
    text = " ".join(
        promoter.clean_text(row.get(field))
        for field in ["title", "summary", "detail_text", "raw_text"]
    )
    return any(keyword in text for keyword in NOISE_KEYWORDS)


def has_stale_year(row: dict[str, Any]) -> bool:
    text = promoter.clean_text(row.get("title"))
    return any(keyword in text for keyword in STALE_YEAR_KEYWORDS)


def has_industrial_signal(row: dict[str, Any]) -> bool:
    text = " ".join(
        promoter.clean_text(row.get(field))
        for field in ["title", "summary", "detail_text", "raw_text", "service_category"]
    )
    return any(keyword in text for keyword in INDUSTRIAL_SIGNAL_KEYWORDS)


def base_roi_candidate(row: dict[str, Any], *, existing_ids: set[str], cutoff: str) -> bool:
    policy_id = promoter.clean_text(row.get("policy_id"))
    amount_type = promoter.normalize_amount_type_key(row.get("max_amount_type"))
    if not policy_id or policy_id in existing_ids:
        return False
    if not is_active(row, cutoff):
        return False
    if amount(row.get("max_amount_numeric_manwon")) <= 0:
        return False
    if amount_type not in DIRECT_AMOUNT_TYPES or amount_type in EXCLUDED_AMOUNT_TYPES:
        return False
    if has_excluded_method(row) or has_finance_exclusion_keyword(row):
        return False
    if row.get("has_manufacturing_code") is not True:
        return False
    if promoter.clean_text(row.get("service_category")) not in PROMOTABLE_SERVICE_CATEGORIES:
        return False
    if has_noise_keyword(row) or has_stale_year(row):
        return False
    return True


def external_candidate(row: dict[str, Any], *, existing_ids: set[str], cutoff: str) -> bool:
    if not base_roi_candidate(row, existing_ids=existing_ids, cutoff=cutoff):
        return False
    category = promoter.clean_text(row.get("service_category"))
    if category in DIRECT_SERVICE_CATEGORIES:
        return True
    return has_industrial_signal(row)


def validation_candidate(row: dict[str, Any], *, existing_ids: set[str], cutoff: str) -> bool:
    if not base_roi_candidate(row, existing_ids=existing_ids, cutoff=cutoff):
        return False

    category = promoter.clean_text(row.get("service_category"))
    score = int(amount(row.get("relevance_score")))
    if category in DIRECT_SERVICE_CATEGORIES:
        return score >= 6 or row.get("has_capex_keyword") is True or has_industrial_signal(row)
    if category in INDIRECT_SERVICE_CATEGORIES:
        return score >= 10 or row.get("has_capex_keyword") is True or has_industrial_signal(row)
    return False


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Promote ROI-direct policy candidates from external/validation candidate tables."
    )
    parser.add_argument(
        "--source-table",
        action="append",
        choices=["policy_external_collected", "policy_validation_new"],
        default=[],
        help="Source table to evaluate. May be repeated. Defaults to both.",
    )
    parser.add_argument("--cutoff", default=date.today().isoformat())
    parser.add_argument("--apply", action="store_true", help="Actually upsert. Default is dry-run.")
    parser.add_argument("--batch-size", type=int, default=100)
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    source_tables = args.source_table or ["policy_external_collected", "policy_validation_new"]
    supabase = client()
    existing_ids = {
        promoter.clean_text(row.get("policy_id"))
        for row in fetch_all(supabase, TARGET_TABLE, "policy_id")
        if promoter.clean_text(row.get("policy_id"))
    }

    all_payloads: list[dict[str, Any]] = []
    per_source: dict[str, int] = {}

    for table in source_tables:
        rows = fetch_all(
            supabase,
            table,
            VALIDATION_SELECT if table == "policy_validation_new" else EXTERNAL_SELECT,
        )
        if table == "policy_external_collected":
            selected = [
                row for row in rows if external_candidate(row, existing_ids=existing_ids, cutoff=args.cutoff)
            ]
        else:
            selected = [
                row for row in rows if validation_candidate(row, existing_ids=existing_ids, cutoff=args.cutoff)
            ]

        payloads = [
            payload
            for row in selected
            if (payload := promoter.build_policy_payload(row, source_table=table))
        ]
        per_source[table] = len(payloads)
        all_payloads.extend(payloads)

        print(f"{table}: source_rows={len(rows)} promotable={len(payloads)}")
        for payload in payloads[:10]:
            print(
                "  preview | "
                f"{payload.get('policy_id')} | "
                f"{payload.get('roi_support_type')} | "
                f"amount={payload.get('max_amount')} | "
                f"{payload.get('title')}"
            )

    print(f"total_promotable={len(all_payloads)} apply={args.apply}")
    if not args.apply:
        print("Dry-run complete. Add --apply to upsert.")
        return

    upserted = 0
    for start in range(0, len(all_payloads), args.batch_size):
        batch = all_payloads[start:start + args.batch_size]
        if not batch:
            continue
        supabase.table(TARGET_TABLE).upsert(batch, on_conflict="policy_id").execute()
        upserted += len(batch)
        print(f"  upserted {upserted}/{len(all_payloads)}")

    print(f"Done. Upserted: {upserted} per_source={per_source}")


if __name__ == "__main__":
    main()
