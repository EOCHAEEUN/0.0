from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
REPRESENTATIVE_TYPES = {"support_amount", "subsidy", "voucher"}
TOTAL_TYPES = {"total_support_scale", "total_budget", "project_budget", "total_project_cost"}
NON_CASH_TYPES = {"non_cash", "consulting_fee", "education_fee", "equipment_usage_fee", "fee"}
FINANCE_TYPES = {"loan", "guarantee", "interest_support"}


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


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
                f"{clean(candidate.get('display_amount'))}/"
                f"{clean(candidate.get('max_amount_type'))}/"
                f"{clean(candidate.get('roi_apply_method'))}: "
                f"{clean(candidate.get('local_context') or candidate.get('evidence') or candidate.get('raw_text'), 180)}"
            )
        )
    if len(candidates) > limit:
        parts.append(f"... 후보 {len(candidates) - limit}개 추가")
    return " || ".join(parts)


def classify_group(candidates: list[dict[str, Any]]) -> tuple[str, str, str]:
    counts = type_counts(candidates)
    types = set(counts)
    amount_candidates = [candidate for candidate in candidates if candidate.get("amount_manwon") is not None]
    representative_candidates = [
        candidate for candidate in candidates
        if clean(candidate.get("max_amount_type")) in REPRESENTATIVE_TYPES
        and candidate.get("amount_manwon") is not None
    ]
    if types == {"support_ratio"}:
        return "support_ratio_only", "store_support_ratio_only", "지원비율만 있어 대표금액은 만들지 않습니다."
    if types and types.issubset(TOTAL_TYPES):
        return "total_scale_only", "exclude_amount_update", "총지원규모/총사업비 계열만 있어 대표금액 제외가 맞습니다."
    if types and types.issubset(NON_CASH_TYPES):
        return "non_cash_only", "recommend_only_or_exclude", "비현금/수수료/인증성 후보만 있어 ROI 직접 차감 제외 후보입니다."
    if types and types.issubset(FINANCE_TYPES):
        return "finance_only", "exclude_amount_update", "금융성 한도만 있어 ROI 직접 차감 제외 후보입니다."
    if types == {"unknown"}:
        return "unknown_only", "needs_gemini_or_rule", "금액은 있으나 성격 분류가 안 되어 추가 검수가 필요합니다."
    if "support_ratio" in types and not amount_candidates:
        return "support_ratio_only", "store_support_ratio_only", "금액 없이 지원비율만 있어 대표금액은 보류합니다."
    if representative_candidates:
        return "representative_candidate_not_selected", "selection_rule_review", "현금성 후보가 있는데 선택되지 않아 선택 규칙 검토가 필요합니다."
    if "unknown" in types:
        return "mixed_with_unknown", "needs_gemini_or_rule", "unknown 후보가 섞여 있어 문맥/표 검수가 필요합니다."
    return "mixed_non_representative", "exclude_or_policy_decision", "대표금액 제외 타입이 혼합되어 정책 판단이 필요합니다."


def has_reason(row: dict[str, Any], reason: str) -> bool:
    return reason in (row.get("decision_reasons") or [])


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze selected_candidate_missing rows.")
    parser.add_argument("--input-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "selected_candidate_missing"))
    args = parser.parse_args()

    input_path = Path(args.input_json)
    rows = json.loads(input_path.read_text(encoding="utf-8"))
    hits = [row for row in rows if has_reason(row, "selected_candidate_missing")]
    analyzed: list[dict[str, Any]] = []
    for row in hits:
        candidates = row.get("new_amount_candidates") or []
        counts = type_counts(candidates)
        group, suggested_action, reason = classify_group(candidates)
        analyzed.append(
            {
                "policy_id": row.get("policy_id"),
                "title": row.get("title"),
                "organization": row.get("organization"),
                "fetch_status": row.get("fetch_status"),
                "source_kind": row.get("source_kind"),
                "candidate_count": len(candidates),
                "candidate_types": " | ".join(f"{key}:{value}" for key, value in sorted(counts.items())),
                "group": group,
                "suggested_action": suggested_action,
                "suggested_reason": reason,
                "support_ratio": (row.get("derived_fields") or {}).get("support_ratio") or row.get("new_support_ratio"),
                "old_amount_manwon": row.get("old_amount_manwon"),
                "old_amount_actual": row.get("old_actual"),
                "old_amount_type": row.get("old_amount_type"),
                "old_roi_apply_method": row.get("old_roi_apply_method"),
                "candidate_summary": candidate_summary(candidates),
                "url": row.get("url"),
            }
        )

    group_counts: dict[str, int] = {}
    action_counts: dict[str, int] = {}
    for row in analyzed:
        group_counts[row["group"]] = group_counts.get(row["group"], 0) + 1
        action_counts[row["suggested_action"]] = action_counts.get(row["suggested_action"], 0) + 1

    output_dir = Path(args.output_dir)
    csv_path = output_dir / "selected_candidate_missing_analysis.csv"
    md_path = output_dir / "selected_candidate_missing_analysis.md"
    write_csv(csv_path, analyzed)

    lines = [
        f"input={input_path}",
        f"selected_candidate_missing={len(analyzed)}",
        "",
        "## group_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(group_counts.items()))
    lines.extend(["", "## suggested_action_counts"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(action_counts.items()))
    for group in sorted(group_counts):
        lines.extend(["", f"### {group}"])
        for row in [item for item in analyzed if item["group"] == group][:8]:
            lines.extend(
                [
                    f"- {row['policy_id']} | {row['title']}",
                    f"  - types: {row['candidate_types']}",
                    f"  - action: {row['suggested_action']} / {row['suggested_reason']}",
                    f"  - candidates: {clean(row['candidate_summary'], 320)}",
                ]
            )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"input={input_path}")
    print(f"selected_candidate_missing={len(analyzed)}")
    print(f"group_counts={group_counts}")
    print(f"action_counts={action_counts}")
    print(f"csv={csv_path}")
    print(f"md={md_path}")


if __name__ == "__main__":
    main()
