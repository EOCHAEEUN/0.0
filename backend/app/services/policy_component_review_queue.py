from __future__ import annotations

import csv
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from app.services.policy_component_candidate import PolicyComponentCandidate


REVIEW_QUEUE_FIELDS = [
    "policy_id",
    "policy_title",
    "component_key",
    "component_name",
    "source_kind",
    "source_index",
    "support_type",
    "effect_layer",
    "calculation_method",
    "proposed_roi_apply_method",
    "fixed_amount_manwon",
    "cap_amount_manwon",
    "support_ratio",
    "eligible_cost_ratio",
    "evidence_text",
    "evidence_source_type",
    "evidence_source_name",
    "evidence_page_or_section",
    "quality_flags",
    "review_reasons",
    "source_component_json",
    "review_decision",
    "reviewer_note",
    "reviewed_at",
]


def _sort_key(candidate: PolicyComponentCandidate) -> tuple[Any, ...]:
    method_priority = {
        "ratio_cap": 0,
        "subtract": 1,
    }.get(candidate.proposed_roi_apply_method, 2)
    has_evidence = bool(candidate.evidence_text)
    has_amount = (
        candidate.cap_amount_manwon is not None
        or candidate.fixed_amount_manwon is not None
    )
    has_ratio = candidate.support_ratio is not None
    return (
        method_priority,
        -int(has_evidence),
        -int(has_amount),
        -int(has_ratio),
        candidate.policy_id,
        candidate.component_key,
    )


def build_capex_review_queue(
    candidates: list[PolicyComponentCandidate],
) -> list[dict[str, Any]]:
    capex_candidates = sorted(
        (
            candidate
            for candidate in candidates
            if candidate.effect_layer == "capex_offset"
        ),
        key=_sort_key,
    )
    rows: list[dict[str, Any]] = []
    for candidate in capex_candidates:
        source = candidate.to_dict()
        row = {field: source.get(field) for field in REVIEW_QUEUE_FIELDS}
        row["review_decision"] = None
        row["reviewer_note"] = None
        row["reviewed_at"] = None
        rows.append(row)
    return rows


def build_review_queue_payload(
    policies: list[dict[str, Any]],
    candidates: list[PolicyComponentCandidate],
) -> dict[str, Any]:
    queue = build_capex_review_queue(candidates)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "dry_run_review_queue",
        "source": "public.policy",
        "policy_count": len(policies),
        "candidate_count": len(queue),
        "auto_approved_count": 0,
        "candidates": queue,
    }


def build_review_queue_summary(
    queue: list[dict[str, Any]],
    *,
    csv_path: Path | None = None,
    json_path: Path | None = None,
) -> dict[str, Any]:
    return {
        "capex_candidate_count": len(queue),
        "ratio_cap_proposal_count": sum(
            row["proposed_roi_apply_method"] == "ratio_cap" for row in queue
        ),
        "subtract_proposal_count": sum(
            row["proposed_roi_apply_method"] == "subtract" for row in queue
        ),
        "amount_grounded_candidate_count": sum(
            row["cap_amount_manwon"] is not None
            or row["fixed_amount_manwon"] is not None
            for row in queue
        ),
        "support_ratio_candidate_count": sum(
            row["support_ratio"] is not None for row in queue
        ),
        "evidence_candidate_count": sum(
            bool(row["evidence_text"]) for row in queue
        ),
        "quality_flagged_candidate_count": sum(
            bool(row["quality_flags"]) for row in queue
        ),
        "review_queue_csv": str(csv_path) if csv_path else None,
        "review_queue_json": str(json_path) if json_path else None,
        "auto_approved_count": 0,
    }


def write_review_queue_csv(
    path: Path,
    queue: list[dict[str, Any]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_QUEUE_FIELDS)
        writer.writeheader()
        for item in queue:
            row = dict(item)
            for key in ("quality_flags", "review_reasons", "source_component_json"):
                row[key] = json.dumps(row[key], ensure_ascii=False)
            for key in ("review_decision", "reviewer_note", "reviewed_at"):
                row[key] = ""
            writer.writerow(row)


def write_review_queue_json(
    path: Path,
    payload: dict[str, Any],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
