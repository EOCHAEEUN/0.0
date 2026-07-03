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
DEFAULT_REVIEW_CSV = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_json_only_fixable_review.csv"
)
DEFAULT_SUPPORT_PAYLOAD = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_support_candidate_payload_20260703_134149.json"
)

DIRECT_TYPES = {"support_amount", "subsidy", "voucher"}
LIMIT_WORDS = {
    "기업당", "기업별", "업체당", "개사당", "1개사", "과제당", "사업장당", "건당",
    "지원한도", "지원 한도", "최대", "이내", "내외",
}
STRONG_ENTITY_WORDS = {"기업당", "기업별", "업체당", "개사당", "1개사", "과제당", "사업장당", "건당"}
UNIT_WORDS = {
    "월", "매월", "월별", "월 기업부담금", "월 지원", "월 납입", "연간", "년간",
    "1명", "명당", "인당", "근로자", "채용", "/점", "점당",
}
TABLE_SPLIT_WORDS = {"기업부담금", "자부담", "민간부담", "부담금", "지원금 청구", "소요금액", "공급가액"}
TOTAL_WORDS = {"총지원규모", "총 지원규모", "지원규모", "총사업비", "총 사업비", "전체예산", "사업예산", "예산규모"}
MULTI_PROGRAM_WORDS = {"구분", "세부사업명", "지원분야", "지원내용", "프로그램", "세부 프로그램", "지원유형"}
CONSORTIUM_WORDS = {"컨소시엄", "공동연구", "합계", "참여기업들", "연구개발기간"}


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


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def has_any(text: str, words: set[str]) -> bool:
    return any(word in text for word in words)


def direct_candidates(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        candidate for candidate in payload.get("amount_candidates") or []
        if clean(candidate.get("max_amount_type")) in DIRECT_TYPES
        and candidate.get("amount_manwon") is not None
    ]


def candidate_context(candidate: dict[str, Any]) -> str:
    return clean(candidate.get("local_context") or candidate.get("evidence") or candidate.get("raw_text"), 900)


def is_clear_entity_limit(candidate: dict[str, Any]) -> bool:
    context = candidate_context(candidate)
    if not has_any(context, LIMIT_WORDS):
        return False
    if has_any(context, UNIT_WORDS):
        return False
    if has_any(context, TABLE_SPLIT_WORDS):
        return False
    if has_any(context, CONSORTIUM_WORDS):
        return False
    if has_any(context, TOTAL_WORDS) and not has_any(context, STRONG_ENTITY_WORDS):
        return False
    return True


def has_extreme_delta(old_amount: Any, new_amount: Any) -> bool:
    try:
        old = float(old_amount or 0)
        new = float(new_amount or 0)
    except (TypeError, ValueError):
        return False
    if old <= 0 or new <= 0:
        return False
    ratio = max(old, new) / max(min(old, new), 1)
    return ratio >= 5


def classify_row(review_row: dict[str, str], payload: dict[str, Any]) -> tuple[str, str, dict[str, Any] | None]:
    candidates = direct_candidates(payload)
    if not candidates:
        return "gemini_second_review", "현금성 후보가 사라져 문맥 2차 검수 필요", None

    contexts = " ".join(candidate_context(candidate) for candidate in candidates)
    if has_any(contexts, UNIT_WORDS):
        return "unit_conversion_needed", "월/명/연간/건별 단위가 섞여 환산 기준 필요", None
    if has_any(contexts, CONSORTIUM_WORDS):
        return "consortium_or_period_ambiguous", "컨소시엄/기간/합계 기준이 섞여 기업 대표금액 확정 불가", None
    if has_any(contexts, TABLE_SPLIT_WORDS):
        return "support_vs_self_funding_split_needed", "표에서 지원금/자부담/소요금액 분리가 필요", None
    if len(candidates) >= 3 or has_any(contexts, MULTI_PROGRAM_WORDS):
        clear_candidates = [candidate for candidate in candidates if is_clear_entity_limit(candidate)]
        if len(clear_candidates) == 1 and not has_extreme_delta(review_row.get("old_amount_manwon"), clear_candidates[0].get("amount_manwon")):
            return "auto_adopt_clear_limit", "다중 후보 중 기업/과제/건당 한도 후보가 1개로 명확", clear_candidates[0]
        return "multi_program_representative_needed", "여러 지원 프로그램 후보 중 대표 선택 기준 필요", None

    clear_candidates = [candidate for candidate in candidates if is_clear_entity_limit(candidate)]
    if len(clear_candidates) == 1:
        selected = clear_candidates[0]
        if has_extreme_delta(review_row.get("old_amount_manwon"), selected.get("amount_manwon")):
            return "large_delta_needs_check", "기업 단위 한도처럼 보이나 기존값과 차이가 커 확인 필요", None
        return "auto_adopt_clear_limit", "기업당/과제당/업체당/건당 한도 문맥이 명확", selected
    if len(clear_candidates) > 1:
        return "multi_program_representative_needed", "명확한 한도 후보가 여러 개라 대표 선택 필요", None

    if "large_amount_delta" in clean(review_row.get("old_decision_reasons")):
        return "large_delta_needs_check", "기존값과 새 후보 차이가 커 확인 필요", None
    return "gemini_second_review", "규칙으로 대표금액 확정 불가, Gemini 2차 검수 대상", None


def payload_from_selected(policy_id: str, candidates: list[dict[str, Any]], selected: dict[str, Any]) -> dict[str, Any]:
    normalized = []
    for candidate in candidates:
        row = dict(candidate)
        row["is_selected_amount"] = (
            row.get("amount_manwon") == selected.get("amount_manwon")
            and clean(row.get("max_amount_type")) == clean(selected.get("max_amount_type"))
            and clean(row.get("local_context") or row.get("evidence")) == clean(selected.get("local_context") or selected.get("evidence"))
        )
        normalized.append(row)
    selected = dict(selected)
    selected["is_selected_amount"] = True
    derived = amount_utils.derive_policy_amount_fields(selected, normalized)
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Split 91 recoverable manual-review rows into auto/Gemini/manual groups.")
    parser.add_argument("--review-csv", default=str(DEFAULT_REVIEW_CSV))
    parser.add_argument("--support-payload", default=str(DEFAULT_SUPPORT_PAYLOAD))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "manual_representative_91"))
    args = parser.parse_args()

    review_rows = [
        row for row in read_csv(Path(args.review_csv))
        if clean(row.get("fixability_group")) == "manual_representative_recoverable"
    ]
    payload_rows = json.loads(Path(args.support_payload).read_text(encoding="utf-8"))
    payload_by_id = {clean(row.get("policy_id")): row for row in payload_rows}

    classified: list[dict[str, Any]] = []
    auto_payloads: list[dict[str, Any]] = []
    gemini_rows: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    for review in review_rows:
        policy_id = clean(review.get("policy_id"))
        payload = payload_by_id.get(policy_id, {"policy_id": policy_id, "amount_candidates": []})
        category, reason, selected = classify_row(review, payload)
        counts[category] = counts.get(category, 0) + 1
        candidates = direct_candidates(payload)
        row = {
            "policy_id": policy_id,
            "title": review.get("title"),
            "organization": review.get("organization"),
            "stage2_category": category,
            "stage2_category_ko": {
                "auto_adopt_clear_limit": "자동 채택 가능: 기업/과제/건당 한도 명확",
                "unit_conversion_needed": "월/명/연간 환산 필요",
                "large_delta_needs_check": "기존값과 큰 차이",
                "support_vs_self_funding_split_needed": "표에서 지원금/자부담 분리 필요",
                "multi_program_representative_needed": "다중 프로그램 중 대표 선택 필요",
                "consortium_or_period_ambiguous": "컨소시엄/기간/합계 기준 애매",
                "gemini_second_review": "Gemini 2차 검수 대상",
            }.get(category, category),
            "stage2_reason": reason,
            "old_amount_manwon": "",
            "candidate_count": len(candidates),
            "selected_amount_manwon": selected.get("amount_manwon") if selected else "",
            "selected_amount_type": selected.get("max_amount_type") if selected else "",
            "selected_context": candidate_context(selected) if selected else "",
            "direct_candidate_summary": " || ".join(
                f"{candidate.get('amount_manwon')}만원/{clean(candidate.get('max_amount_type'))}: {candidate_context(candidate)[:220]}"
                for candidate in candidates[:8]
            ),
            "manual_review_decision": "",
            "manual_selected_amount_manwon": "",
            "manual_evidence": "",
            "manual_note": "",
            "url": review.get("url"),
        }
        classified.append(row)
        if category == "auto_adopt_clear_limit" and selected:
            auto_payloads.append(payload_from_selected(policy_id, payload.get("amount_candidates") or [], selected))
        elif category in {"gemini_second_review", "multi_program_representative_needed", "large_delta_needs_check"}:
            gemini_rows.append(row)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    classified_path = output_dir / f"manual_representative_91_stage2_classification_{timestamp}.csv"
    auto_payload_path = output_dir / f"manual_representative_91_auto_adopt_payload_{timestamp}.json"
    auto_audit_path = output_dir / f"manual_representative_91_auto_adopt_audit_{timestamp}.csv"
    gemini_path = output_dir / f"manual_representative_91_gemini_targets_{timestamp}.csv"
    summary_path = output_dir / f"manual_representative_91_stage2_summary_{timestamp}.md"

    write_csv(classified_path, classified)
    write_json(auto_payload_path, auto_payloads)
    write_csv(auto_audit_path, [row for row in classified if row["stage2_category"] == "auto_adopt_clear_limit"])
    write_csv(gemini_path, gemini_rows)

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"source_rows={len(review_rows)}",
        f"auto_adopt_payload_rows={len(auto_payloads)}",
        f"gemini_target_rows={len(gemini_rows)}",
        "",
        "## stage2_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(counts.items()))
    lines.extend(
        [
            "",
            "## outputs",
            f"- classification_csv: `{classified_path}`",
            f"- auto_adopt_payload: `{auto_payload_path}`",
            f"- auto_adopt_audit: `{auto_audit_path}`",
            f"- gemini_targets: `{gemini_path}`",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"source_rows={len(review_rows)}")
    print(f"auto_adopt_payload_rows={len(auto_payloads)}")
    print(f"gemini_target_rows={len(gemini_rows)}")
    for key, value in sorted(counts.items()):
        print(f"{key}: {value}")
    print(f"classification_csv={classified_path}")
    print(f"auto_adopt_payload={auto_payload_path}")
    print(f"gemini_targets={gemini_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
