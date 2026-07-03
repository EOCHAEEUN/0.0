from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent

for env_path in [
    Path.cwd() / ".env",
    ROOT / ".env",
    ROOT / "backend" / ".env",
    SCRIPT_DIR / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)


SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()

TEXT_FIELDS = [
    "amount_actual",
    "display_amount",
    "evidence",
    "raw_text",
    "local_context",
]
SELECT_FIELDS = (
    "policy_id,title,url,amount_candidates,selected_amount_candidate,"
    "support_ratio,max_amount_actual,max_amount_numeric_manwon,"
    "max_amount_type,roi_apply_method,amount_manual_review_status,"
    "amount_manual_review_category"
)
DETAIL_FIELDS = {
    "amount_candidates",
    "selected_amount_candidate",
    "max_amount_actual",
    "max_amount_numeric_manwon",
    "max_amount_type",
}

RISK_WORDS = [
    "\uc6d4",  # 월
    "\ub9e4\uc6d4",  # 매월
    "\uc6d4\ubcc4",  # 월별
    "\uba85\ub2f9",  # 명당
    "\uc778\ub2f9",  # 인당
    "1\uc778",  # 1인
    "\uac74\ub2f9",  # 건당
    "\ud68c\ub2f9",  # 회당
    "1\ud68c",  # 1회
    "\ud68c ",  # 회
    "\uac1c\uc0ac",  # 개사
    "\uac1c ",  # 개
    "~",
    "\uac1c\uc6d4",  # 개월
    "\uc5f0\uac04",  # 연간
    "\ub144\uac04",  # 년간
    "\ucd1d\uc0ac\uc5c5\ube44",  # 총사업비
    "\ucd1d \uc0ac\uc5c5\ube44",  # 총 사업비
    "\ucd1d\uc608\uc0b0",  # 총예산
    "\uc608\uc0b0",  # 예산
    "\uc790\ubd80\ub2f4",  # 자부담
    "\ubd80\ub2f4\uae08",  # 부담금
]

AMOUNT_PATTERN = re.compile(
    r"(?P<num>\d+(?:,\d{3})*(?:\.\d+)?)\s*"
    r"(?P<unit>\uc5b5\s*\uc6d0|\uc5b5\uc6d0|\uc5b5|"
    r"\ucc9c\s*\ub9cc\s*\uc6d0|\ucc9c\ub9cc\uc6d0|"
    r"\ubc31\s*\ub9cc\s*\uc6d0|\ubc31\ub9cc\uc6d0|"
    r"\ub9cc\s*\uc6d0|\ub9cc\uc6d0|"
    r"\ucc9c\s*\uc6d0|\ucc9c\uc6d0|"
    r"\uc6d0)"
)


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean_text(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def parse_number(raw: str) -> float:
    return float(raw.replace(",", ""))


def amount_to_manwon(raw_number: str, raw_unit: str) -> float:
    number = parse_number(raw_number)
    unit = re.sub(r"\s+", "", raw_unit)
    if unit in {"\uc5b5\uc6d0", "\uc5b5"}:
        return number * 10000
    if unit == "\ucc9c\ub9cc\uc6d0":
        return number * 1000
    if unit == "\ubc31\ub9cc\uc6d0":
        return number * 100
    if unit == "\ub9cc\uc6d0":
        return number
    if unit == "\ucc9c\uc6d0":
        return number / 10
    if unit == "\uc6d0":
        return number / 10000
    return number


def selected_text(selected: dict[str, Any], row: dict[str, Any]) -> str:
    values = [selected.get(field) for field in TEXT_FIELDS]
    values.append(row.get("max_amount_actual"))
    return " ".join(clean_text(value) for value in values if clean_text(value))


def has_risk_context(text: str) -> bool:
    return any(word in text for word in RISK_WORDS)


def infer_amount_from_text(text: str) -> tuple[float | None, str | None]:
    matches: list[tuple[float, str]] = []
    for match in AMOUNT_PATTERN.finditer(text):
        amount = amount_to_manwon(match.group("num"), match.group("unit"))
        if amount <= 0:
            continue
        if match.group("unit").replace(" ", "") == "\uc6d0" and amount < 1:
            continue
        matches.append((round(amount, 2), match.group(0)))
    if not matches:
        return None, None
    # Use the largest amount in the selected candidate text. These rows already
    # have a selected representative candidate; this only fills the missing
    # numeric value from that selected evidence.
    amount, evidence = max(matches, key=lambda item: item[0])
    return amount, evidence


def fetch_rows(supabase: Client) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = supabase.table("policy").select(SELECT_FIELDS).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            return rows
        start += batch_size


def update_candidates(
    candidates: Any,
    selected: dict[str, Any],
    amount: float,
) -> Any:
    if not isinstance(candidates, list):
        return candidates
    selected_evidence = clean_text(selected.get("evidence") or selected.get("raw_text") or selected.get("display_amount"))
    selected_type = clean_text(selected.get("max_amount_type"))
    updated = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            updated.append(candidate)
            continue
        item = dict(candidate)
        item_evidence = clean_text(item.get("evidence") or item.get("raw_text") or item.get("display_amount"))
        same_selected = item.get("is_selected_amount") is True or (
            selected_evidence
            and item_evidence == selected_evidence
            and clean_text(item.get("max_amount_type")) == selected_type
        )
        if same_selected and item.get("amount_manwon") is None:
            item["amount_manwon"] = amount
        updated.append(item)
    return updated


def build_update(row: dict[str, Any], *, include_risky: bool) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    selected = row.get("selected_amount_candidate")
    audit = {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "url": row.get("url"),
        "status": "skip",
        "reason": "",
        "inferred_amount_manwon": None,
        "matched_text": None,
        "risk_context": False,
        "selected_type": None,
        "roi_apply_method": row.get("roi_apply_method"),
        "manual_status": row.get("amount_manual_review_status"),
        "manual_category": row.get("amount_manual_review_category"),
    }
    if not isinstance(selected, dict):
        audit["reason"] = "selected_amount_candidate 없음"
        return None, audit
    if row.get("max_amount_numeric_manwon") is not None:
        audit["reason"] = "이미 numeric 있음"
        return None, audit
    text = selected_text(selected, row)
    amount, matched = infer_amount_from_text(text)
    risk = has_risk_context(text)
    audit.update({
        "inferred_amount_manwon": amount,
        "matched_text": matched,
        "risk_context": risk,
        "selected_type": selected.get("max_amount_type"),
        "selected_text": clean_text(text, 500),
    })
    if amount is None:
        audit["reason"] = "금액 단위 파싱 실패"
        return None, audit
    if risk and not include_risky:
        audit["status"] = "hold"
        audit["reason"] = "월/명/건/총예산/자부담 등 위험 문맥 포함"
        return None, audit

    selected_update = dict(selected)
    selected_update["amount_manwon"] = amount
    if selected_update.get("amount_numeric_manwon") is None:
        selected_update["amount_numeric_manwon"] = amount

    update = {
        "selected_amount_candidate": selected_update,
        "amount_candidates": update_candidates(row.get("amount_candidates"), selected, amount),
        "max_amount_numeric_manwon": amount,
    }
    if not row.get("max_amount_actual"):
        update["max_amount_actual"] = matched
    if not row.get("max_amount_type") and selected_update.get("max_amount_type"):
        update["max_amount_type"] = selected_update.get("max_amount_type")
    audit["status"] = "update"
    audit["reason"] = "selected 후보 문구에서 숫자 금액 추출"
    return update, audit


def apply_updates(supabase: Client, updates: list[tuple[str, dict[str, Any]]]) -> None:
    for policy_id, update in updates:
        supabase.table("policy").update(update).eq("policy_id", policy_id).execute()
        detail_update = {
            key: value
            for key, value in update.items()
            if key in DETAIL_FIELDS
        }
        if detail_update:
            supabase.table("policy_01_amount_detail").update(detail_update).eq("policy_id", policy_id).execute()


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill max_amount_numeric_manwon from selected_amount_candidate text."
    )
    parser.add_argument("--apply", action="store_true", help="Actually update DB. Default is dry-run.")
    parser.add_argument("--include-risky", action="store_true", help="Also update rows with unit/period/total-budget risk words.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    rows = fetch_rows(supabase)
    target_rows = [
        row
        for row in rows
        if isinstance(row.get("selected_amount_candidate"), dict)
        and row.get("max_amount_numeric_manwon") is None
    ]
    updates: list[tuple[str, dict[str, Any]]] = []
    audits = []
    for row in target_rows:
        update, audit = build_update(row, include_risky=args.include_risky)
        audits.append(audit)
        if update:
            updates.append((row["policy_id"], update))

    if args.apply:
        apply_updates(supabase, updates)

    counts: dict[str, int] = {}
    for audit in audits:
        key = audit["status"] if audit["status"] != "skip" else audit["reason"]
        counts[key] = counts.get(key, 0) + 1

    print(json.dumps({
        "apply": args.apply,
        "include_risky": args.include_risky,
        "target_rows": len(target_rows),
        "rows_to_update": len(updates),
        "counts": counts,
        "preview_updates": [
            {
                "policy_id": policy_id,
                "amount": update.get("max_amount_numeric_manwon"),
            }
            for policy_id, update in updates[:20]
        ],
        "hold_risky_samples": [
            audit
            for audit in audits
            if audit["status"] == "hold"
        ][:10],
        "failed_samples": [
            audit
            for audit in audits
            if audit["reason"] == "금액 단위 파싱 실패"
        ][:10],
    }, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
