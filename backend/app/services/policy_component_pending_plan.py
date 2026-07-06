from __future__ import annotations

import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
from typing import Any


ALLOWED_REVIEW_DECISIONS = {
    "",
    "approve_for_pending_import",
    "hold_manual_review",
    "exclude_from_capex",
}
REQUIRED_INPUT_FIELDS = (
    "policy_id",
    "component_key",
    "component_name",
    "support_type",
    "effect_layer",
    "calculation_method",
)
AUDIT_FIELDS = (
    "validation_status",
    "validation_errors",
    "included_in_pending_plan",
    "planned_review_status",
    "planned_roi_apply_method",
    "planned_component_fingerprint",
)
FINGERPRINT_FIELDS = (
    "policy_id",
    "component_key",
    "component_version",
    "support_type",
    "effect_layer",
    "calculation_method",
    "cap_amount_manwon",
    "support_ratio",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_decision_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError("입력 CSV 헤더가 없습니다.")
        return list(reader.fieldnames), [dict(row) for row in reader]


def _decimal_text(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        number = Decimal(text)
    except InvalidOperation:
        return text
    normalized = format(number.normalize(), "f")
    return "0" if normalized in {"-0", ""} else normalized


def _number_or_none(value: Any) -> int | float | None:
    text = _decimal_text(value)
    if not text:
        return None
    try:
        number = Decimal(text)
    except InvalidOperation:
        return None
    if number == number.to_integral():
        return int(number)
    return float(number)


def _json_value(value: Any, default: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    text = str(value or "").strip()
    if not text:
        return default
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return default


def _boolean(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def component_fingerprint(row: dict[str, Any]) -> str:
    component_version = row.get("component_version") or 1
    normalized = {
        "policy_id": str(row.get("policy_id") or "").strip(),
        "component_key": str(row.get("component_key") or "").strip(),
        "component_version": _decimal_text(component_version),
        "support_type": str(row.get("support_type") or "").strip(),
        "effect_layer": str(row.get("effect_layer") or "").strip(),
        "calculation_method": str(row.get("calculation_method") or "").strip(),
        "cap_amount_manwon": _decimal_text(row.get("cap_amount_manwon")),
        "support_ratio": _decimal_text(row.get("support_ratio")),
    }
    encoded = json.dumps(
        normalized,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest().upper()


def validate_decision_row(row: dict[str, Any]) -> list[str]:
    errors = [
        f"missing_required_field:{field}"
        for field in REQUIRED_INPUT_FIELDS
        if not str(row.get(field) or "").strip()
    ]
    decision = str(row.get("review_decision") or "").strip()
    if decision not in ALLOWED_REVIEW_DECISIONS:
        errors.append(f"invalid_review_decision:{decision}")
    return errors


def build_planned_row(row: dict[str, Any]) -> dict[str, Any]:
    source_json = _json_value(row.get("source_component_json"), {})
    if not isinstance(source_json, dict):
        source_json = {}
    reviewer_note = str(row.get("reviewer_note") or "").strip() or None
    return {
        "policy_id": str(row.get("policy_id") or "").strip(),
        "component_key": str(row.get("component_key") or "").strip(),
        "component_name": str(row.get("component_name") or "").strip(),
        "support_type": str(row.get("support_type") or "").strip(),
        "effect_layer": str(row.get("effect_layer") or "").strip(),
        "calculation_method": str(row.get("calculation_method") or "").strip(),
        "roi_apply_method": "none",
        "fixed_amount_manwon": _number_or_none(row.get("fixed_amount_manwon")),
        "cap_amount_manwon": _number_or_none(row.get("cap_amount_manwon")),
        "support_ratio": _number_or_none(row.get("support_ratio")),
        "eligible_cost_ratio": _number_or_none(row.get("eligible_cost_ratio")),
        "term_months": None,
        "interest_rate": None,
        "interest_subsidy_rate": None,
        "repayment_method": None,
        "eligible_expense_types": [],
        "condition_json": {
            "import_mode": "reviewed_pending_preview",
            "candidate_proposed_roi_apply_method": str(
                row.get("proposed_roi_apply_method") or "none"
            ).strip(),
            "human_review_decision": "approve_for_pending_import",
            "recommended_action": str(
                row.get("recommended_action") or ""
            ).strip(),
            "risk_level": str(row.get("risk_level") or "").strip(),
            "requires_original_notice_check": _boolean(
                row.get("requires_original_notice_check")
            ),
            "reviewer_note": reviewer_note,
        },
        "stacking_rule": "unknown",
        "stack_group": None,
        "evidence_text": str(row.get("evidence_text") or "").strip() or None,
        "evidence_source_type": str(
            row.get("evidence_source_type") or ""
        ).strip()
        or None,
        "evidence_source_name": str(
            row.get("evidence_source_name") or ""
        ).strip()
        or None,
        "evidence_page_or_section": str(
            row.get("evidence_page_or_section") or ""
        ).strip()
        or None,
        "extraction_confidence": "manual",
        "review_status": "pending",
        "source_component_json": source_json,
        "component_version": 1,
        "valid_from": None,
        "valid_to": None,
    }


def build_pending_plan(
    rows: list[dict[str, Any]],
    *,
    input_file: str,
    input_sha256: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    planned_rows: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []
    decision_counts = {
        "approve_for_pending_import": 0,
        "hold_manual_review": 0,
        "exclude_from_capex": 0,
        "blank": 0,
        "invalid": 0,
    }

    for source_row in rows:
        row = dict(source_row)
        decision = str(row.get("review_decision") or "").strip()
        errors = validate_decision_row(row)
        if decision in ALLOWED_REVIEW_DECISIONS:
            decision_counts[decision or "blank"] += 1
        else:
            decision_counts["invalid"] += 1

        included = decision == "approve_for_pending_import" and not errors
        fingerprint = component_fingerprint(row) if included else ""
        if included:
            planned = build_planned_row(row)
            planned["component_fingerprint"] = fingerprint
            planned_rows.append(planned)

        audit = dict(row)
        audit.update(
            {
                "validation_status": "valid" if not errors else "invalid",
                "validation_errors": json.dumps(errors, ensure_ascii=False),
                "included_in_pending_plan": "true" if included else "false",
                "planned_review_status": "pending" if included else "",
                "planned_roi_apply_method": "none" if included else "",
                "planned_component_fingerprint": fingerprint,
            }
        )
        audit_rows.append(audit)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "local_pending_import_plan_only",
        "database_write_performed": False,
        "input_file": input_file,
        "input_sha256": input_sha256,
        "total_candidates": len(rows),
        "approved_for_pending_count": decision_counts[
            "approve_for_pending_import"
        ],
        "hold_count": decision_counts["hold_manual_review"],
        "excluded_count": decision_counts["exclude_from_capex"],
        "blank_decision_count": decision_counts["blank"],
        "invalid_decision_count": decision_counts["invalid"],
        "planned_insert_count": len(planned_rows),
        "planned_rows": planned_rows,
    }
    return payload, audit_rows


def write_plan_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def write_audit_csv(
    path: Path,
    input_fields: list[str],
    audit_rows: list[dict[str, Any]],
) -> None:
    fields = [*input_fields, *AUDIT_FIELDS]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows({field: row.get(field, "") for field in fields} for row in audit_rows)
