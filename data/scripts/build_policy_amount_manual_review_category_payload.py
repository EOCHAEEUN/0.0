from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REVIEW_CSV = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_json_only_fixable_review.csv"
)

CATEGORY_KO = {
    "manual_representative_recoverable": "대표금액 회수 가능 후보",
    "mixed_manual_review": "혼합 수기검수",
    "total_scale_manual_review": "지원규모 계열 검수",
    "ratio_only": "지원비율만 있음",
    "recommend_only_payload": "비현금/수수료/컨설팅성",
    "finance_exclude_payload": "융자/보증/이차보전",
}


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
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    text = str(value).replace("'", "''")
    return f"'{text}'"


def build_update_sql(rows: list[dict[str, Any]]) -> str:
    values = []
    for row in rows:
        values.append(
            "("
            f"{sql_literal(row['policy_id'])}, "
            f"{sql_literal(row['amount_manual_review_category'])}, "
            f"{sql_literal(row['amount_manual_review_category_ko'])}, "
            f"{sql_literal(row['amount_manual_review_reason'])}, "
            f"{sql_literal(row['amount_manual_review_status'])}"
            ")"
        )
    values_sql = ",\n        ".join(values)
    return f"""-- DRY-RUN generated SQL. Review before execution.
-- Updates manual amount review category on policy and policy_01_amount_detail.

WITH manual_review_values (
    policy_id,
    amount_manual_review_category,
    amount_manual_review_category_ko,
    amount_manual_review_reason,
    amount_manual_review_status
) AS (
    VALUES
        {values_sql}
)
UPDATE public.policy AS p
SET
    amount_manual_review_required = true,
    amount_manual_review_category = v.amount_manual_review_category,
    amount_manual_review_category_ko = v.amount_manual_review_category_ko,
    amount_manual_review_reason = v.amount_manual_review_reason,
    amount_manual_review_status = v.amount_manual_review_status
FROM manual_review_values AS v
WHERE p.policy_id = v.policy_id;

WITH manual_review_values (
    policy_id,
    amount_manual_review_category,
    amount_manual_review_category_ko,
    amount_manual_review_reason,
    amount_manual_review_status
) AS (
    VALUES
        {values_sql}
)
UPDATE public.policy_01_amount_detail AS d
SET
    amount_manual_review_required = true,
    amount_manual_review_category = v.amount_manual_review_category,
    amount_manual_review_category_ko = v.amount_manual_review_category_ko,
    amount_manual_review_reason = v.amount_manual_review_reason,
    amount_manual_review_status = v.amount_manual_review_status
FROM manual_review_values AS v
WHERE d.policy_id = v.policy_id;
"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build manual review category payload for policy amount JSON-only review rows."
    )
    parser.add_argument("--review-csv", default=str(DEFAULT_REVIEW_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "support_candidate_payload_510"))
    args = parser.parse_args()

    input_rows = read_csv(Path(args.review_csv))
    rows: list[dict[str, Any]] = []
    for row in input_rows:
        category = clean(row.get("fixability_group"))
        rows.append(
            {
                "policy_id": row.get("policy_id"),
                "title": row.get("title"),
                "organization": row.get("organization"),
                "amount_manual_review_required": True,
                "amount_manual_review_category": category,
                "amount_manual_review_category_ko": CATEGORY_KO.get(category, category),
                "amount_manual_review_reason": row.get("fixability_reason"),
                "amount_manual_review_status": "pending",
                "candidate_types": row.get("candidate_types"),
                "support_candidate_count": row.get("support_candidate_count"),
                "candidate_summary": row.get("candidate_summary"),
                "manual_review_decision": "",
                "manual_selected_amount_manwon": "",
                "manual_selected_amount_type": "",
                "manual_roi_apply_method": "",
                "manual_evidence": "",
                "manual_note": "",
                "url": row.get("url"),
            }
        )

    counts: dict[str, int] = {}
    for row in rows:
        key = row["amount_manual_review_category_ko"]
        counts[key] = counts.get(key, 0) + 1

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    csv_path = output_dir / f"policy_amount_manual_review_category_payload_{timestamp}.csv"
    json_path = output_dir / f"policy_amount_manual_review_category_payload_{timestamp}.json"
    sql_path = output_dir / f"policy_amount_manual_review_category_update_{timestamp}.sql"
    md_path = output_dir / f"policy_amount_manual_review_category_summary_{timestamp}.md"

    write_csv(csv_path, rows)
    write_json(json_path, rows)
    sql_path.write_text(build_update_sql(rows), encoding="utf-8")

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"manual_review_rows={len(rows)}",
        "",
        "## category_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(counts.items()))
    lines.extend(
        [
            "",
            "## columns",
            "- amount_manual_review_required: true",
            "- amount_manual_review_category: machine-readable category",
            "- amount_manual_review_category_ko: Korean category for manual review",
            "- amount_manual_review_reason: reason text",
            "- amount_manual_review_status: pending",
            "",
            "## outputs",
            f"- csv: `{csv_path}`",
            f"- json: `{json_path}`",
            f"- sql: `{sql_path}`",
        ]
    )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"manual_review_rows={len(rows)}")
    for key, value in sorted(counts.items()):
        print(f"{key}: {value}")
    print(f"csv={csv_path}")
    print(f"json={json_path}")
    print(f"sql={sql_path}")
    print(f"summary={md_path}")


if __name__ == "__main__":
    main()
