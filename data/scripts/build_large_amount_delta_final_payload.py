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
    REPORT_DIR / "large_amount_delta_adjudication" / "large_amount_delta_adjudication.csv"
)
DEFAULT_GEMINI_CSV = (
    REPORT_DIR
    / "large_amount_delta_gemini_review"
    / "large_amount_delta_gemini_review_20260703_121908.csv"
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


def payload_from_row(row: dict[str, Any]) -> dict[str, Any]:
    derived = row.get("derived_fields") or {}
    payload = {"policy_id": row.get("policy_id")}
    for field in PAYLOAD_FIELDS:
        if field in derived:
            payload[field] = derived[field]
    return payload


def selected_context(row: dict[str, Any]) -> str:
    selected = row.get("new_selected_candidate") or {}
    return clean(
        selected.get("local_context")
        or selected.get("evidence")
        or selected.get("raw_text"),
        900,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build final dry-run payload for resolved large_amount_delta rows. No DB updates."
    )
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--adjudication-csv", default=str(DEFAULT_ADJUDICATION_CSV))
    parser.add_argument("--gemini-csv", default=str(DEFAULT_GEMINI_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "large_amount_delta_final"))
    args = parser.parse_args()

    reparse_rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in reparse_rows}
    adjudication_rows = read_csv(Path(args.adjudication_csv))
    gemini_rows = read_csv(Path(args.gemini_csv))

    resolved: dict[str, dict[str, Any]] = {}
    keep_old_ids: set[str] = set()
    hold_ids: set[str] = set()

    for row in adjudication_rows:
        policy_id = clean(row.get("policy_id"))
        action = clean(row.get("suggested_action"))
        if action == "adopt_new":
            resolved[policy_id] = {
                "resolution_source": "rule_adjudication",
                "resolution_reason": clean(row.get("suggested_reason"), 700),
            }
        elif action == "keep_old":
            keep_old_ids.add(policy_id)
        else:
            hold_ids.add(policy_id)

    for row in gemini_rows:
        policy_id = clean(row.get("policy_id"))
        action = clean(row.get("final_suggested_action"))
        if action == "adopt_new":
            resolved[policy_id] = {
                "resolution_source": "gemini_second_review",
                "resolution_reason": clean(row.get("gemini_reason"), 700),
                "gemini_confidence": clean(row.get("gemini_confidence")),
            }
            hold_ids.discard(policy_id)
        elif action == "keep_old":
            keep_old_ids.add(policy_id)
            hold_ids.discard(policy_id)

    payloads: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []
    for policy_id, resolution in sorted(resolved.items()):
        row = rows_by_id.get(policy_id)
        if not row:
            continue
        payload = payload_from_row(row)
        payloads.append(payload)
        audit_rows.append(
            {
                "policy_id": policy_id,
                "title": row.get("title"),
                "organization": row.get("organization"),
                "old_amount_manwon": row.get("old_amount_manwon"),
                "old_amount_actual": row.get("old_actual"),
                "old_amount_type": row.get("old_amount_type"),
                "old_roi_apply_method": row.get("old_roi_apply_method"),
                "new_amount_manwon": payload.get("max_amount_numeric_manwon"),
                "new_amount_actual": payload.get("max_amount_actual"),
                "new_amount_type": payload.get("max_amount_type"),
                "new_roi_apply_method": payload.get("roi_apply_method"),
                "resolution_source": resolution.get("resolution_source"),
                "resolution_reason": resolution.get("resolution_reason"),
                "gemini_confidence": resolution.get("gemini_confidence", ""),
                "selected_context": selected_context(row),
            }
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    payload_path = output_dir / f"large_amount_delta_final_payload_{timestamp}.json"
    audit_json_path = output_dir / f"large_amount_delta_final_audit_{timestamp}.json"
    audit_csv_path = output_dir / f"large_amount_delta_final_audit_{timestamp}.csv"
    summary_path = output_dir / f"large_amount_delta_final_summary_{timestamp}.md"
    write_json(payload_path, payloads)
    write_json(audit_json_path, audit_rows)
    write_csv(audit_csv_path, audit_rows)

    total_rows = len(adjudication_rows)
    keep_old_count = len(keep_old_ids)
    hold_count = total_rows - len(resolved) - keep_old_count
    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"source_rows={total_rows}",
        f"adopt_new_total={len(resolved)}",
        f"keep_old_total={keep_old_count}",
        f"hold_total={hold_count}",
        "",
        "## adopt_new_by_source",
    ]
    source_counts: dict[str, int] = {}
    for row in audit_rows:
        source = row["resolution_source"]
        source_counts[source] = source_counts.get(source, 0) + 1
    lines.extend(f"- {key}: {value}" for key, value in sorted(source_counts.items()))
    lines.extend(["", "## samples"])
    for row in audit_rows[:20]:
        lines.extend(
            [
                "",
                f"### {row['policy_id']} | {row['title']}",
                f"- old -> new: {row['old_amount_manwon']} -> {row['new_amount_manwon']}",
                f"- source: {row['resolution_source']} {row.get('gemini_confidence') or ''}",
                f"- reason: {row['resolution_reason']}",
                f"- context: {row['selected_context'][:280]}",
            ]
        )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print("DRY-RUN only. No database rows were updated.")
    print(f"source_rows={total_rows}")
    print(f"adopt_new_total={len(resolved)}")
    print(f"keep_old_total={keep_old_count}")
    print(f"hold_total={hold_count}")
    print(f"payload={payload_path}")
    print(f"audit_json={audit_json_path}")
    print(f"audit_csv={audit_csv_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
