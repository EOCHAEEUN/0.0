from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_INTEGRATED_PAYLOAD = (
    REPORT_DIR / "integrated_update" / "policy_amount_integrated_payload_20260703_124943.json"
)
DEFAULT_LARGE_DELTA_FINAL_AUDIT = (
    REPORT_DIR / "large_amount_delta_final" / "large_amount_delta_final_audit_20260703_122144.csv"
)
DEFAULT_LARGE_DELTA_ADJUDICATION = (
    REPORT_DIR / "large_amount_delta_adjudication" / "large_amount_delta_adjudication.csv"
)
DEFAULT_LARGE_DELTA_HOLD_BREAKDOWN = (
    REPORT_DIR / "large_amount_delta_resolution" / "large_amount_delta_hold_breakdown_20260703_121239.csv"
)
DEFAULT_LARGE_DELTA_GEMINI = (
    REPORT_DIR / "large_amount_delta_gemini_review" / "large_amount_delta_gemini_review_20260703_121908.csv"
)
DEFAULT_SELECTED_ANALYSIS = (
    REPORT_DIR / "selected_candidate_missing" / "selected_candidate_missing_analysis.csv"
)
DEFAULT_SELECTED_GEMINI = (
    REPORT_DIR / "selected_candidate_missing_gemini" / "selected_candidate_missing_gemini_review_20260703_124656.csv"
)


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


def has_reason(row: dict[str, Any], reason: str) -> bool:
    return reason in (row.get("decision_reasons") or [])


def classify_candidate_missing(row: dict[str, Any]) -> tuple[str, str, str]:
    status = clean(row.get("fetch_status"))
    source = clean(row.get("source_kind"))
    title = clean(row.get("title"))
    if status in {"fetch_failed", "missing_url", "fetched_empty"}:
        return "source_fetch_issue", "retry_or_manual_source", "원문 조회 실패/빈 본문이라 재조회 또는 수동 원문 확인 필요"
    if any(keyword in title for keyword in ["교육", "훈련", "컨설팅", "상담", "멘토링"]):
        return "likely_non_cash_no_amount", "recommend_only_or_exclude", "교육/컨설팅성 공고로 대표 현금지원금이 없을 가능성"
    if source == "fallback":
        return "fallback_text_only", "reparse_source", "URL/첨부 원문 대신 기존 텍스트로 분석되어 재수집 필요"
    return "no_amount_found_in_source", "manual_or_ocr_review", "원문에서 금액 후보가 없어 표/OCR/첨부 품질 확인 필요"


def main() -> None:
    parser = argparse.ArgumentParser(description="Build consolidated remaining amount review summary.")
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--integrated-payload", default=str(DEFAULT_INTEGRATED_PAYLOAD))
    parser.add_argument("--large-delta-final-audit", default=str(DEFAULT_LARGE_DELTA_FINAL_AUDIT))
    parser.add_argument("--large-delta-adjudication", default=str(DEFAULT_LARGE_DELTA_ADJUDICATION))
    parser.add_argument("--large-delta-hold-breakdown", default=str(DEFAULT_LARGE_DELTA_HOLD_BREAKDOWN))
    parser.add_argument("--large-delta-gemini", default=str(DEFAULT_LARGE_DELTA_GEMINI))
    parser.add_argument("--selected-analysis", default=str(DEFAULT_SELECTED_ANALYSIS))
    parser.add_argument("--selected-gemini", default=str(DEFAULT_SELECTED_GEMINI))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "remaining_review"))
    args = parser.parse_args()

    reparse_rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in reparse_rows}
    integrated_payload = json.loads(Path(args.integrated_payload).read_text(encoding="utf-8"))
    update_ids = {clean(row.get("policy_id")) for row in integrated_payload}

    large_delta_adopt_ids = {
        clean(row.get("policy_id"))
        for row in read_csv(Path(args.large_delta_final_audit))
    }
    large_delta_adjudication_rows = read_csv(Path(args.large_delta_adjudication))
    large_delta_hold_breakdown_rows = read_csv(Path(args.large_delta_hold_breakdown))
    large_delta_gemini_rows = read_csv(Path(args.large_delta_gemini))
    large_delta_keep_old_ids = {
        clean(row.get("policy_id"))
        for row in large_delta_adjudication_rows
        if clean(row.get("suggested_action")) == "keep_old"
    } | {
        clean(row.get("policy_id"))
        for row in large_delta_gemini_rows
        if clean(row.get("final_suggested_action")) == "keep_old"
    }
    gemini_resolved_ids = {
        clean(row.get("policy_id"))
        for row in large_delta_gemini_rows
        if clean(row.get("final_suggested_action")) in {"adopt_new", "keep_old"}
    }
    large_delta_hold_ids = {
        clean(row.get("policy_id"))
        for row in large_delta_hold_breakdown_rows
        if clean(row.get("policy_id")) not in gemini_resolved_ids
    }

    selected_analysis_rows = read_csv(Path(args.selected_analysis))
    selected_gemini_rows = read_csv(Path(args.selected_gemini))
    selected_adopt_ids = {
        clean(row.get("policy_id"))
        for row in selected_gemini_rows
        if clean(row.get("final_suggested_action")) == "adopt_candidate"
    }
    selected_keep_no_rep_ids = {
        clean(row.get("policy_id"))
        for row in selected_gemini_rows
        if clean(row.get("final_suggested_action")) == "keep_no_representative"
    }
    selected_hold_ids = {
        clean(row.get("policy_id"))
        for row in selected_gemini_rows
        if clean(row.get("final_suggested_action")) == "hold"
    }

    review_rows: list[dict[str, Any]] = []
    assigned_ids: set[str] = set()

    def add_review(
        policy_id: str,
        bucket: str,
        action: str,
        reason: str,
        *,
        subtype: str = "",
        source: str = "",
    ) -> None:
        if policy_id in assigned_ids:
            return
        assigned_ids.add(policy_id)
        row = rows_by_id.get(policy_id, {})
        review_rows.append(
            {
                "policy_id": policy_id,
                "title": row.get("title"),
                "organization": row.get("organization"),
                "bucket": bucket,
                "subtype": subtype,
                "recommended_action": action,
                "review_reason": reason,
                "source": source,
                "old_amount_manwon": row.get("old_amount_manwon"),
                "old_amount_actual": row.get("old_actual"),
                "decision_reasons": " | ".join(row.get("decision_reasons") or []),
                "candidate_count": row.get("candidate_count"),
                "url": row.get("url"),
            }
        )

    for policy_id in sorted(update_ids):
        add_review(policy_id, "resolved_update", "apply_payload_candidate", "통합 payload에 포함된 업데이트 후보")
    for policy_id in sorted(large_delta_keep_old_ids):
        add_review(policy_id, "resolved_keep_old", "no_update_keep_existing", "large_amount_delta 검수 결과 기존값 유지")
    for policy_id in sorted(large_delta_hold_ids):
        add_review(policy_id, "large_amount_delta_hold", "manual_review", "Gemini/규칙 후에도 기존값과 새값 확정 불가")

    for analysis in selected_analysis_rows:
        policy_id = clean(analysis.get("policy_id"))
        if policy_id in update_ids:
            continue
        group = clean(analysis.get("group"))
        suggested = clean(analysis.get("suggested_action"))
        reason = clean(analysis.get("suggested_reason"))
        if policy_id in selected_keep_no_rep_ids:
            add_review(policy_id, "selected_candidate_missing", "no_representative_amount", "Gemini 검수 결과 대표금액 없음", subtype=group)
        elif policy_id in selected_hold_ids:
            add_review(policy_id, "selected_candidate_missing", "manual_review", "Gemini 후보 제안이 sanity check에서 보류됨", subtype=group)
        elif group == "support_ratio_only":
            add_review(policy_id, "support_ratio_only", "store_support_ratio_only", reason, subtype=group)
        elif group == "non_cash_only":
            add_review(policy_id, "non_cash_only", "recommend_only_or_exclude", reason, subtype=group)
        elif group == "total_scale_only":
            add_review(policy_id, "total_scale_only", "recheck_total_vs_limit", "총규모로 분류됐으나 건당/기업별 한도 가능성 샘플 재검토 필요", subtype=group)
        elif suggested:
            add_review(policy_id, "selected_candidate_missing", suggested, reason, subtype=group)

    candidate_missing_rows = [
        row for row in reparse_rows
        if has_reason(row, "candidate_missing")
    ]
    for row in candidate_missing_rows:
        policy_id = clean(row.get("policy_id"))
        if policy_id in update_ids:
            continue
        subtype, action, reason = classify_candidate_missing(row)
        add_review(policy_id, "candidate_missing", action, reason, subtype=subtype)

    # Small residual reasons not captured above.
    for row in reparse_rows:
        policy_id = clean(row.get("policy_id"))
        if policy_id in update_ids:
            continue
        reasons = row.get("decision_reasons") or []
        if "subtract_without_limit_context" in reasons:
            add_review(policy_id, "residual_risk_reason", "manual_review", "한도/기업당 문맥 부족으로 보류 유지", subtype="subtract_without_limit_context")
        if "selected_context_has_risk_keyword" in reasons:
            add_review(policy_id, "residual_risk_reason", "manual_review", "선택 후보 주변 위험 키워드로 보류 유지", subtype="selected_context_has_risk_keyword")

    for row in reparse_rows:
        policy_id = clean(row.get("policy_id"))
        if policy_id in assigned_ids:
            continue
        decision = clean(row.get("decision"))
        amount_type = clean(row.get("new_amount_type"))
        roi_method = clean(row.get("new_roi_apply_method"))
        if decision == "safe":
            add_review(
                policy_id,
                "safe_non_update_remainder",
                "no_payload_update",
                "위험 사유는 없지만 통합 업데이트 payload 기준에는 포함되지 않은 잔여 건",
                subtype=f"{amount_type}/{roi_method}",
            )
        else:
            add_review(
                policy_id,
                "unclassified_remainder",
                "manual_review",
                "위 주요 묶음에 포함되지 않은 needs_review 잔여 건",
                subtype=" | ".join(row.get("decision_reasons") or []),
            )

    counts: dict[tuple[str, str], int] = {}
    for row in review_rows:
        key = (row["bucket"], row["recommended_action"])
        counts[key] = counts.get(key, 0) + 1

    output_dir = Path(args.output_dir)
    csv_path = output_dir / "remaining_amount_review_summary.csv"
    md_path = output_dir / "remaining_amount_review_summary.md"
    write_csv(csv_path, review_rows)

    lines = [
        f"reparse_json={args.reparse_json}",
        f"integrated_update_candidates={len(update_ids)}",
        f"review_rows={len(review_rows)}",
        "",
        "## bucket_action_counts",
    ]
    for (bucket, action), count in sorted(counts.items()):
        lines.append(f"- {bucket} / {action}: {count}")
    lines.extend(["", "## samples"])
    for bucket in sorted({row["bucket"] for row in review_rows}):
        lines.extend(["", f"### {bucket}"])
        for row in [item for item in review_rows if item["bucket"] == bucket][:8]:
            lines.extend(
                [
                    f"- {row['policy_id']} | {row.get('title')}",
                    f"  - action: {row['recommended_action']} / {row['subtype']}",
                    f"  - reason: {row['review_reason']}",
                ]
            )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"integrated_update_candidates={len(update_ids)}")
    print(f"review_rows={len(review_rows)}")
    print("bucket_action_counts=")
    for (bucket, action), count in sorted(counts.items()):
        print(f"  {bucket} / {action}: {count}")
    print(f"csv={csv_path}")
    print(f"md={md_path}")


if __name__ == "__main__":
    main()
