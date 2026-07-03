from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_PAYLOAD_JSON = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_support_candidate_payload_20260703_134149.json"
)
DEFAULT_AUDIT_CSV = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_support_candidate_audit_20260703_134149.csv"
)

DIRECT_TYPES = {"subsidy", "support_amount", "voucher"}
RATIO_TYPES = {"support_ratio"}
NON_CASH_TYPES = {"non_cash", "consulting_fee", "equipment_usage_fee", "education_fee", "fee"}
FINANCE_TYPES = {"loan", "guarantee", "interest_support"}
TOTAL_TYPES = {"total_support_scale"}


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


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


def read_csv(path: Path) -> list[dict[str, str]]:
    content = path.read_text(encoding="utf-8-sig").replace("\x00", "")
    return list(csv.DictReader(content.splitlines()))


def type_counts(candidates: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for candidate in candidates:
        amount_type = clean(candidate.get("max_amount_type")) or "unknown"
        counts[amount_type] = counts.get(amount_type, 0) + 1
    return counts


def candidate_summary(candidates: list[dict[str, Any]], limit: int = 8) -> str:
    parts: list[str] = []
    for candidate in candidates[:limit]:
        parts.append(
            (
                f"{candidate.get('amount_manwon')}만원/"
                f"{clean(candidate.get('max_amount_type'))}/"
                f"{clean(candidate.get('roi_apply_method'))}: "
                f"{clean(candidate.get('local_context') or candidate.get('evidence') or candidate.get('raw_text'), 220)}"
            )
        )
    if len(candidates) > limit:
        parts.append(f"... 후보 {len(candidates) - limit}개 추가")
    return " || ".join(parts)


def classify_fixability(candidates: list[dict[str, Any]]) -> tuple[str, str]:
    counts = type_counts(candidates)
    types = set(counts)
    if not candidates:
        return "no_support_candidate", "지원 후보가 없어 대표금액 수정 불가"
    if types & DIRECT_TYPES:
        return "manual_representative_recoverable", "현금성/바우처 후보가 있어 수기검수로 대표금액 회수 가능"
    if types <= RATIO_TYPES:
        return "ratio_only", "지원비율만 있어 금액 대표값은 만들 수 없음"
    if types <= NON_CASH_TYPES:
        return "recommend_only_payload", "비현금/수수료/컨설팅성 지원이라 ROI 직접 차감은 불가"
    if types <= FINANCE_TYPES:
        return "finance_exclude_payload", "융자/보증/이차보전 계열이라 ROI 직접 차감은 불가"
    if types <= TOTAL_TYPES:
        return "total_scale_manual_review", "지원규모 계열만 있어 기업당/과제당 한도 여부 수기확인 필요"
    return "mixed_manual_review", "지원 후보가 혼합되어 대표금액/적용방식 수기확인 필요"


def main() -> None:
    parser = argparse.ArgumentParser(description="Review json-only rows for additional fixable amount updates.")
    parser.add_argument("--payload-json", default=str(DEFAULT_PAYLOAD_JSON))
    parser.add_argument("--audit-csv", default=str(DEFAULT_AUDIT_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "support_candidate_payload_510"))
    args = parser.parse_args()

    payloads = json.loads(Path(args.payload_json).read_text(encoding="utf-8"))
    audit_rows = read_csv(Path(args.audit_csv))
    audit_by_id = {clean(row.get("policy_id")): row for row in audit_rows}

    review_rows: list[dict[str, Any]] = []
    for payload in payloads:
        policy_id = clean(payload.get("policy_id"))
        audit = audit_by_id.get(policy_id, {})
        if clean(audit.get("payload_source")) != "json_only_review":
            continue
        candidates = payload.get("amount_candidates") or []
        group, reason = classify_fixability(candidates)
        counts = type_counts(candidates)
        review_rows.append(
            {
                "policy_id": policy_id,
                "title": audit.get("title"),
                "organization": audit.get("organization"),
                "fixability_group": group,
                "fixability_reason": reason,
                "candidate_types": " | ".join(f"{key}:{value}" for key, value in sorted(counts.items())),
                "support_candidate_count": len(candidates),
                "old_decision": audit.get("decision"),
                "old_decision_reasons": audit.get("decision_reasons"),
                "candidate_summary": candidate_summary(candidates),
                "manual_review_decision": "",
                "manual_selected_amount_manwon": "",
                "manual_selected_amount_type": "",
                "manual_roi_apply_method": "",
                "manual_evidence": "",
                "manual_note": "",
                "url": audit.get("url"),
            }
        )

    counts: dict[str, int] = {}
    for row in review_rows:
        group = row["fixability_group"]
        counts[group] = counts.get(group, 0) + 1

    output_dir = Path(args.output_dir)
    csv_path = output_dir / "policy_amount_510_json_only_fixable_review.csv"
    md_path = output_dir / "policy_amount_510_json_only_fixable_review.md"
    write_csv(csv_path, review_rows)

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"json_only_review_rows={len(review_rows)}",
        "",
        "## fixability_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(counts.items()))
    lines.extend(["", "## samples"])
    for group in sorted(counts):
        lines.extend(["", f"### {group}"])
        for row in [item for item in review_rows if item["fixability_group"] == group][:6]:
            lines.extend(
                [
                    f"- {row['policy_id']} | {row['title']}",
                    f"  - reason: {row['fixability_reason']}",
                    f"  - types: {row['candidate_types']}",
                    f"  - candidates: {clean(row['candidate_summary'], 320)}",
                ]
            )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"json_only_review_rows={len(review_rows)}")
    for key, value in sorted(counts.items()):
        print(f"{key}: {value}")
    print(f"csv={csv_path}")
    print(f"md={md_path}")


if __name__ == "__main__":
    main()
