from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

import policy_amount_utils as amount_utils


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_current_review"

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

DIRECT_TYPES = {"support_amount", "subsidy", "voucher"}
TARGET_CATEGORY = "manual_representative_recoverable"
CLEAR_LIMIT_WORDS = [
    "최대",
    "한도",
    "이내",
    "이하",
    "까지",
    "기업당",
    "업체당",
    "법인 당",
    "사업주",
    "과제당",
]
RISK_CONTEXT_WORDS = [
    "/",
    "/월",
    "월 지원",
    "월별",
    "명당",
    "인당",
    "1인",
    "건당",
    "컨소시엄",
    "총사업비",
    "총 사업비",
    "총 지원규모",
    "사업규모",
    "예산",
    "자부담",
    "부담금",
    "수수료",
    "분석",
    "인건비",
    "채용",
]
SELECT_FIELDS = (
    "policy_id,title,organization,url,amount_candidates,selected_amount_candidate,"
    "support_ratio,max_amount_numeric_manwon,max_amount_actual,max_amount_type,"
    "amount_manual_review_category,amount_manual_review_category_ko,"
    "amount_manual_review_status,amount_manual_review_reason"
)
DETAIL_PAYLOAD_FIELDS = {
    "amount_candidates",
    "selected_amount_candidate",
    "support_ratio",
    "max_amount_actual",
    "max_amount_status",
    "max_amount_type",
    "max_amount_type_ko",
    "max_amount_type_reason",
    "max_amount_numeric_manwon",
    "roi_apply_method",
    "roi_apply_method_ko",
    "roi_apply_reason",
    "amount_manual_review_status",
    "amount_manual_review_required",
    "amount_manual_review_category",
    "amount_manual_review_category_ko",
    "amount_manual_review_reason",
}


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def fetch_target_rows(supabase: Client) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = (
            supabase.table("policy")
            .select(SELECT_FIELDS)
            .eq("amount_manual_review_category", TARGET_CATEGORY)
            .range(start, end)
            .execute()
        )
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            return rows
        start += batch_size


def numeric_amount(candidate: dict[str, Any]) -> float | None:
    value = candidate.get("amount_manwon")
    if value is None:
        value = candidate.get("amount_numeric_manwon")
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    return amount


def is_direct_cash_candidate(candidate: dict[str, Any]) -> bool:
    amount = numeric_amount(candidate)
    if amount is None:
        return False
    amount_type = clean(candidate.get("max_amount_type"))
    if amount_type not in DIRECT_TYPES:
        return False
    if candidate.get("is_roi_usable") is False:
        return False
    roi_method = clean(candidate.get("roi_apply_method"))
    if roi_method and roi_method != "subtract":
        return False
    return True


def candidate_context(candidate: dict[str, Any]) -> str:
    return clean(
        candidate.get("evidence")
        or candidate.get("local_context")
        or candidate.get("raw_text")
        or candidate.get("display_amount"),
        500,
    )


def has_clear_limit_context(candidate: dict[str, Any]) -> bool:
    context = candidate_context(candidate)
    return any(word in context for word in CLEAR_LIMIT_WORDS)


def has_risky_context(candidate: dict[str, Any]) -> bool:
    context = candidate_context(candidate)
    return any(word in context for word in RISK_CONTEXT_WORDS)


def direct_candidates(row: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        candidate
        for candidate in row.get("amount_candidates") or []
        if isinstance(candidate, dict) and is_direct_cash_candidate(candidate)
    ]


def select_from_direct_candidates(
    candidates: list[dict[str, Any]],
) -> tuple[str, str, dict[str, Any] | None]:
    if not candidates:
        return "no_direct_cash_candidate", "현금성/바우처 직접지원 후보가 없어서 자동 대표금액 채택 불가", None

    if len(candidates) == 1:
        selected = candidates[0]
        if has_risky_context(selected):
            return "hold_risky_unit_or_total_context", "월/명/건/컨소시엄/총규모 등 위험 문맥이 있어 수기검수 필요", None
        if not has_clear_limit_context(selected):
            return "hold_limit_context_unclear", "직접지원 후보는 1개지만 최대/한도 문맥이 명확하지 않아 수기검수 필요", None
        if selected.get("is_selected_amount") is True:
            return "auto_adopt_single_marked_clear_limit", "단일 직접지원 후보이고 선택표시와 최대/한도 문맥이 명확해 자동 채택 가능", selected
        return "auto_adopt_single_clear_limit", "단일 직접지원 후보이고 최대/한도 문맥이 명확해 자동 채택 가능", selected

    amounts = {numeric_amount(candidate) for candidate in candidates}
    if len(amounts) == 1:
        candidate = candidates[0]
        if not has_risky_context(candidate) and has_clear_limit_context(candidate):
            return "auto_adopt_same_amount_clear_limit", "직접지원 후보가 여러 개지만 금액이 같고 최대/한도 문맥이 명확해 자동 채택 가능", candidate
        return "hold_same_amount_context_unclear", "직접지원 후보 금액은 같지만 문맥 확인이 필요", None

    return "hold_multi_direct_candidates", "직접지원 후보가 여러 개이고 금액이 달라 대표 선택 기준 확인 필요", None


def normalize_selected_payload(
    row: dict[str, Any],
    selected: dict[str, Any],
) -> dict[str, Any]:
    candidates = []
    for candidate in row.get("amount_candidates") or []:
        if not isinstance(candidate, dict):
            continue
        normalized = dict(candidate)
        normalized["is_selected_amount"] = candidate is selected
        candidates.append(normalized)

    selected_payload = dict(selected)
    selected_payload["is_selected_amount"] = True
    amount = numeric_amount(selected_payload)
    if amount is not None:
        selected_payload["amount_manwon"] = amount
    derived = amount_utils.derive_policy_amount_fields(selected_payload, candidates)

    payload_fields = [
        "amount_candidates",
        "selected_amount_candidate",
        "support_ratio",
        "max_amount_actual",
        "max_amount_status",
        "max_amount_type",
        "max_amount_type_ko",
        "max_amount_type_reason",
        "max_amount_numeric_manwon",
        "max_amount_evidence",
        "max_amount_note",
        "roi_apply_method",
        "roi_apply_method_ko",
        "roi_apply_reason",
    ]
    payload = {field: derived.get(field) for field in payload_fields if field in derived}
    payload.update(
        {
            "amount_manual_review_status": "reviewed",
            "amount_manual_review_required": False,
            "amount_manual_review_category": "auto_representative_adopted",
            "amount_manual_review_category_ko": "대표금액 자동 채택",
            "amount_manual_review_reason": "manual_representative_recoverable 재검수에서 직접지원 대표금액 후보가 명확해 자동 채택했습니다.",
        }
    )
    return payload


def classify_row(row: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
    candidates = row.get("amount_candidates") or []
    direct = direct_candidates(row)
    category, reason, selected = select_from_direct_candidates(direct)
    payload = normalize_selected_payload(row, selected) if selected else None
    audit = {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "stage1_category": row.get("amount_manual_review_category"),
        "stage1_status": row.get("amount_manual_review_status"),
        "stage2_category": category,
        "stage2_reason": reason,
        "candidate_count": len(candidates),
        "direct_cash_candidate_count": len(direct),
        "selected_amount_manwon": numeric_amount(selected) if selected else "",
        "selected_amount_type": clean(selected.get("max_amount_type")) if selected else "",
        "selected_context": candidate_context(selected) if selected else "",
        "direct_candidate_summary": " || ".join(
            f"{numeric_amount(candidate)}만원/{clean(candidate.get('max_amount_type'))}/{candidate_context(candidate)[:180]}"
            for candidate in direct[:6]
        ),
        "url": row.get("url"),
    }
    return audit, payload


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()), escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def apply_payloads(supabase: Client, payloads: list[dict[str, Any]]) -> None:
    for payload in payloads:
        policy_id = payload["policy_id"]
        update = {key: value for key, value in payload.items() if key != "policy_id"}
        detail_update = {
            key: value
            for key, value in update.items()
            if key in DETAIL_PAYLOAD_FIELDS
        }
        supabase.table("policy").update(update).eq("policy_id", policy_id).execute()
        supabase.table("policy_01_amount_detail").update(detail_update).eq("policy_id", policy_id).execute()


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Review current manual_representative_recoverable policies and build auto-adopt payloads."
    )
    parser.add_argument("--apply", action="store_true", help="Apply auto-adopt payloads to policy and policy_01_amount_detail.")
    parser.add_argument("--output-dir", default=str(REPORT_DIR))
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    rows = fetch_target_rows(supabase)
    audit_rows: list[dict[str, Any]] = []
    payloads: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    for row in rows:
        audit, payload = classify_row(row)
        audit_rows.append(audit)
        counts[audit["stage2_category"]] = counts.get(audit["stage2_category"], 0) + 1
        if payload:
            payloads.append({"policy_id": row["policy_id"], **payload})

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    audit_path = output_dir / f"manual_representative_recoverable_current_audit_{timestamp}.csv"
    payload_path = output_dir / f"manual_representative_recoverable_current_auto_payload_{timestamp}.json"
    summary_path = output_dir / f"manual_representative_recoverable_current_summary_{timestamp}.md"

    write_csv(audit_path, audit_rows)
    write_json(payload_path, payloads)
    lines = [
        f"apply={args.apply}",
        f"source_rows={len(rows)}",
        f"auto_payload_rows={len(payloads)}",
        "",
        "## stage2 counts",
        *[f"- {key}: {counts[key]}" for key in sorted(counts)],
        "",
        f"audit_csv={audit_path}",
        f"auto_payload_json={payload_path}",
    ]
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    if args.apply and payloads:
        apply_payloads(supabase, payloads)

    print(json.dumps({
        "apply": args.apply,
        "source_rows": len(rows),
        "auto_payload_rows": len(payloads),
        "counts": counts,
        "audit_csv": str(audit_path),
        "auto_payload_json": str(payload_path),
        "summary_md": str(summary_path),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
