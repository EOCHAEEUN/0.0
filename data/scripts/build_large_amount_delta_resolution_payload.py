from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_20260703_120128.json"
DEFAULT_ADJUDICATION_CSV = (
    REPORT_DIR
    / "large_amount_delta_adjudication"
    / "large_amount_delta_adjudication.csv"
)


PAYLOAD_FIELDS = [
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


def payload_from_row(row: dict[str, Any]) -> dict[str, Any]:
    derived = row.get("derived_fields") or {}
    payload = {"policy_id": row.get("policy_id")}
    for field in PAYLOAD_FIELDS:
        if field in derived:
            payload[field] = derived[field]
    return payload


def audit_from_row(row: dict[str, Any], adjudication: dict[str, str]) -> dict[str, Any]:
    selected = row.get("new_selected_candidate") or {}
    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_actual": row.get("old_actual"),
        "old_amount_type": row.get("old_amount_type"),
        "old_roi_apply_method": row.get("old_roi_apply_method"),
        "new_amount_manwon": row.get("new_selected_amount_manwon"),
        "new_amount_actual": (row.get("derived_fields") or {}).get("max_amount_actual"),
        "new_amount_type": row.get("new_selected_type"),
        "new_roi_apply_method": row.get("new_roi_apply_method"),
        "delta_ratio": adjudication.get("delta_ratio"),
        "pattern": adjudication.get("pattern"),
        "suggested_action": adjudication.get("suggested_action"),
        "suggested_reason": adjudication.get("suggested_reason"),
        "selected_context": clean(
            selected.get("local_context")
            or selected.get("evidence")
            or selected.get("raw_text"),
            900,
        ),
    }


def hold_group(row: dict[str, str]) -> str:
    reason = clean(row.get("suggested_reason"))
    pattern = clean(row.get("pattern"))
    new_type = clean(row.get("new_amount_type"))
    if "월별/인원별/건별" in reason:
        return "unit_basis_ambiguous"
    if "금융성" in reason:
        return "finance_context"
    if "현금성 직접 차감" in reason:
        return f"non_cash_or_non_subtract:{new_type or 'unknown'}"
    if "100배" in reason:
        return "extreme_delta"
    if pattern == "possible_unit_scale_error":
        return "possible_unit_scale_error"
    if pattern == "needs_manual_review":
        return "manual_review_pattern"
    if "최종 수동 확인" in reason:
        return "limit_candidate_large_delta"
    return "hold_other"


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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build dry-run payload for adjudicated large_amount_delta rows."
    )
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--adjudication-csv", default=str(DEFAULT_ADJUDICATION_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "large_amount_delta_resolution"))
    args = parser.parse_args()

    reparse_path = Path(args.reparse_json)
    adjudication_path = Path(args.adjudication_csv)
    reparse_rows = json.loads(reparse_path.read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in reparse_rows}
    adjudication_rows = read_csv(adjudication_path)

    adopt_rows = [
        row for row in adjudication_rows
        if clean(row.get("suggested_action")) == "adopt_new"
    ]
    keep_old_rows = [
        row for row in adjudication_rows
        if clean(row.get("suggested_action")) == "keep_old"
    ]
    hold_rows = [
        dict(row, hold_group=hold_group(row))
        for row in adjudication_rows
        if clean(row.get("suggested_action")) == "hold"
    ]

    payloads: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []
    for adjudication in adopt_rows:
        row = rows_by_id.get(clean(adjudication.get("policy_id")))
        if not row:
            continue
        payloads.append(payload_from_row(row))
        audit_rows.append(audit_from_row(row, adjudication))

    hold_counts: dict[str, int] = {}
    for row in hold_rows:
        group = row["hold_group"]
        hold_counts[group] = hold_counts.get(group, 0) + 1

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    payload_path = output_dir / f"large_amount_delta_adopt_new_payload_{timestamp}.json"
    audit_json_path = output_dir / f"large_amount_delta_adopt_new_audit_{timestamp}.json"
    audit_csv_path = output_dir / f"large_amount_delta_adopt_new_audit_{timestamp}.csv"
    keep_old_csv_path = output_dir / f"large_amount_delta_keep_old_{timestamp}.csv"
    hold_csv_path = output_dir / f"large_amount_delta_hold_breakdown_{timestamp}.csv"
    hold_md_path = output_dir / f"large_amount_delta_hold_breakdown_{timestamp}.md"

    write_json(payload_path, payloads)
    write_json(audit_json_path, audit_rows)
    write_csv(audit_csv_path, audit_rows)
    write_csv(keep_old_csv_path, keep_old_rows)
    write_csv(hold_csv_path, hold_rows)

    lines = [
        f"reparse_json={reparse_path}",
        f"adjudication_csv={adjudication_path}",
        f"adopt_new={len(adopt_rows)}",
        f"keep_old={len(keep_old_rows)}",
        f"hold={len(hold_rows)}",
        "",
        "## hold_group",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(hold_counts.items()))
    for group in sorted(hold_counts):
        lines.extend(["", f"### {group}"])
        for row in [item for item in hold_rows if item["hold_group"] == group][:8]:
            lines.extend(
                [
                    (
                        f"- {row.get('policy_id')} | old={row.get('old_amount_manwon')} "
                        f"-> new={row.get('new_amount_manwon')} ({row.get('delta_ratio')}) | "
                        f"{row.get('title')}"
                    ),
                    f"  - reason: {row.get('suggested_reason')}",
                    f"  - context: {clean(row.get('new_selected_context'), 260)}",
                ]
            )
    hold_md_path.write_text("\n".join(lines), encoding="utf-8")

    print("DRY-RUN only. No database rows were updated.")
    print(f"adopt_new={len(adopt_rows)}")
    print(f"payload_rows={len(payloads)}")
    print(f"keep_old={len(keep_old_rows)}")
    print(f"hold={len(hold_rows)}")
    print(f"hold_groups={hold_counts}")
    print(f"payload={payload_path}")
    print(f"audit_json={audit_json_path}")
    print(f"audit_csv={audit_csv_path}")
    print(f"keep_old_csv={keep_old_csv_path}")
    print(f"hold_csv={hold_csv_path}")
    print(f"hold_md={hold_md_path}")


if __name__ == "__main__":
    main()
