from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")


def latest_report() -> Path:
    reports = sorted(
        REPORT_DIR.glob("policy_amount_url_reparse_reevaluated_*.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not reports:
        reports = sorted(
            REPORT_DIR.glob("policy_amount_url_reparse_*.json"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
    if not reports:
        raise FileNotFoundError("No policy_amount_url_reparse JSON report found.")
    return reports[0]


def text_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def selected_context(row: dict[str, Any]) -> str:
    selected = row.get("new_selected_candidate") or {}
    return text_value(
        selected.get("local_context")
        or selected.get("evidence")
        or selected.get("raw_text")
        or ""
    ).replace("\x00", "").replace("\n", " ")


def delta_bucket(old_amount: float | None, new_amount: float | None) -> str:
    if old_amount in (None, 0) or new_amount in (None, 0):
        return "zero_or_missing"
    ratio = new_amount / old_amount
    if ratio >= 100:
        return "new_100x_plus"
    if ratio >= 10:
        return "new_10x_plus"
    if ratio >= 2:
        return "new_2x_plus"
    if ratio <= 0.01:
        return "new_1pct_or_less"
    if ratio <= 0.1:
        return "new_10pct_or_less"
    if ratio <= 0.5:
        return "new_half_or_less"
    return "moderate_delta"


def classify_pattern(row: dict[str, Any]) -> str:
    context = selected_context(row)
    old_amount = row.get("old_amount_manwon")
    new_amount = row.get("new_selected_amount_manwon")

    if any(keyword in context for keyword in ["매출액", "연매출"]):
        return "risk_revenue_condition_selected"
    if any(keyword in context for keyword in ["벌금", "징역", "벌칙", "제재", "부정"]):
        return "risk_penalty_or_sanction_selected"
    if any(keyword in context for keyword in ["총 지원금", "총지원금", "총 금액", "총금액", "합계액", "누적"]):
        return "risk_total_or_cumulative_selected"
    if any(keyword in context for keyword in ["총사업비", "총 사업비", "전체예산", "총예산", "사업비 지원형식"]):
        return "risk_total_project_cost_context"
    if any(keyword in context for keyword in ["제외", "초과", "이상 사업에 추가 지원 불가"]):
        return "risk_exclusion_or_threshold_selected"
    if old_amount and new_amount:
        ratio = new_amount / old_amount
        if 9.5 <= ratio <= 10.5 or 95 <= ratio <= 105 or 0.095 <= ratio <= 0.105:
            return "possible_unit_scale_error"
    if any(keyword in context for keyword in ["기업당", "기업별", "제품당", "과제당", "최대", "한도", "이내", "내외"]):
        return "likely_new_limit_candidate"
    return "needs_manual_review"


def has_large_delta(row: dict[str, Any]) -> bool:
    return any(
        text_value(reason).startswith("large_amount_delta")
        for reason in row.get("decision_reasons") or []
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze large amount delta rows.")
    parser.add_argument("--input-json", default="")
    parser.add_argument("--output-dir", default=str(REPORT_DIR))
    args = parser.parse_args()

    input_path = Path(args.input_json) if args.input_json else latest_report()
    rows = json.loads(input_path.read_text(encoding="utf-8"))
    hits = [row for row in rows if has_large_delta(row)]

    analyzed: list[dict[str, Any]] = []
    for row in hits:
        old_amount = row.get("old_amount_manwon")
        new_amount = row.get("new_selected_amount_manwon")
        context = selected_context(row)
        analyzed.append(
            {
                "policy_id": row.get("policy_id"),
                "title": row.get("title"),
                "organization": row.get("organization"),
                "old_amount_manwon": old_amount,
                "old_amount_type": row.get("old_amount_type"),
                "old_roi_apply_method": row.get("old_roi_apply_method"),
                "new_amount_manwon": new_amount,
                "new_amount_type": row.get("new_selected_type"),
                "new_roi_apply_method": row.get("new_roi_apply_method"),
                "delta_bucket": delta_bucket(old_amount, new_amount),
                "pattern": classify_pattern(row),
                "decision_reasons": " | ".join(row.get("decision_reasons") or []),
                "comparison_reasons": " | ".join(row.get("comparison_reasons") or []),
                "selected_context": context[:900],
                "url": row.get("url"),
            }
        )

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "large_amount_delta_analysis.csv"
    md_path = output_dir / "large_amount_delta_analysis.md"

    fields = [
        "policy_id",
        "title",
        "organization",
        "old_amount_manwon",
        "old_amount_type",
        "old_roi_apply_method",
        "new_amount_manwon",
        "new_amount_type",
        "new_roi_apply_method",
        "delta_bucket",
        "pattern",
        "decision_reasons",
        "comparison_reasons",
        "selected_context",
        "url",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, escapechar="\\")
        writer.writeheader()
        writer.writerows(analyzed)

    bucket_counts: dict[str, int] = {}
    pattern_counts: dict[str, int] = {}
    for row in analyzed:
        bucket_counts[row["delta_bucket"]] = bucket_counts.get(row["delta_bucket"], 0) + 1
        pattern_counts[row["pattern"]] = pattern_counts.get(row["pattern"], 0) + 1

    lines = [
        f"input={input_path}",
        f"large_amount_delta_count={len(analyzed)}",
        "",
        "## delta_bucket",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(bucket_counts.items()))
    lines.extend(["", "## pattern"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(pattern_counts.items()))
    lines.extend(["", "## samples"])
    for pattern in sorted(pattern_counts):
        lines.extend(["", f"### {pattern}"])
        for row in [item for item in analyzed if item["pattern"] == pattern][:5]:
            lines.extend(
                [
                    f"- {row['policy_id']} | old={row['old_amount_manwon']} -> new={row['new_amount_manwon']} | {row['title']}",
                    f"  - {row['selected_context'][:300]}",
                ]
            )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"input={input_path}")
    print(f"rows={len(rows)}")
    print(f"large_amount_delta={len(analyzed)}")
    print(f"csv={csv_path}")
    print(f"md={md_path}")
    print(f"patterns={pattern_counts}")


if __name__ == "__main__":
    main()
