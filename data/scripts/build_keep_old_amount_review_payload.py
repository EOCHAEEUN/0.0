from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_url_reparse"
DEFAULT_ADJUDICATION_CSV = (
    REPORT_DIR / "large_amount_delta_adjudication" / "large_amount_delta_adjudication.csv"
)
DEFAULT_GEMINI_CSV = (
    REPORT_DIR / "large_amount_delta_gemini_review" / "large_amount_delta_gemini_review_20260703_121908.csv"
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
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()), escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def source_row_to_keep_old(row: dict[str, str], source: str) -> dict[str, Any]:
    reason = clean(
        row.get("gemini_reason")
        or row.get("suggested_reason")
        or "새 파싱값보다 기존 대표금액이 더 타당하다고 검수되어 기존값 유지",
        900,
    )
    return {
        "policy_id": clean(row.get("policy_id")),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "amount_manual_review_required": False,
        "amount_manual_review_category": "keep_old_amount",
        "amount_manual_review_category_ko": "기존값 유지",
        "amount_manual_review_reason": reason,
        "amount_manual_review_status": "reviewed",
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_actual": row.get("old_amount_actual"),
        "old_amount_type": row.get("old_amount_type"),
        "new_amount_manwon": row.get("new_amount_manwon"),
        "new_amount_actual": row.get("new_amount_actual"),
        "new_amount_type": row.get("new_amount_type"),
        "review_source": source,
        "review_note": "새 파싱 후보는 DB 대표금액에 반영하지 않고 기존값을 유지",
        "selected_context": clean(row.get("new_selected_context") or row.get("selected_context"), 900),
        "url": row.get("url"),
    }


def build_update_sql(rows: list[dict[str, Any]]) -> str:
    values = []
    for row in rows:
        values.append(
            "("
            f"{sql_literal(row['policy_id'])}, "
            "false, "
            f"{sql_literal(row['amount_manual_review_category'])}, "
            f"{sql_literal(row['amount_manual_review_category_ko'])}, "
            f"{sql_literal(row['amount_manual_review_reason'])}, "
            f"{sql_literal(row['amount_manual_review_status'])}, "
            f"{sql_literal(row['review_note'])}"
            ")"
        )
    values_sql = ",\n".join(values)
    return f"""
-- Marks rows where the existing policy amount was reviewed and kept.
WITH v(
    policy_id,
    amount_manual_review_required,
    amount_manual_review_category,
    amount_manual_review_category_ko,
    amount_manual_review_reason,
    amount_manual_review_status,
    amount_manual_review_note
) AS (
    VALUES
{values_sql}
)
UPDATE public.policy AS p
SET
    amount_manual_review_required = v.amount_manual_review_required,
    amount_manual_review_category = v.amount_manual_review_category,
    amount_manual_review_category_ko = v.amount_manual_review_category_ko,
    amount_manual_review_reason = v.amount_manual_review_reason,
    amount_manual_review_status = v.amount_manual_review_status,
    amount_manual_review_note = v.amount_manual_review_note
FROM v
WHERE p.policy_id = v.policy_id;

WITH v(
    policy_id,
    amount_manual_review_required,
    amount_manual_review_category,
    amount_manual_review_category_ko,
    amount_manual_review_reason,
    amount_manual_review_status,
    amount_manual_review_note
) AS (
    VALUES
{values_sql}
)
UPDATE public.policy_01_amount_detail AS d
SET
    amount_manual_review_required = v.amount_manual_review_required,
    amount_manual_review_category = v.amount_manual_review_category,
    amount_manual_review_category_ko = v.amount_manual_review_category_ko,
    amount_manual_review_reason = v.amount_manual_review_reason,
    amount_manual_review_status = v.amount_manual_review_status,
    amount_manual_review_note = v.amount_manual_review_note
FROM v
WHERE d.policy_id = v.policy_id;
""".strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Build keep-old review payload for policy amount rows.")
    parser.add_argument("--adjudication-csv", default=str(DEFAULT_ADJUDICATION_CSV))
    parser.add_argument("--gemini-csv", default=str(DEFAULT_GEMINI_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "keep_old_amount_review"))
    args = parser.parse_args()

    keep_old: dict[str, dict[str, Any]] = {}
    for row in read_csv(Path(args.adjudication_csv)):
        if clean(row.get("suggested_action")) == "keep_old":
            keep_old[clean(row.get("policy_id"))] = source_row_to_keep_old(row, "rule_adjudication")
    for row in read_csv(Path(args.gemini_csv)):
        if clean(row.get("final_suggested_action")) == "keep_old":
            keep_old[clean(row.get("policy_id"))] = source_row_to_keep_old(row, "gemini_second_review")

    rows = [keep_old[policy_id] for policy_id in sorted(keep_old)]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    csv_path = output_dir / f"keep_old_amount_review_{timestamp}.csv"
    sql_path = output_dir / f"keep_old_amount_review_update_{timestamp}.sql"
    summary_path = output_dir / f"keep_old_amount_review_summary_{timestamp}.md"

    write_csv(csv_path, rows)
    sql_path.parent.mkdir(parents=True, exist_ok=True)
    sql_path.write_text(build_update_sql(rows), encoding="utf-8")

    source_counts: dict[str, int] = {}
    for row in rows:
        source = clean(row.get("review_source"))
        source_counts[source] = source_counts.get(source, 0) + 1
    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"keep_old_rows={len(rows)}",
        "",
        "## source_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(source_counts.items()))
    lines.extend(
        [
            "",
            "## outputs",
            f"- csv: `{csv_path}`",
            f"- sql: `{sql_path}`",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"keep_old_rows={len(rows)}")
    for key, value in sorted(source_counts.items()):
        print(f"{key}: {value}")
    print(f"csv={csv_path}")
    print(f"sql={sql_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
