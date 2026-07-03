from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from sync_policy_from_validation import amount_type_to_korean, clean_text, numeric_or_none


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
DEFAULT_TARGET_TABLE = os.getenv("POLICY_SYNC_TARGET_TABLE", "policy").strip()

STRONG_LINKED_SUPPORT_KEYWORDS = (
    "장비 공동활용",
    "공동활용",
    "장비활용",
    "장비 활용",
    "장비 임차지원",
    "시험분석",
    "시험 분석",
    "시험장비",
    "시험평가",
    "시험 평가",
    "인증 지원",
    "인허가 지원",
    "컨설팅",
    "현장솔루션",
    "기술지도",
    "구축지도",
    "멘토단",
    "멘토링",
    "오픈랩",
    "실증 지원",
    "제작 지원",
    "시제품",
    "공정개선",
    "디지털전환",
    "스마트공장 구축",
    "AI솔루션 실증",
)
LOW_VALUE_KEYWORDS = (
    "수요조사",
    "설명회",
    "세미나",
    "포럼",
    "행사",
    "박람회",
    "교육",
    "인력양성",
    "고급인력",
    "숙련기능인력",
    "채용",
    "취업",
    "구인기업",
    "구직자",
    "일자리",
    "인턴",
    "인증제 시행",
    "지정계획",
    "신규신청",
    "유효기간 연장",
    "추천 모집공고",
    "전환추천",
    "기술수요조사",
)


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_all(supabase: Client, table: str, select: str) -> list[dict[str, Any]]:
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


def combined_text(row: dict[str, Any]) -> str:
    return " ".join(
        clean_text(row.get(field))
        for field in [
            "title",
            "summary",
            "support_method",
            "support_items",
            "service_category",
            "service_subcategory",
            "policy_category",
            "max_amount_note",
            "max_amount_evidence",
        ]
    )


def classify_missing_amount_linked(row: dict[str, Any]) -> tuple[str, str]:
    title = clean_text(row.get("title"))
    text = combined_text(row)
    title_has_strong_signal = any(keyword in title for keyword in STRONG_LINKED_SUPPORT_KEYWORDS)
    title_has_low_value_signal = any(keyword in title for keyword in LOW_VALUE_KEYWORDS)
    has_strong_linked_signal = any(keyword in text for keyword in STRONG_LINKED_SUPPORT_KEYWORDS)
    has_low_value_signal = any(keyword in text for keyword in LOW_VALUE_KEYWORDS)

    if title_has_low_value_signal and not title_has_strong_signal:
        return (
            "계산 제외",
            "금액 미기재이며 제목 기준 수요조사/교육/행사/단순 안내 성격이 강해 추천 화면에서 제외",
        )
    if title_has_strong_signal:
        return (
            "연계 추천",
            "금액은 미기재이나 제목 기준 장비활용/시험분석/인증지원/컨설팅/기술지도 등 실질 지원 내용이 명확해 연계 추천 유지",
        )
    if has_low_value_signal and not has_strong_linked_signal:
        return (
            "계산 제외",
            "금액 미기재이며 수요조사/교육/행사/단순 안내 등 실질 지원 내용이 약해 추천 화면에서 제외",
        )
    if has_strong_linked_signal:
        return (
            "연계 추천",
            "금액은 미기재이나 장비활용/시험분석/인증/컨설팅/기술지도 등 실질 지원 내용이 명확해 연계 추천 유지",
        )
    return (
        "계산 제외",
        "금액 미기재이며 수요조사/교육/행사/단순 안내 등 실질 지원 내용이 약해 추천 화면에서 제외",
    )


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refine amount-missing linked policies into real linked support or recommendation exclusion."
    )
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--apply", action="store_true", help="Actually update DB. Default is dry-run.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    rows = fetch_all(
        supabase,
        args.target_table,
        (
            "policy_id,title,summary,support_method,support_items,service_category,"
            "service_subcategory,policy_category,max_amount,max_amount_type,max_amount_type_ko,"
            "max_amount_note,max_amount_evidence,raw_text,attachment_text,roi_support_type"
        ),
    )

    targets = [
        row
        for row in rows
        if row.get("roi_support_type") == "연계 추천"
        and amount_type_to_korean(row.get("max_amount_type"), row.get("max_amount")) == "금액 미기재"
        and numeric_or_none(row.get("max_amount")) is None
    ]

    counts: dict[str, int] = {}
    changed = 0
    previews: list[tuple[str, str, str]] = []

    for row in targets:
        policy_id = clean_text(row.get("policy_id"))
        if not policy_id:
            continue
        next_type, reason = classify_missing_amount_linked(row)
        counts[next_type] = counts.get(next_type, 0) + 1
        previews.append((policy_id, next_type, clean_text(row.get("title"), 90)))
        payload = {
            "roi_support_type": next_type,
            "roi_support_reason": reason,
            "roi_support_synced_at": datetime.now(timezone.utc).isoformat(),
        }
        if row.get("roi_support_type") != next_type:
            changed += 1
            if args.apply:
                supabase.table(args.target_table).update(payload).eq("policy_id", policy_id).execute()

    print(f"target_rows={len(targets)}")
    print(f"updated={changed if args.apply else 0} would_update={0 if args.apply else changed}")
    print(f"classification_counts={counts}")
    for policy_id, next_type, title in previews[:30]:
        print(f"preview | {next_type} | {policy_id} | {title}")


if __name__ == "__main__":
    main()
