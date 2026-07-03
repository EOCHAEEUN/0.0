from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
DEFAULT_REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_url_reparse"

TIER_A_TYPES = {"support_amount", "subsidy", "voucher"}


def latest_reparse_report(report_dir: Path) -> Path:
    candidates = sorted(
        report_dir.glob("policy_amount_url_reparse_*.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        raise FileNotFoundError(f"No reparse JSON report found in {report_dir}")
    return candidates[0]


def is_tier_a(row: dict[str, Any]) -> bool:
    return (
        row.get("decision") == "safe"
        and not row.get("comparison_reasons")
        and row.get("new_roi_apply_method") == "subtract"
        and row.get("new_selected_type") in TIER_A_TYPES
        and isinstance(row.get("new_selected_candidate"), dict)
    )


def payload_from_row(row: dict[str, Any]) -> dict[str, Any]:
    derived = row.get("derived_fields") or {}
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
    payload = {"policy_id": row.get("policy_id")}
    for field in fields:
        if field in derived:
            payload[field] = derived.get(field)
    return payload


def audit_from_row(row: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_type": row.get("old_amount_type"),
        "old_roi_apply_method": row.get("old_roi_apply_method"),
        "new_amount_manwon": payload.get("max_amount_numeric_manwon"),
        "new_amount_actual": payload.get("max_amount_actual"),
        "new_amount_type": payload.get("max_amount_type"),
        "new_roi_apply_method": payload.get("roi_apply_method"),
        "candidate_count": row.get("candidate_count"),
        "selected_evidence": (
            (payload.get("selected_amount_candidate") or {}).get("local_context")
            or (payload.get("selected_amount_candidate") or {}).get("evidence")
            or ""
        ),
    }


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "policy_id",
        "title",
        "organization",
        "old_amount_manwon",
        "old_amount_type",
        "old_roi_apply_method",
        "new_amount_manwon",
        "new_amount_actual",
        "new_amount_type",
        "new_roi_apply_method",
        "candidate_count",
        "selected_evidence",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field) for field in fields})


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a dry-run update payload for tier-a policy amount rows. "
            "No database rows are updated."
        )
    )
    parser.add_argument("--input-json", default="")
    parser.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_REPORT_DIR))
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    report_dir = Path(args.report_dir)
    input_path = Path(args.input_json) if args.input_json else latest_reparse_report(report_dir)
    rows = json.loads(input_path.read_text(encoding="utf-8"))
    tier_rows = [row for row in rows if is_tier_a(row)]
    payloads = [payload_from_row(row) for row in tier_rows]
    audit_rows = [
        audit_from_row(row, payload)
        for row, payload in zip(tier_rows, payloads)
    ]

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    payload_path = output_dir / f"policy_amount_tier_a_payload_{timestamp}.json"
    audit_json_path = output_dir / f"policy_amount_tier_a_audit_{timestamp}.json"
    audit_csv_path = output_dir / f"policy_amount_tier_a_audit_{timestamp}.csv"
    write_json(payload_path, payloads)
    write_json(audit_json_path, audit_rows)
    write_csv(audit_csv_path, audit_rows)

    print("DRY-RUN only. No database rows were updated.")
    print(f"input={input_path}")
    print(f"source_rows={len(rows)}")
    print(f"tier_a_rows={len(tier_rows)}")
    print(f"payload={payload_path}")
    print(f"audit_json={audit_json_path}")
    print(f"audit_csv={audit_csv_path}")


if __name__ == "__main__":
    main()
