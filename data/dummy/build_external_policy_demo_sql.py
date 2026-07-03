from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[2]
TABLE_NAME = "external_policy_demo_20260624"
EXCLUDED_COLLECTION_FIELDS = {
    "max_employee_count",
    "min_revenue",
    "max_revenue",
    "required_documents_count",
    "relevance_score",
    "is_selected",
    "selected_reason",
}
CSV_PATHS = [
    ROOT_DIR / "data" / "processed" / "kosmes_preview.csv",
    ROOT_DIR / "data" / "processed" / "technopark_preview.csv",
]
OUTPUT_PATH = (
    ROOT_DIR
    / "database"
    / "migrations"
    / "20260624_create_external_policy_demo.sql"
)
ROLLBACK_PATH = (
    ROOT_DIR
    / "database"
    / "migrations"
    / "rollback"
    / "20260624_drop_external_policy_demo.sql"
)

JSON_COLUMNS = {
    "attachment_files",
    "eligible_company_types",
    "hashtags",
    "industry_codes",
    "required_documents_json",
    "source_api_json",
    "support_method",
}
BOOLEAN_COLUMNS = {
    "has_capex_keyword",
    "has_manufacturing_code",
    "is_early_close_possible",
}
INTEGER_COLUMNS = {
    "company_age_max",
    "company_age_min",
    "employee_max",
    "employee_min",
    "revenue_max_manwon",
    "revenue_min_manwon",
}
FLOAT_COLUMNS = {"max_amount_numeric_manwon"}


def parse_value(column: str, value: str) -> Any:
    text = (value or "").strip()
    if not text:
        return None
    if column in JSON_COLUMNS:
        return json.loads(text)
    if column in BOOLEAN_COLUMNS:
        return text.lower() == "true"
    if column in INTEGER_COLUMNS:
        return int(float(text))
    if column in FLOAT_COLUMNS:
        return float(text)
    return text


def load_rows() -> tuple[list[str], list[dict[str, Any]]]:
    columns: list[str] = []
    rows: list[dict[str, Any]] = []
    for csv_path in CSV_PATHS:
        with csv_path.open(encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            if reader.fieldnames and not columns:
                columns = [
                    column
                    for column in reader.fieldnames
                    if column not in EXCLUDED_COLLECTION_FIELDS
                ]
            for source_row in reader:
                row = {
                    column: parse_value(column, source_row.get(column, ""))
                    for column in columns
                }
                row["demo_source_file"] = csv_path.name
                rows.append(row)
    return columns, rows


def build_sql(columns: list[str], rows: list[dict[str, Any]]) -> str:
    insert_columns = [*columns, "demo_source_file"]
    quoted_columns = ",\n        ".join(
        f'"{column}"' for column in insert_columns
    )
    insert_column_sql = '"id",\n        ' + quoted_columns
    select_column_sql = "gen_random_uuid(),\n        " + quoted_columns
    payload = json.dumps(rows, ensure_ascii=False, indent=2)
    return f"""-- KOSMES + TechnoPark dry-run CSV demo table.
-- Generated from:
--   data/processed/kosmes_preview.csv
--   data/processed/technopark_preview.csv
-- This does not modify policy or policy_validation_new.

BEGIN;

DROP TABLE IF EXISTS public.{TABLE_NAME};

CREATE TABLE public.{TABLE_NAME}
(
    LIKE public.policy_validation_new
        INCLUDING DEFAULTS
        INCLUDING CONSTRAINTS
);

ALTER TABLE public.{TABLE_NAME}
    ADD COLUMN demo_source_file TEXT,
    ADD COLUMN demo_loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON TABLE public.{TABLE_NAME} IS
    'Temporary demo table for KOSMES and regional TechnoPark crawler previews';

WITH incoming AS (
    SELECT *
    FROM jsonb_populate_recordset(
        NULL::public.{TABLE_NAME},
        $external_demo_payload$
{payload}
$external_demo_payload$::jsonb
    )
)
INSERT INTO public.{TABLE_NAME} (
        {insert_column_sql}
)
SELECT
        {select_column_sql}
FROM incoming;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.{TABLE_NAME}
    TO service_role;

COMMIT;

SELECT
    source_name,
    demo_source_file,
    COUNT(*) AS row_count
FROM public.{TABLE_NAME}
GROUP BY source_name, demo_source_file
ORDER BY source_name;

SELECT
    policy_id,
    source_name,
    title,
    organization,
    deadline,
    service_category,
    max_amount_status,
    max_amount_numeric_manwon,
    demo_source_file
FROM public.{TABLE_NAME}
ORDER BY source_name, posted_at DESC NULLS LAST;
"""


def main() -> None:
    columns, rows = load_rows()
    if not rows:
        raise RuntimeError("No demo CSV rows found.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ROLLBACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(build_sql(columns, rows), encoding="utf-8")
    ROLLBACK_PATH.write_text(
        (
            "-- Remove only the external policy demo table.\n"
            f"DROP TABLE public.{TABLE_NAME};\n"
        ),
        encoding="utf-8",
    )
    print(f"Rows: {len(rows)}")
    print(f"Create SQL: {OUTPUT_PATH}")
    print(f"Rollback SQL: {ROLLBACK_PATH}")


if __name__ == "__main__":
    main()
