from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import policy_amount_utils as amount_utils


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_REMAINING_CSV = REPORT_DIR / "remaining_review" / "remaining_amount_review_summary.csv"
DEFAULT_LARGE_HOLD_CSV = (
    REPORT_DIR / "large_amount_delta_resolution" / "large_amount_delta_hold_breakdown_20260703_121239.csv"
)
DEFAULT_SELECTED_GEMINI_CSV = (
    REPORT_DIR / "selected_candidate_missing_gemini" / "selected_candidate_missing_gemini_review_20260703_124656.csv"
)

REPRESENTATIVE_TYPES = {"support_amount", "subsidy", "voucher"}
TOTAL_TYPES = {"total_support_scale", "total_budget", "project_budget", "total_project_cost"}
LIMIT_WORDS = {
    "기업당", "업체당", "1개사", "개사당", "과제당", "건당", "사업장당", "제품당",
    "기업별", "지원기업별", "최대", "한도", "이내", "내외", "지원한도", "지원 한도",
}
ENTITY_LIMIT_WORDS = {"기업당", "업체당", "1개사", "개사당", "과제당", "건당", "사업장당", "기업별", "지원기업별"}
TOTAL_WORDS = {"총사업비", "총 사업비", "총지원규모", "총 지원규모", "전체예산", "총예산", "지원규모", "사업예산"}
UNIT_AMBIGUOUS_WORDS = {
    "매월", "월별", "월 기업부담금", "월 지원", "월 납입", "1명", "인당", "명당",
    "근로자", "채용", "연간", "년간", "/점", "점당",
}
AMOUNT_CONDITION_WORDS = {"취득금액", "소요금액", "구매금액", "매출채권", "매출액", "기업부담금", "자부담", "부담금"}


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def read_csv(path: Path) -> list[dict[str, str]]:
    content = path.read_text(encoding="utf-8-sig").replace("\x00", "")
    return list(csv.DictReader(content.splitlines()))


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    fields = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def has_any(text: str, words: set[str]) -> bool:
    return any(word in text for word in words)


def payload_from_candidates(policy_id: str, candidates: list[dict[str, Any]], selected: dict[str, Any] | None) -> dict[str, Any]:
    derived = amount_utils.derive_policy_amount_fields(selected, candidates)
    fields = [
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
    payload = {"policy_id": policy_id}
    for field in fields:
        if field in derived:
            payload[field] = derived[field]
    return payload


def audit_row(row: dict[str, Any], payload: dict[str, Any], bucket: str, action: str, reason: str) -> dict[str, Any]:
    selected = payload.get("selected_amount_candidate") or {}
    return {
        "policy_id": payload.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "bucket": bucket,
        "recommended_action": action,
        "reason": reason,
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_actual": row.get("old_actual"),
        "old_amount_type": row.get("old_amount_type"),
        "old_roi_apply_method": row.get("old_roi_apply_method"),
        "new_amount_manwon": payload.get("max_amount_numeric_manwon"),
        "new_amount_actual": payload.get("max_amount_actual"),
        "new_amount_type": payload.get("max_amount_type"),
        "new_roi_apply_method": payload.get("roi_apply_method"),
        "support_ratio": payload.get("support_ratio"),
        "context": clean(selected.get("local_context") or selected.get("evidence") or selected.get("raw_text"), 700),
        "url": row.get("url"),
    }


def build_support_ratio_payload(row: dict[str, Any]) -> dict[str, Any] | None:
    candidates = row.get("new_amount_candidates") or []
    ratio = (row.get("derived_fields") or {}).get("support_ratio") or row.get("new_support_ratio")
    ratio_candidate = next((candidate for candidate in candidates if candidate.get("support_ratio") is not None), None)
    if ratio is None and ratio_candidate:
        ratio = ratio_candidate.get("support_ratio")
    if ratio is None:
        return None
    if not ratio_candidate:
        ratio_candidate = {
            "label": "지원비율",
            "raw_text": f"{float(ratio) * 100:g}% 지원",
            "evidence": f"{float(ratio) * 100:g}% 지원",
            "amount_manwon": None,
            "display_amount": f"최대 {float(ratio) * 100:g}% 지원",
            "support_ratio": ratio,
            "max_amount_type": "support_ratio",
            "max_amount_type_ko": "지원비율",
            "roi_apply_method": "ratio_cap",
            "roi_apply_method_ko": "지원비율 적용",
            "is_roi_usable": True,
            "is_selected_amount": False,
            "reason": "지원비율만 확인되어 최대한도 확인 필요",
        }
        candidates = [*candidates, ratio_candidate]
    payload = payload_from_candidates(clean(row.get("policy_id")), candidates, None)
    payload.update(
        {
            "support_ratio": ratio,
            "max_amount_actual": None,
            "max_amount_status": "비율 확인",
            "max_amount_type": "support_ratio",
            "max_amount_type_ko": "지원비율",
            "max_amount_numeric_manwon": None,
            "max_amount_evidence": ratio_candidate.get("evidence") or ratio_candidate.get("raw_text"),
            "max_amount_note": "대표금액 없이 지원비율만 저장",
            "max_amount_type_reason": "대표금액 없이 지원비율만 저장",
            "roi_apply_method": "ratio_cap",
            "roi_apply_method_ko": "지원비율 적용",
            "roi_apply_reason": "정액 한도 없이 지원비율만 확인됨",
        }
    )
    return payload


def reclassify_total_candidate(candidate: dict[str, Any]) -> tuple[dict[str, Any], str] | None:
    local = clean(candidate.get("local_context") or candidate.get("evidence") or candidate.get("raw_text"), 600)
    amount = candidate.get("amount_manwon")
    if amount is None:
        return None
    strong_entity_limit = "지원기업별" in local or "기업별" in local
    if has_any(local, AMOUNT_CONDITION_WORDS) and not strong_entity_limit:
        return None
    if has_any(local, UNIT_AMBIGUOUS_WORDS):
        return None
    has_support_limit_header = "지원한도" in local or "지원 한도" in local or "지원금액" in local
    if not has_any(local, LIMIT_WORDS) and not has_support_limit_header:
        return None
    if has_any(local, TOTAL_WORDS) and not has_any(local, ENTITY_LIMIT_WORDS) and not has_support_limit_header:
        return None
    updated = dict(candidate)
    updated.update(
        {
            "max_amount_type": "support_amount",
            "max_amount_type_ko": "현금성 지원금",
            "roi_apply_method": "subtract",
            "roi_apply_method_ko": "직접 차감",
            "is_roi_usable": True,
            "reason": "총규모 후보였지만 기업/건/과제 단위 한도 문맥이 확인되어 대표금액 후보로 재분류",
        }
    )
    return updated, updated["reason"]


def build_total_scale_recovery(row: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    candidates = row.get("new_amount_candidates") or []
    recovered: list[dict[str, Any]] = []
    reason = ""
    for candidate in candidates:
        if clean(candidate.get("max_amount_type")) not in TOTAL_TYPES:
            recovered.append(candidate)
            continue
        reclassified = reclassify_total_candidate(candidate)
        if reclassified:
            updated, reason = reclassified
            recovered.append(updated)
        else:
            recovered.append(candidate)
    normalized, selected = amount_utils.normalize_candidate_selection(recovered)
    if not selected or clean(selected.get("max_amount_type")) not in REPRESENTATIVE_TYPES:
        return None, "기업별/건당/과제당 한도 문맥 불충분"
    return payload_from_candidates(clean(row.get("policy_id")), normalized, selected), reason


def candidate_missing_subtype(row: dict[str, Any]) -> tuple[str, str]:
    status = clean(row.get("fetch_status"))
    if status in {"fetch_failed", "missing_url", "fetched_empty"}:
        return "retry_or_manual_source", "원문 조회 실패/빈 본문이라 재조회 필요"
    if (row.get("detail_text_length") or 0) == 0 and (row.get("attachment_text_length") or 0) == 0:
        return "no_source_text", "원문/첨부 텍스트가 없어 OCR 또는 수동 원문 확보 필요"
    if (row.get("attachment_text_length") or 0) > 0:
        return "attachment_text_no_amount", "첨부 텍스트는 있으나 금액 후보가 없어 표/OCR 품질 확인 필요"
    return "detail_text_no_amount", "상세 본문에서 금액 후보가 없어 첨부/표 재확인 필요"


def hold_action_from_context(row: dict[str, Any]) -> tuple[str, str, str]:
    candidates = row.get("new_amount_candidates") or []
    selected = row.get("new_selected_candidate") or {}
    context = clean(selected.get("local_context") or selected.get("evidence") or selected.get("raw_text"), 700)
    old_amount = row.get("old_amount_manwon")
    new_amount = row.get("new_selected_amount_manwon")
    selected_type = clean(row.get("new_selected_type"))
    if selected_type in {"loan", "guarantee", "interest_support", "non_cash", "fee", "consulting_fee", "education_fee", "equipment_usage_fee"}:
        return "exclude_or_recommend_only", "새 후보가 비현금/금융/수수료 계열이라 ROI 직접 차감 제외", context
    if context and has_any(context, AMOUNT_CONDITION_WORDS):
        return "manual_review", "금액 조건/자부담/취득금액 문맥이 섞여 지원금 확정 불가", context
    if context and has_any(context, UNIT_AMBIGUOUS_WORDS):
        return "manual_review", "월/명/건/연간 단위가 섞여 대표금액 환산 필요", context
    if selected_type in REPRESENTATIVE_TYPES and context and has_any(context, ENTITY_LIMIT_WORDS) and not has_any(context, TOTAL_WORDS):
        return "adopt_new_candidate", "기업/업체/과제 단위 한도 문맥이 있어 새 후보 채택 가능", context
    if old_amount and new_amount and abs(float(old_amount) - float(new_amount)) / max(float(old_amount), 1) <= 0.2:
        return "keep_old_or_adopt_new_similar", "기존값과 새값 차이가 작아 운영 정책으로 결정 가능", context
    if candidates and not selected:
        return "manual_review", "후보는 있으나 대표 후보가 선택되지 않아 수동 선택 필요", context
    return "manual_review", "기존값/새값 중 대표금액 확정 불가", context


def main() -> None:
    parser = argparse.ArgumentParser(description="Build dry-run fixup payloads for remaining policy amount groups.")
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--remaining-csv", default=str(DEFAULT_REMAINING_CSV))
    parser.add_argument("--large-hold-csv", default=str(DEFAULT_LARGE_HOLD_CSV))
    parser.add_argument("--selected-gemini-csv", default=str(DEFAULT_SELECTED_GEMINI_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "remaining_fixups"))
    args = parser.parse_args()

    rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in rows}
    remaining_rows = read_csv(Path(args.remaining_csv))
    remaining_by_bucket: dict[str, list[dict[str, str]]] = {}
    for row in remaining_rows:
        remaining_by_bucket.setdefault(clean(row.get("bucket")), []).append(row)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)

    support_payloads: list[dict[str, Any]] = []
    support_audit: list[dict[str, Any]] = []
    for item in remaining_by_bucket.get("support_ratio_only", []):
        policy_id = clean(item.get("policy_id"))
        row = rows_by_id.get(policy_id)
        if not row:
            continue
        payload = build_support_ratio_payload(row)
        if payload:
            support_payloads.append(payload)
            support_audit.append(audit_row(row, payload, "support_ratio_only", "store_support_ratio_only", "대표금액 없이 지원비율 저장"))

    total_payloads: list[dict[str, Any]] = []
    total_audit: list[dict[str, Any]] = []
    total_hold: list[dict[str, Any]] = []
    for item in remaining_by_bucket.get("total_scale_only", []):
        policy_id = clean(item.get("policy_id"))
        row = rows_by_id.get(policy_id)
        if not row:
            continue
        payload, reason = build_total_scale_recovery(row)
        if payload:
            total_payloads.append(payload)
            total_audit.append(audit_row(row, payload, "total_scale_only", "adopt_reclassified_limit", reason))
        else:
            total_hold.append(
                {
                    "policy_id": policy_id,
                    "title": row.get("title"),
                    "organization": row.get("organization"),
                    "recommended_action": "keep_excluded_or_manual_review",
                    "reason": reason,
                    "candidate_count": len(row.get("new_amount_candidates") or []),
                    "candidate_summary": " || ".join(
                        f"{candidate.get('amount_manwon')}만원/{clean(candidate.get('max_amount_type'))}: "
                        f"{clean(candidate.get('local_context') or candidate.get('evidence'), 180)}"
                        for candidate in (row.get("new_amount_candidates") or [])[:8]
                    ),
                    "url": row.get("url"),
                }
            )

    candidate_missing_review: list[dict[str, Any]] = []
    for item in remaining_by_bucket.get("candidate_missing", []):
        policy_id = clean(item.get("policy_id"))
        row = rows_by_id.get(policy_id)
        if not row:
            continue
        subtype, reason = candidate_missing_subtype(row)
        candidate_missing_review.append(
            {
                "policy_id": policy_id,
                "title": row.get("title"),
                "organization": row.get("organization"),
                "subtype": subtype,
                "recommended_action": item.get("recommended_action"),
                "reason": reason,
                "fetch_status": row.get("fetch_status"),
                "source_kind": row.get("source_kind"),
                "detail_text_length": row.get("detail_text_length"),
                "attachment_text_length": row.get("attachment_text_length"),
                "fetch_error": clean(row.get("fetch_error"), 300),
                "url": row.get("url"),
            }
        )

    candidate_missing_ids_path = output_dir / f"candidate_missing_ids_{timestamp}.csv"
    write_csv(candidate_missing_ids_path, [{"policy_id": row["policy_id"]} for row in candidate_missing_review])

    hold_rows: list[dict[str, Any]] = []
    hold_ids = {
        clean(row.get("policy_id"))
        for row in remaining_by_bucket.get("large_amount_delta_hold", [])
    } | {
        clean(row.get("policy_id"))
        for row in remaining_by_bucket.get("selected_candidate_missing", [])
        if clean(row.get("recommended_action")) == "manual_review"
    }
    for policy_id in sorted(hold_ids):
        row = rows_by_id.get(policy_id)
        if not row:
            continue
        action, reason, context = hold_action_from_context(row)
        hold_rows.append(
            {
                "policy_id": policy_id,
                "title": row.get("title"),
                "organization": row.get("organization"),
                "recommended_action": action,
                "reason": reason,
                "old_amount_manwon": row.get("old_amount_manwon"),
                "old_amount_actual": row.get("old_actual"),
                "new_amount_manwon": row.get("new_selected_amount_manwon"),
                "new_amount_type": row.get("new_selected_type"),
                "candidate_count": row.get("candidate_count"),
                "context": context,
                "url": row.get("url"),
            }
        )

    support_payload_path = output_dir / f"support_ratio_only_payload_{timestamp}.json"
    support_audit_path = output_dir / f"support_ratio_only_audit_{timestamp}.csv"
    total_payload_path = output_dir / f"total_scale_recovered_payload_{timestamp}.json"
    total_audit_path = output_dir / f"total_scale_recovered_audit_{timestamp}.csv"
    total_hold_path = output_dir / f"total_scale_hold_{timestamp}.csv"
    candidate_review_path = output_dir / f"candidate_missing_review_{timestamp}.csv"
    hold_review_path = output_dir / f"hold_manual_adjudication_sheet_{timestamp}.csv"
    summary_path = output_dir / f"remaining_fixups_summary_{timestamp}.md"

    write_json(support_payload_path, support_payloads)
    write_csv(support_audit_path, support_audit)
    write_json(total_payload_path, total_payloads)
    write_csv(total_audit_path, total_audit)
    write_csv(total_hold_path, total_hold)
    write_csv(candidate_review_path, candidate_missing_review)
    write_csv(hold_review_path, hold_rows)

    action_counts: dict[str, int] = {}
    for row in hold_rows:
        action = clean(row.get("recommended_action"))
        action_counts[action] = action_counts.get(action, 0) + 1
    candidate_counts: dict[str, int] = {}
    for row in candidate_missing_review:
        subtype = clean(row.get("subtype"))
        candidate_counts[subtype] = candidate_counts.get(subtype, 0) + 1

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"support_ratio_payload_rows={len(support_payloads)}",
        f"total_scale_recovered_rows={len(total_payloads)}",
        f"total_scale_hold_rows={len(total_hold)}",
        f"candidate_missing_review_rows={len(candidate_missing_review)}",
        f"hold_review_rows={len(hold_rows)}",
        "",
        "## candidate_missing_subtypes",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(candidate_counts.items()))
    lines.extend(["", "## hold_action_counts"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(action_counts.items()))
    lines.extend(
        [
            "",
            "## outputs",
            f"- support_ratio_payload: `{support_payload_path}`",
            f"- support_ratio_audit: `{support_audit_path}`",
            f"- total_scale_recovered_payload: `{total_payload_path}`",
            f"- total_scale_recovered_audit: `{total_audit_path}`",
            f"- total_scale_hold: `{total_hold_path}`",
            f"- candidate_missing_review: `{candidate_review_path}`",
            f"- candidate_missing_ids: `{candidate_missing_ids_path}`",
            f"- hold_review: `{hold_review_path}`",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"support_ratio_payload_rows={len(support_payloads)}")
    print(f"total_scale_recovered_rows={len(total_payloads)}")
    print(f"total_scale_hold_rows={len(total_hold)}")
    print(f"candidate_missing_review_rows={len(candidate_missing_review)}")
    print(f"candidate_missing_ids={candidate_missing_ids_path}")
    print(f"hold_review_rows={len(hold_rows)}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
