from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_TIER_A_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_DELTA_PAYLOAD = (
    REPORT_DIR / "large_amount_delta_final" / "large_amount_delta_final_payload_20260703_122144.json"
)
DEFAULT_DELTA_AUDIT = (
    REPORT_DIR / "large_amount_delta_final" / "large_amount_delta_final_audit_20260703_122144.csv"
)
TIER_A_TYPES = {"support_amount", "subsidy", "voucher"}
REQUIRED_PAYLOAD_FIELDS = [
    "policy_id",
    "amount_candidates",
    "selected_amount_candidate",
    "max_amount_actual",
    "max_amount_status",
    "max_amount_type",
    "max_amount_numeric_manwon",
    "max_amount_evidence",
    "roi_apply_method",
]


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


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


def read_csv(path: Path) -> list[dict[str, str]]:
    content = path.read_text(encoding="utf-8-sig").replace("\x00", "")
    return list(csv.DictReader(content.splitlines()))


def is_tier_a(row: dict[str, Any]) -> bool:
    return (
        row.get("decision") == "safe"
        and not row.get("comparison_reasons")
        and row.get("new_roi_apply_method") == "subtract"
        and row.get("new_selected_type") in TIER_A_TYPES
        and isinstance(row.get("new_selected_candidate"), dict)
    )


def payload_from_derived(policy_id: str, derived: dict[str, Any]) -> dict[str, Any]:
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
    payload = {"policy_id": policy_id}
    for field in fields:
        if field in derived:
            payload[field] = derived[field]
    return payload


def audit_row(row: dict[str, Any], payload: dict[str, Any], source: str, reason: str = "") -> dict[str, Any]:
    selected = payload.get("selected_amount_candidate") or {}
    return {
        "policy_id": payload.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "source": source,
        "reason": reason,
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_actual": row.get("old_actual"),
        "old_amount_type": row.get("old_amount_type"),
        "old_roi_apply_method": row.get("old_roi_apply_method"),
        "new_amount_manwon": payload.get("max_amount_numeric_manwon"),
        "new_amount_actual": payload.get("max_amount_actual"),
        "new_amount_type": payload.get("max_amount_type"),
        "new_roi_apply_method": payload.get("roi_apply_method"),
        "candidate_count": row.get("candidate_count"),
        "selected_context": clean(
            selected.get("local_context") or selected.get("evidence") or selected.get("raw_text"),
            900,
        ),
    }


def payload_signature(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build integrated dry-run payload for resolved policy amount updates. No DB updates."
    )
    parser.add_argument("--tier-a-json", default=str(DEFAULT_TIER_A_JSON))
    parser.add_argument("--delta-payload", default=str(DEFAULT_DELTA_PAYLOAD))
    parser.add_argument("--delta-audit", default=str(DEFAULT_DELTA_AUDIT))
    parser.add_argument(
        "--extra-payload",
        action="append",
        default=[],
        help="Additional payload JSON to merge after tier-a and large_amount_delta payloads.",
    )
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "integrated_update"))
    args = parser.parse_args()

    tier_rows = json.loads(Path(args.tier_a_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in tier_rows}
    tier_a_rows = [row for row in tier_rows if is_tier_a(row)]
    delta_payloads = json.loads(Path(args.delta_payload).read_text(encoding="utf-8"))
    delta_audits = read_csv(Path(args.delta_audit))
    delta_reason_by_id = {
        clean(row.get("policy_id")): clean(row.get("resolution_reason"), 700)
        for row in delta_audits
    }

    integrated: dict[str, dict[str, Any]] = {}
    audit_rows: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []

    for row in tier_a_rows:
        policy_id = clean(row.get("policy_id"))
        payload = payload_from_derived(policy_id, row.get("derived_fields") or {})
        integrated[policy_id] = payload
        audit_rows.append(audit_row(row, payload, "tier_a_safe"))

    for payload in delta_payloads:
        policy_id = clean(payload.get("policy_id"))
        row = rows_by_id.get(policy_id, {"policy_id": policy_id})
        if policy_id in integrated:
            conflict = {
                "policy_id": policy_id,
                "tier_payload": integrated[policy_id],
                "delta_payload": payload,
                "same_payload": payload_signature(integrated[policy_id]) == payload_signature(payload),
            }
            conflicts.append(conflict)
            if not conflict["same_payload"]:
                integrated[policy_id] = payload
        else:
            integrated[policy_id] = payload
        audit_rows.append(
            audit_row(
                row,
                payload,
                "large_amount_delta_adopt_new",
                delta_reason_by_id.get(policy_id, ""),
            )
        )

    for extra_path_text in args.extra_payload:
        extra_path = Path(extra_path_text)
        extra_payloads = json.loads(extra_path.read_text(encoding="utf-8"))
        for payload in extra_payloads:
            policy_id = clean(payload.get("policy_id"))
            row = rows_by_id.get(policy_id, {"policy_id": policy_id})
            if policy_id in integrated:
                conflict = {
                    "policy_id": policy_id,
                    "tier_payload": integrated[policy_id],
                    "delta_payload": payload,
                    "same_payload": payload_signature(integrated[policy_id]) == payload_signature(payload),
                    "source": str(extra_path),
                }
                conflicts.append(conflict)
                if not conflict["same_payload"]:
                    integrated[policy_id] = payload
            else:
                integrated[policy_id] = payload
            audit_rows.append(
                audit_row(
                    row,
                    payload,
                    f"extra_payload:{extra_path.name}",
                    "selected_candidate_missing Gemini/규칙 재판정 채택",
                )
            )

    final_payloads = [integrated[policy_id] for policy_id in sorted(integrated)]
    validation_rows: list[dict[str, Any]] = []
    for payload in final_payloads:
        missing = [
            field for field in REQUIRED_PAYLOAD_FIELDS
            if payload.get(field) in (None, "", [])
        ]
        selected = payload.get("selected_amount_candidate")
        validation_rows.append(
            {
                "policy_id": payload.get("policy_id"),
                "missing_fields": " | ".join(missing),
                "max_amount_numeric_manwon": payload.get("max_amount_numeric_manwon"),
                "max_amount_type": payload.get("max_amount_type"),
                "roi_apply_method": payload.get("roi_apply_method"),
                "has_selected_candidate": isinstance(selected, dict),
                "is_valid": not missing and isinstance(selected, dict),
            }
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    payload_path = output_dir / f"policy_amount_integrated_payload_{timestamp}.json"
    audit_csv_path = output_dir / f"policy_amount_integrated_audit_{timestamp}.csv"
    validation_csv_path = output_dir / f"policy_amount_integrated_validation_{timestamp}.csv"
    conflicts_path = output_dir / f"policy_amount_integrated_conflicts_{timestamp}.json"
    summary_path = output_dir / f"policy_amount_integrated_summary_{timestamp}.md"

    write_json(payload_path, final_payloads)
    write_csv(audit_csv_path, audit_rows)
    write_csv(validation_csv_path, validation_rows)
    write_json(conflicts_path, conflicts)

    invalid_rows = [row for row in validation_rows if not row["is_valid"]]
    source_counts: dict[str, int] = {}
    for row in audit_rows:
        source = clean(row.get("source"))
        source_counts[source] = source_counts.get(source, 0) + 1
    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"tier_a_rows={len(tier_a_rows)}",
        f"large_amount_delta_rows={len(delta_payloads)}",
        f"extra_payload_files={len(args.extra_payload)}",
        f"integrated_unique_rows={len(final_payloads)}",
        f"conflicts={len(conflicts)}",
        f"invalid_rows={len(invalid_rows)}",
        "",
        "## source_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(source_counts.items()))
    lines.extend(["", "## output"])
    lines.extend(
        [
            f"- payload: {payload_path}",
            f"- audit_csv: {audit_csv_path}",
            f"- validation_csv: {validation_csv_path}",
            f"- conflicts_json: {conflicts_path}",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print("DRY-RUN only. No database rows were updated.")
    print(f"tier_a_rows={len(tier_a_rows)}")
    print(f"large_amount_delta_rows={len(delta_payloads)}")
    print(f"extra_payload_files={len(args.extra_payload)}")
    print(f"integrated_unique_rows={len(final_payloads)}")
    print(f"conflicts={len(conflicts)}")
    print(f"invalid_rows={len(invalid_rows)}")
    print(f"payload={payload_path}")
    print(f"audit_csv={audit_csv_path}")
    print(f"validation_csv={validation_csv_path}")
    print(f"conflicts_json={conflicts_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
