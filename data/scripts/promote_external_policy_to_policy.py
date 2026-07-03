from __future__ import annotations

import argparse
import csv
import re
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from supabase import Client, create_client

import sync_policy_from_validation as promoter


SOURCE_TABLE = "policy_external_collected"
TARGET_TABLE = "policy"
GEMINI_ENRICHMENT_KEY = "gemini_policy_enrichment_v7"
CONDITIONAL_DEADLINE_TYPES = {
    "always_open",
    "first_come",
    "budget_exhaustion",
}
REQUIRED_FIELDS = {
    "title": "제목 없음",
    "organization": "기관 없음",
    "url": "URL 없음",
    "summary": "요약 없음",
}
DEFAULT_CSV_OUTPUT = (
    "data/processed/external_policy_promotion_preview.csv"
)
QUALIFICATION_AMOUNT_SIGNALS = {
    "연봉",
    "매출",
    "자부담",
    "자기부담",
    "기업부담",
    "본인부담",
    "부담금",
}
DIRECT_SUPPORT_AMOUNT_SIGNALS = {
    "정부지원금",
    "기관지원금",
    "보조금",
    "지원금",
    "지원액",
    "지원한도",
    "지원 규모",
    "지원규모",
    "지원 비용",
    "지원비",
}
TITLE_NOISE_PATTERN = re.compile(
    r"[\s\-_/·ㆍ:;,.()[\]{}「」『』【】<>]+"
)
TITLE_PREFIX_PATTERN = re.compile(
    r"^(?:공고|안내|모집|지원사업)+"
)
REVISION_TITLE_PATTERN = re.compile(
    r"(?:수정공고|수정|연장공고|연장|재공고|추가공고|추가모집|"
    r"\d+\s*차|차수)"
)
BIZINFO_DUPLICATE_BLOCK_STATUSES = {
    "exact_duplicate",
    "revision_candidate",
    "review_candidate",
}
REGION_ALIASES = {
    "서울특별시": "서울",
    "부산광역시": "부산",
    "대구광역시": "대구",
    "인천광역시": "인천",
    "광주광역시": "광주",
    "대전광역시": "대전",
    "울산광역시": "울산",
    "세종특별자치시": "세종",
    "경기도": "경기",
    "강원특별자치도": "강원",
    "강원도": "강원",
    "충청북도": "충북",
    "충청남도": "충남",
    "전북특별자치도": "전북",
    "전라북도": "전북",
    "전라남도": "전남",
    "경상북도": "경북",
    "경상남도": "경남",
    "제주특별자치도": "제주",
    "제주도": "제주",
}
REGION_NAMES = {
    *REGION_ALIASES.values(),
    *REGION_ALIASES.keys(),
}


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate policy_external_collected rows and promote only "
            "active, Gemini-reviewed policies into policy."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually upsert eligible rows. Default is dry-run.",
    )
    parser.add_argument(
        "--as-of",
        default=date.today().isoformat(),
        help="Eligibility date in YYYY-MM-DD format. Default is today.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=promoter.DEFAULT_BATCH_SIZE,
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Evaluate at most this many source rows. 0 means all.",
    )
    parser.add_argument(
        "--policy-id",
        action="append",
        default=[],
        help="Evaluate only this policy_id. May be supplied multiple times.",
    )
    parser.add_argument(
        "--csv-output",
        default=DEFAULT_CSV_OUTPUT,
        help="Promotion eligibility report path.",
    )
    return parser.parse_args()


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def parse_date(value: Any) -> date | None:
    text = promoter.clean_text(value)
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def normalized_identity(value: Any) -> str:
    return re.sub(
        r"\s+",
        " ",
        promoter.clean_text(value).lower(),
    ).strip()


def normalize_title(value: Any, *, remove_revision: bool = False) -> str:
    text = promoter.clean_text(value).lower()
    text = re.sub(r"^\s*\[[^\]]{1,30}\]\s*", "", text)
    text = re.sub(r"^\s*\([^)]*공고[^)]*\)\s*", "", text)
    if remove_revision:
        text = REVISION_TITLE_PATTERN.sub("", text)
    text = TITLE_NOISE_PATTERN.sub("", text)
    return TITLE_PREFIX_PATTERN.sub("", text)


def normalize_organization(value: Any) -> str:
    text = normalize_title(value)
    aliases = {
        "중소벤처기업부": "중기부",
        "중소벤처기업진흥공단": "중진공",
        "한국에너지공단": "에너지공단",
        "스마트공장사업관리시스템": "스마트공장",
    }
    for original, replacement in aliases.items():
        text = text.replace(
            normalize_title(original),
            normalize_title(replacement),
        )
    return text


def organization_matches(left: Any, right: Any) -> bool:
    left_text = normalize_organization(left)
    right_text = normalize_organization(right)
    if not left_text or not right_text:
        return False
    return (
        left_text == right_text
        or left_text in right_text
        or right_text in left_text
    )


def extract_region(row: dict[str, Any]) -> str:
    text = " ".join(
        promoter.clean_text(row.get(field))
        for field in ["region", "title", "organization"]
    )
    for name in sorted(REGION_NAMES, key=len, reverse=True):
        if name in text:
            return REGION_ALIASES.get(name, name)
    return ""


def deadline_difference_days(
    left: Any,
    right: Any,
) -> int | None:
    left_date = parse_date(left)
    right_date = parse_date(right)
    if left_date is None or right_date is None:
        return None
    return abs((left_date - right_date).days)


def title_similarity(left: Any, right: Any) -> float:
    left_text = normalize_title(left)
    right_text = normalize_title(right)
    if not left_text or not right_text:
        return 0.0
    return SequenceMatcher(None, left_text, right_text).ratio()


def classify_bizinfo_duplicate(
    external: dict[str, Any],
    bizinfo: dict[str, Any],
) -> dict[str, Any]:
    strict_left = normalize_title(external.get("title"))
    strict_right = normalize_title(bizinfo.get("title"))
    base_left = normalize_title(
        external.get("title"),
        remove_revision=True,
    )
    base_right = normalize_title(
        bizinfo.get("title"),
        remove_revision=True,
    )
    similarity = title_similarity(
        external.get("title"),
        bizinfo.get("title"),
    )
    base_similarity = (
        SequenceMatcher(None, base_left, base_right).ratio()
        if base_left and base_right
        else 0.0
    )
    organization_match = organization_matches(
        external.get("organization"),
        bizinfo.get("organization"),
    )
    external_region = extract_region(external)
    bizinfo_region = extract_region(bizinfo)
    region_match: bool | None = None
    if external_region and bizinfo_region:
        region_match = external_region == bizinfo_region
    deadline_days = deadline_difference_days(
        external.get("deadline"),
        bizinfo.get("deadline"),
    )
    same_deadline = deadline_days == 0
    strong_cross_region_match = (
        strict_left == strict_right
        or (similarity >= 0.94 and same_deadline)
    )

    status = "unique"
    reason = ""
    if region_match is False and not strong_cross_region_match:
        reason = "지역이 서로 달라 중복에서 제외"
    elif strict_left and strict_left == strict_right and (
        same_deadline or organization_match
    ):
        status = "exact_duplicate"
        reason = "정규화 제목 동일 및 기관/마감일 일치"
    elif (
        base_left
        and base_left == base_right
        and (
            organization_match
            or deadline_days is None
            or deadline_days <= 14
        )
    ):
        status = "revision_candidate"
        reason = "수정·연장·재공고 표현 제거 후 제목 동일"
    elif (
        similarity >= 0.92
        and (
            same_deadline
            or organization_match
            or (
                deadline_days is not None
                and deadline_days <= 14
            )
        )
    ):
        status = "revision_candidate"
        reason = "제목 고유사도 및 기관/마감일 근접"
    elif (
        max(similarity, base_similarity) >= 0.86
        and (
            organization_match
            or deadline_days is None
            or deadline_days <= 30
        )
    ):
        status = "review_candidate"
        reason = "기업마당 유사 공고 수동 검수 필요"

    return {
        "status": status,
        "policy_id": promoter.clean_text(bizinfo.get("policy_id")),
        "title": promoter.clean_text(bizinfo.get("title")),
        "organization": promoter.clean_text(
            bizinfo.get("organization")
        ),
        "deadline": promoter.clean_text(bizinfo.get("deadline")),
        "title_similarity": round(similarity, 4),
        "base_title_similarity": round(base_similarity, 4),
        "organization_match": organization_match,
        "external_region": external_region,
        "bizinfo_region": bizinfo_region,
        "region_match": region_match,
        "deadline_difference_days": deadline_days,
        "reason": reason,
    }


def best_bizinfo_duplicate(
    external: dict[str, Any],
    bizinfo_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    best: dict[str, Any] = {"status": "unique"}
    rank = {
        "unique": 0,
        "review_candidate": 1,
        "revision_candidate": 2,
        "exact_duplicate": 3,
    }
    for bizinfo in bizinfo_rows:
        candidate = classify_bizinfo_duplicate(external, bizinfo)
        candidate_key = (
            rank[candidate["status"]],
            candidate.get("base_title_similarity") or 0,
            candidate.get("title_similarity") or 0,
            bool(candidate.get("organization_match")),
            candidate.get("region_match") is not False,
            -(
                candidate["deadline_difference_days"]
                if candidate.get("deadline_difference_days") is not None
                else 9999
            ),
        )
        best_key = (
            rank.get(best.get("status"), 0),
            best.get("base_title_similarity") or 0,
            best.get("title_similarity") or 0,
            bool(best.get("organization_match")),
            best.get("region_match") is not False,
            -(
                best["deadline_difference_days"]
                if best.get("deadline_difference_days") is not None
                else 9999
            ),
        )
        if candidate_key > best_key:
            best = candidate
    return best


def duplicate_losers(
    rows: list[dict[str, Any]],
) -> dict[str, str]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in rows:
        key = (
            normalized_identity(row.get("organization")),
            normalized_identity(row.get("title")),
        )
        if not all(key):
            continue
        grouped.setdefault(key, []).append(row)

    losers: dict[str, str] = {}
    for group in grouped.values():
        if len(group) < 2:
            continue
        ordered = sorted(
            group,
            key=lambda row: (
                parse_date(row.get("posted_at")) or date.min,
                promoter.clean_text(row.get("collected_at")),
                promoter.clean_text(row.get("policy_id")),
            ),
            reverse=True,
        )
        winner_id = promoter.clean_text(ordered[0].get("policy_id"))
        for row in ordered[1:]:
            policy_id = promoter.clean_text(row.get("policy_id"))
            if policy_id and winner_id:
                losers[policy_id] = winner_id
    return losers


def qualification_amount_reason(row: dict[str, Any]) -> str:
    evidence = " ".join(
        promoter.clean_text(row.get(field))
        for field in [
            "max_amount_evidence",
            "max_amount_actual",
            "max_amount_note",
        ]
        if promoter.clean_text(row.get(field))
    )
    if not evidence:
        return ""
    qualification_signal = next(
        (
            signal
            for signal in QUALIFICATION_AMOUNT_SIGNALS
            if signal in evidence
        ),
        "",
    )
    has_direct_support_signal = any(
        signal in evidence
        for signal in DIRECT_SUPPORT_AMOUNT_SIGNALS
    )
    if qualification_signal and not has_direct_support_signal:
        return f"{qualification_signal} 조건 금액"
    return ""


def sanitize_policy_payload_amount(
    row: dict[str, Any],
    payload: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    reason = qualification_amount_reason(row)
    if not reason:
        return payload, ""
    cleaned = dict(payload)
    cleaned["max_amount"] = None
    cleaned["max_amount_actual"] = None
    cleaned["max_amount_evidence"] = None
    cleaned["max_amount_note"] = (
        f"{reason}으로 판단되어 지원금에서 제외"
    )
    cleaned["amount_extraction_status"] = "needs_review"
    return cleaned, reason


def promotion_reasons(
    row: dict[str, Any],
    as_of: date,
    duplicate_of: str = "",
) -> list[str]:
    reasons = [
        label
        for field, label in REQUIRED_FIELDS.items()
        if not promoter.clean_text(row.get(field))
    ]

    temp_extraction = as_dict(row.get("temp_extraction_json"))
    if GEMINI_ENRICHMENT_KEY not in temp_extraction:
        reasons.append("Gemini v7 미검증")

    deadline_type = promoter.clean_text(row.get("deadline_type"))
    deadline = parse_date(row.get("deadline"))
    posted_at = parse_date(row.get("posted_at"))
    if (
        deadline is not None
        and posted_at is not None
        and deadline.year > posted_at.year + 1
    ):
        reasons.append("게시연도 대비 비정상 미래 마감일")
    if deadline_type not in CONDITIONAL_DEADLINE_TYPES:
        if deadline is None:
            reasons.append("마감일 확인 불가")
        elif deadline < as_of:
            reasons.append("마감 공고")
    if duplicate_of:
        reasons.append(f"동일 제목·기관 최신 공고 존재: {duplicate_of}")

    return reasons


def fetch_source_rows(
    supabase: Client,
    *,
    batch_size: int,
    limit: int,
    policy_ids: list[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        remaining = limit - len(rows) if limit > 0 else batch_size
        if limit > 0 and remaining <= 0:
            break
        page_size = (
            min(batch_size, remaining)
            if limit > 0
            else batch_size
        )
        page = (
            supabase.table(SOURCE_TABLE)
            .select("*")
            .order("policy_id")
            .range(offset, offset + page_size - 1)
            .execute()
            .data
            or []
        )
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    if policy_ids:
        wanted = set(policy_ids)
        rows = [
            row
            for row in rows
            if promoter.clean_text(row.get("policy_id")) in wanted
        ]
    return rows


def fetch_existing_policy_ids(
    supabase: Client,
    policy_ids: list[str],
) -> set[str]:
    existing: set[str] = set()
    chunk_size = 100
    for start in range(0, len(policy_ids), chunk_size):
        chunk = policy_ids[start : start + chunk_size]
        if not chunk:
            continue
        rows = (
            supabase.table(TARGET_TABLE)
            .select("policy_id")
            .in_("policy_id", chunk)
            .execute()
            .data
            or []
        )
        existing.update(
            promoter.clean_text(row.get("policy_id"))
            for row in rows
            if promoter.clean_text(row.get("policy_id"))
        )
    return existing


def fetch_bizinfo_rows(
    supabase: Client,
    batch_size: int = 500,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = (
            supabase.table(TARGET_TABLE)
            .select(
                "policy_id,title,organization,region,deadline,posted_at,"
                "source_name,source_id,url"
            )
            .eq("source_name", "bizinfo")
            .range(offset, offset + batch_size - 1)
            .execute()
            .data
            or []
        )
        rows.extend(page)
        if len(page) < batch_size:
            break
        offset += batch_size
    return rows


def write_csv(path_value: str, rows: list[dict[str, Any]]) -> Path:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "policy_id",
        "source_name",
        "title",
        "organization",
        "promotion_status",
        "target_action",
        "exclusion_reasons",
        "duplicate_of",
        "bizinfo_duplicate_status",
        "bizinfo_policy_id",
        "bizinfo_title",
        "bizinfo_organization",
        "bizinfo_deadline",
        "bizinfo_title_similarity",
        "bizinfo_base_title_similarity",
        "bizinfo_organization_match",
        "external_region_for_match",
        "bizinfo_region_for_match",
        "bizinfo_region_match",
        "bizinfo_deadline_difference_days",
        "bizinfo_duplicate_reason",
        "posted_at",
        "deadline",
        "deadline_type",
        "deadline_status",
        "summary_length",
        "support_primary_category",
        "support_categories",
        "support_item_count",
        "max_amount_before",
        "max_amount",
        "amount_filter_reason",
        "url",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return path


def main() -> None:
    args = resolve_args()
    if not promoter.SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not promoter.SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing."
        )
    try:
        as_of = date.fromisoformat(args.as_of)
    except ValueError as exc:
        raise ValueError("--as-of must be YYYY-MM-DD.") from exc

    supabase = create_client(
        promoter.SUPABASE_URL,
        promoter.SUPABASE_SERVICE_ROLE_KEY,
    )
    rows = fetch_source_rows(
        supabase,
        batch_size=args.batch_size,
        limit=args.limit,
        policy_ids=args.policy_id,
    )
    existing_ids = fetch_existing_policy_ids(
        supabase,
        [
            promoter.clean_text(row.get("policy_id"))
            for row in rows
            if promoter.clean_text(row.get("policy_id"))
        ],
    )
    bizinfo_rows = fetch_bizinfo_rows(supabase)
    duplicate_of_by_policy_id = duplicate_losers(rows)

    eligible_rows: list[dict[str, Any]] = []
    report_rows: list[dict[str, Any]] = []
    reason_counts: dict[str, int] = {}
    payload_by_policy_id: dict[str, dict[str, Any]] = {}
    amount_filter_by_policy_id: dict[str, str] = {}
    bizinfo_duplicate_counts: dict[str, int] = {}

    for row in rows:
        policy_id = promoter.clean_text(row.get("policy_id"))
        duplicate_of = duplicate_of_by_policy_id.get(policy_id, "")
        bizinfo_duplicate = best_bizinfo_duplicate(
            row,
            bizinfo_rows,
        )
        reasons = promotion_reasons(
            row,
            as_of,
            duplicate_of=duplicate_of,
        )
        bizinfo_status = bizinfo_duplicate.get("status") or "unique"
        bizinfo_duplicate_counts[bizinfo_status] = (
            bizinfo_duplicate_counts.get(bizinfo_status, 0) + 1
        )
        if bizinfo_status in BIZINFO_DUPLICATE_BLOCK_STATUSES:
            reasons.append(
                "기업마당 중복 검수: "
                f"{bizinfo_status} "
                f"({bizinfo_duplicate.get('policy_id')})"
            )
        eligible = not reasons
        if eligible:
            eligible_rows.append(row)
            mapped = promoter.build_policy_payload(
                row,
                source_table=SOURCE_TABLE,
            )
            if mapped:
                mapped, amount_filter_reason = (
                    sanitize_policy_payload_amount(row, mapped)
                )
                payload_by_policy_id[policy_id] = mapped
                amount_filter_by_policy_id[policy_id] = (
                    amount_filter_reason
                )
        for reason in reasons:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

        categories = promoter.clean_list(row.get("support_categories"))
        support_items = row.get("support_items")
        report_rows.append(
            {
                "policy_id": policy_id,
                "source_name": row.get("source_name"),
                "title": row.get("title"),
                "organization": row.get("organization"),
                "promotion_status": (
                    "승격 대상" if eligible else "보류"
                ),
                "target_action": (
                    "update" if policy_id in existing_ids else "insert"
                ),
                "exclusion_reasons": ", ".join(reasons),
                "duplicate_of": duplicate_of,
                "bizinfo_duplicate_status": bizinfo_status,
                "bizinfo_policy_id": bizinfo_duplicate.get("policy_id"),
                "bizinfo_title": bizinfo_duplicate.get("title"),
                "bizinfo_organization": bizinfo_duplicate.get(
                    "organization"
                ),
                "bizinfo_deadline": bizinfo_duplicate.get("deadline"),
                "bizinfo_title_similarity": bizinfo_duplicate.get(
                    "title_similarity"
                ),
                "bizinfo_base_title_similarity": bizinfo_duplicate.get(
                    "base_title_similarity"
                ),
                "bizinfo_organization_match": bizinfo_duplicate.get(
                    "organization_match"
                ),
                "external_region_for_match": bizinfo_duplicate.get(
                    "external_region"
                ),
                "bizinfo_region_for_match": bizinfo_duplicate.get(
                    "bizinfo_region"
                ),
                "bizinfo_region_match": bizinfo_duplicate.get(
                    "region_match"
                ),
                "bizinfo_deadline_difference_days": (
                    bizinfo_duplicate.get("deadline_difference_days")
                ),
                "bizinfo_duplicate_reason": bizinfo_duplicate.get(
                    "reason"
                ),
                "posted_at": row.get("posted_at"),
                "deadline": row.get("deadline"),
                "deadline_type": row.get("deadline_type"),
                "deadline_status": row.get("deadline_status"),
                "summary_length": len(
                    promoter.clean_text(row.get("summary"))
                ),
                "support_primary_category": row.get(
                    "support_primary_category"
                ),
                "support_categories": ", ".join(categories),
                "support_item_count": (
                    len(support_items)
                    if isinstance(support_items, list)
                    else 0
                ),
                "max_amount_before": row.get(
                    "max_amount_numeric_manwon"
                ),
                "max_amount": (
                    payload_by_policy_id.get(policy_id, {}).get(
                        "max_amount"
                    )
                    if eligible
                    else ""
                ),
                "amount_filter_reason": (
                    amount_filter_by_policy_id.get(policy_id, "")
                ),
                "url": row.get("url"),
            }
        )

    payloads = [
        payload_by_policy_id[
            promoter.clean_text(row.get("policy_id"))
        ]
        for row in eligible_rows
        if promoter.clean_text(row.get("policy_id"))
        in payload_by_policy_id
    ]

    output_path = write_csv(args.csv_output, report_rows)
    insert_count = sum(
        promoter.clean_text(row.get("policy_id")) not in existing_ids
        for row in eligible_rows
    )
    update_count = len(eligible_rows) - insert_count

    print(f"Source table: {SOURCE_TABLE}")
    print(f"Target table: {TARGET_TABLE}")
    print(f"Mode: {'EXECUTE' if args.execute else 'DRY-RUN'}")
    print(f"As of: {as_of.isoformat()}")
    print(f"Fetched rows: {len(rows)}")
    print(f"Eligible rows: {len(eligible_rows)}")
    print(f"Mapped payloads: {len(payloads)}")
    print(f"Target inserts: {insert_count}")
    print(f"Target updates: {update_count}")
    print(f"Excluded rows: {len(rows) - len(eligible_rows)}")
    print(f"Bizinfo comparison rows: {len(bizinfo_rows)}")
    for status, count in sorted(bizinfo_duplicate_counts.items()):
        print(f"  bizinfo duplicate | {status}: {count}")
    print(
        "Amounts excluded as qualification/burden conditions: "
        f"{sum(bool(reason) for reason in amount_filter_by_policy_id.values())}"
    )
    for reason, count in sorted(reason_counts.items()):
        print(f"  excluded | {reason}: {count}")
    print(f"CSV report: {output_path}")

    for payload in payloads[:5]:
        print(
            "  preview | "
            f"{payload.get('policy_id')} | "
            f"amount={payload.get('max_amount')} | "
            f"deadline={payload.get('deadline') or '-'} | "
            f"category={payload.get('support_primary_category') or '-'}"
        )

    if not args.execute:
        print("Dry-run complete. Add --execute after reviewing the CSV.")
        return

    upserted = 0
    for start in range(0, len(payloads), args.batch_size):
        batch = payloads[start : start + args.batch_size]
        if not batch:
            continue
        (
            supabase.table(TARGET_TABLE)
            .upsert(batch, on_conflict="policy_id")
            .execute()
        )
        upserted += len(batch)
        print(f"  upserted {upserted}/{len(payloads)}")
    print(f"Done. Upserted: {upserted}")


if __name__ == "__main__":
    main()
