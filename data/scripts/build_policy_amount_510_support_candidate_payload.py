from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_AMOUNT_PAYLOAD = (
    REPORT_DIR / "integrated_update" / "policy_amount_integrated_payload_20260703_131721.json"
)
DEFAULT_SUPPORT_RATIO_PAYLOAD = (
    REPORT_DIR / "remaining_fixups" / "support_ratio_only_payload_20260703_131716.json"
)

SUPPORT_CANDIDATE_TYPES = {
    "subsidy",
    "support_amount",
    "support_ratio",
    "voucher",
    "non_cash",
    "loan",
    "guarantee",
    "interest_support",
    "consulting_fee",
    "equipment_usage_fee",
    "education_fee",
    "fee",
    "total_support_scale",
}
EXCLUDED_CANDIDATE_TYPES = {
    "unknown",
    "self_funding",
    "revenue_condition",
    "total_budget",
    "project_budget",
    "total_project_cost",
}


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


def payload_map(path: Path) -> dict[str, dict[str, Any]]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {clean(row.get("policy_id")): row for row in rows}


def candidate_type(candidate: dict[str, Any]) -> str:
    return clean(candidate.get("max_amount_type")) or "unknown"


def is_support_candidate(candidate: dict[str, Any]) -> bool:
    amount_type = candidate_type(candidate)
    if amount_type in EXCLUDED_CANDIDATE_TYPES:
        return False
    if amount_type in SUPPORT_CANDIDATE_TYPES:
        return True
    if candidate.get("support_ratio") is not None:
        return True
    return False


def filter_support_candidates(candidates: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    kept: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    for candidate in candidates:
        row = dict(candidate)
        amount_type = candidate_type(row)
        if is_support_candidate(row):
            row["candidate_storage_scope"] = "support_candidate"
            if amount_type in {"total_support_scale", "fee"}:
                row["candidate_review_note"] = "지원 관련 후보이나 대표금액 자동 선택 대상은 아닙니다."
            kept.append(row)
        else:
            excluded.append(row)
    return kept, excluded


def selected_from_payload(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not payload:
        return None
    selected = payload.get("selected_amount_candidate")
    return selected if isinstance(selected, dict) else None


def base_payload(policy_id: str, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "policy_id": policy_id,
        "amount_candidates": candidates,
        "selected_amount_candidate": None,
        "support_ratio": next(
            (candidate.get("support_ratio") for candidate in candidates if candidate.get("support_ratio") is not None),
            None,
        ),
        "max_amount_actual": None,
        "max_amount_status": "후보 검수 필요" if candidates else "후보 없음",
        "max_amount_type": "unknown",
        "max_amount_type_ko": "금액 성격 미확인",
        "max_amount_type_reason": "지원 후보 JSON은 저장하지만 대표금액은 자동 확정하지 않음",
        "max_amount_numeric_manwon": None,
        "max_amount_evidence": None,
        "max_amount_note": "대표 지원금 후보 수기검수 필요" if candidates else "지원 후보 없음",
        "roi_apply_method": "review",
        "roi_apply_method_ko": "검토 필요",
        "roi_apply_reason": "대표금액 자동 확정 전 검토 필요",
    }


def apply_authoritative_fields(
    payload: dict[str, Any],
    authoritative: dict[str, Any],
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    fields = [
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
    updated = dict(payload)
    updated["amount_candidates"] = candidates
    for field in fields:
        if field in authoritative:
            updated[field] = authoritative[field]
    return updated


def audit_summary(candidates: list[dict[str, Any]], limit: int = 6) -> str:
    parts: list[str] = []
    for candidate in candidates[:limit]:
        parts.append(
            (
                f"{candidate.get('amount_manwon')}만원/"
                f"{clean(candidate.get('max_amount_type'))}/"
                f"{clean(candidate.get('roi_apply_method'))}: "
                f"{clean(candidate.get('local_context') or candidate.get('evidence') or candidate.get('raw_text'), 180)}"
            )
        )
    if len(candidates) > limit:
        parts.append(f"... 후보 {len(candidates) - limit}개 추가")
    return " || ".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build 510-row support-candidate JSON payload. No DB updates."
    )
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--amount-payload", default=str(DEFAULT_AMOUNT_PAYLOAD))
    parser.add_argument("--support-ratio-payload", default=str(DEFAULT_SUPPORT_RATIO_PAYLOAD))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "support_candidate_payload_510"))
    args = parser.parse_args()

    reparse_rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    amount_payloads = payload_map(Path(args.amount_payload))
    support_ratio_payloads = payload_map(Path(args.support_ratio_payload))

    payloads: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    excluded_type_counts: dict[str, int] = {}
    kept_type_counts: dict[str, int] = {}

    for row in reparse_rows:
        policy_id = clean(row.get("policy_id"))
        raw_candidates = row.get("new_amount_candidates") or []
        support_candidates, excluded_candidates = filter_support_candidates(raw_candidates)
        for candidate in support_candidates:
            kept_type_counts[candidate_type(candidate)] = kept_type_counts.get(candidate_type(candidate), 0) + 1
        for candidate in excluded_candidates:
            excluded_type_counts[candidate_type(candidate)] = excluded_type_counts.get(candidate_type(candidate), 0) + 1

        payload = base_payload(policy_id, support_candidates)
        source = "json_only_review"
        if policy_id in amount_payloads:
            payload = apply_authoritative_fields(payload, amount_payloads[policy_id], support_candidates)
            selected = selected_from_payload(amount_payloads[policy_id])
            if selected and not any(
                candidate.get("amount_manwon") == selected.get("amount_manwon")
                and clean(candidate.get("max_amount_type")) == clean(selected.get("max_amount_type"))
                for candidate in payload["amount_candidates"]
            ):
                selected = dict(selected)
                selected["candidate_storage_scope"] = "selected_amount_candidate"
                payload["amount_candidates"] = [*payload["amount_candidates"], selected]
            source = "amount_update_ready"
        elif policy_id in support_ratio_payloads:
            payload = apply_authoritative_fields(payload, support_ratio_payloads[policy_id], support_candidates)
            payload["selected_amount_candidate"] = None
            payload["max_amount_numeric_manwon"] = None
            payload["max_amount_actual"] = None
            source = "support_ratio_ready"
        elif not support_candidates:
            source = "no_support_candidate"

        counts[source] = counts.get(source, 0) + 1
        payloads.append(payload)
        audit_rows.append(
            {
                "policy_id": policy_id,
                "title": row.get("title"),
                "organization": row.get("organization"),
                "payload_source": source,
                "raw_candidate_count": len(raw_candidates),
                "support_candidate_count": len(support_candidates),
                "excluded_candidate_count": len(excluded_candidates),
                "selected_amount_manwon": (payload.get("selected_amount_candidate") or {}).get("amount_manwon"),
                "max_amount_numeric_manwon": payload.get("max_amount_numeric_manwon"),
                "max_amount_type": payload.get("max_amount_type"),
                "roi_apply_method": payload.get("roi_apply_method"),
                "support_ratio": payload.get("support_ratio"),
                "status": payload.get("max_amount_status"),
                "support_candidate_summary": audit_summary(support_candidates),
                "excluded_type_summary": " | ".join(
                    f"{candidate_type(candidate)}:{candidate.get('amount_manwon')}"
                    for candidate in excluded_candidates[:8]
                ),
                "decision": row.get("decision"),
                "decision_reasons": " | ".join(row.get("decision_reasons") or []),
                "url": row.get("url"),
            }
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    payload_path = output_dir / f"policy_amount_510_support_candidate_payload_{timestamp}.json"
    audit_path = output_dir / f"policy_amount_510_support_candidate_audit_{timestamp}.csv"
    summary_path = output_dir / f"policy_amount_510_support_candidate_summary_{timestamp}.md"

    write_json(payload_path, payloads)
    write_csv(audit_path, audit_rows)

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"rows={len(payloads)}",
        "",
        "## payload_source_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(counts.items()))
    lines.extend(["", "## kept_candidate_type_counts"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(kept_type_counts.items()))
    lines.extend(["", "## excluded_candidate_type_counts"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(excluded_type_counts.items()))
    lines.extend(
        [
            "",
            "## outputs",
            f"- payload: `{payload_path}`",
            f"- audit_csv: `{audit_path}`",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"rows={len(payloads)}")
    print("payload_source_counts=")
    for key, value in sorted(counts.items()):
        print(f"  {key}: {value}")
    print(f"payload={payload_path}")
    print(f"audit_csv={audit_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
