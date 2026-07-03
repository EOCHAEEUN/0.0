from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_INTEGRATED_PAYLOAD = (
    REPORT_DIR / "integrated_update" / "policy_amount_integrated_payload_20260703_131721.json"
)
DEFAULT_SUPPORT_RATIO_PAYLOAD = (
    REPORT_DIR / "remaining_fixups" / "support_ratio_only_payload_20260703_131716.json"
)
DEFAULT_REMAINING_CSV = REPORT_DIR / "remaining_review" / "remaining_amount_review_summary.csv"
DEFAULT_HOLD_CSV = REPORT_DIR / "remaining_fixups" / "hold_manual_adjudication_sheet_20260703_131716.csv"
DEFAULT_CANDIDATE_MISSING_CSV = REPORT_DIR / "remaining_fixups" / "candidate_missing_review_20260703_131716.csv"
DEFAULT_TOTAL_HOLD_CSV = REPORT_DIR / "remaining_fixups" / "total_scale_hold_20260703_131716.csv"


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


def payload_map(path: Path) -> dict[str, dict[str, Any]]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {clean(row.get("policy_id")): row for row in rows}


def manual_blank_columns() -> dict[str, str]:
    return {
        "manual_review_decision": "",
        "manual_amount_manwon": "",
        "manual_amount_actual": "",
        "manual_amount_type": "",
        "manual_roi_apply_method": "",
        "manual_support_ratio": "",
        "manual_evidence": "",
        "manual_note": "",
        "reviewer": "",
        "reviewed_at": "",
    }


def upload_row(policy_id: str, row: dict[str, Any], payload: dict[str, Any], category: str) -> dict[str, Any]:
    selected = payload.get("selected_amount_candidate") or {}
    return {
        "policy_id": policy_id,
        "title": row.get("title"),
        "organization": row.get("organization"),
        "upload_group": category,
        "upload_action": "upload_amount_payload" if category == "amount_update" else "upload_support_ratio_payload",
        "max_amount_numeric_manwon": payload.get("max_amount_numeric_manwon"),
        "max_amount_actual": payload.get("max_amount_actual"),
        "max_amount_type": payload.get("max_amount_type"),
        "roi_apply_method": payload.get("roi_apply_method"),
        "support_ratio": payload.get("support_ratio"),
        "basis_context": clean(selected.get("local_context") or selected.get("evidence") or payload.get("max_amount_evidence"), 700),
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_actual": row.get("old_actual"),
        "url": row.get("url"),
    }


def manual_row_from_hold(row: dict[str, str], source_group: str) -> dict[str, Any]:
    recommended = clean(row.get("recommended_action"))
    if recommended == "adopt_new_candidate":
        action_hint = "adopt_new_or_confirm"
    elif recommended == "exclude_or_recommend_only":
        action_hint = "exclude_or_recommend_only"
    else:
        action_hint = "manual_review_required"
    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "manual_group": source_group,
        "action_hint": action_hint,
        "system_reason": row.get("reason"),
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_actual": row.get("old_amount_actual"),
        "system_new_amount_manwon": row.get("new_amount_manwon"),
        "system_new_amount_type": row.get("new_amount_type"),
        "candidate_count": row.get("candidate_count"),
        "context": clean(row.get("context") or row.get("candidate_summary"), 900),
        "url": row.get("url"),
        **manual_blank_columns(),
    }


def manual_row_from_remaining(row: dict[str, str], source_group: str, action_hint: str) -> dict[str, Any]:
    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "manual_group": source_group,
        "action_hint": action_hint,
        "system_reason": row.get("review_reason") or row.get("reason"),
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_actual": row.get("old_amount_actual"),
        "system_new_amount_manwon": "",
        "system_new_amount_type": "",
        "candidate_count": row.get("candidate_count"),
        "context": clean(row.get("context") or row.get("candidate_summary"), 900),
        "url": row.get("url"),
        **manual_blank_columns(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build upload-ready and manual-review sheets for policy amount work.")
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--integrated-payload", default=str(DEFAULT_INTEGRATED_PAYLOAD))
    parser.add_argument("--support-ratio-payload", default=str(DEFAULT_SUPPORT_RATIO_PAYLOAD))
    parser.add_argument("--remaining-csv", default=str(DEFAULT_REMAINING_CSV))
    parser.add_argument("--hold-csv", default=str(DEFAULT_HOLD_CSV))
    parser.add_argument("--candidate-missing-csv", default=str(DEFAULT_CANDIDATE_MISSING_CSV))
    parser.add_argument("--total-hold-csv", default=str(DEFAULT_TOTAL_HOLD_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "upload_decision"))
    args = parser.parse_args()

    reparse_rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in reparse_rows}
    amount_payloads = payload_map(Path(args.integrated_payload))
    support_payloads = payload_map(Path(args.support_ratio_payload))
    remaining_rows = read_csv(Path(args.remaining_csv))
    hold_rows = read_csv(Path(args.hold_csv))
    candidate_missing_rows = read_csv(Path(args.candidate_missing_csv))
    total_hold_rows = read_csv(Path(args.total_hold_csv))

    upload_rows: list[dict[str, Any]] = []
    for policy_id, payload in sorted(amount_payloads.items()):
        upload_rows.append(upload_row(policy_id, rows_by_id.get(policy_id, {}), payload, "amount_update"))
    for policy_id, payload in sorted(support_payloads.items()):
        upload_rows.append(upload_row(policy_id, rows_by_id.get(policy_id, {}), payload, "support_ratio_only"))

    no_upload_rows: list[dict[str, Any]] = []
    manual_rows: list[dict[str, Any]] = []
    upload_ids = set(amount_payloads) | set(support_payloads)

    for row in hold_rows:
        policy_id = clean(row.get("policy_id"))
        if policy_id in upload_ids:
            continue
        manual_rows.append(manual_row_from_hold(row, "hold_large_delta_or_selected"))

    for row in total_hold_rows:
        policy_id = clean(row.get("policy_id"))
        if policy_id in upload_ids:
            continue
        manual_rows.append(manual_row_from_hold(row, "total_scale_hold"))

    for row in candidate_missing_rows:
        policy_id = clean(row.get("policy_id"))
        if policy_id in upload_ids:
            continue
        manual_rows.append(manual_row_from_remaining(row, "candidate_missing", "ocr_or_manual_source_check"))

    for row in remaining_rows:
        policy_id = clean(row.get("policy_id"))
        if policy_id in upload_ids or any(clean(manual.get("policy_id")) == policy_id for manual in manual_rows):
            continue
        bucket = clean(row.get("bucket"))
        action = clean(row.get("recommended_action"))
        if bucket in {"resolved_keep_old", "non_cash_only", "safe_non_update_remainder"} or action in {
            "no_representative_amount",
            "exclude_or_policy_decision",
            "recommend_only_or_exclude",
            "no_update_keep_existing",
            "no_payload_update",
        }:
            no_upload_rows.append(
                {
                    "policy_id": policy_id,
                    "title": row.get("title"),
                    "organization": row.get("organization"),
                    "no_upload_group": bucket,
                    "no_upload_reason": row.get("review_reason"),
                    "recommended_action": action,
                    "old_amount_manwon": row.get("old_amount_manwon"),
                    "old_amount_actual": row.get("old_amount_actual"),
                    "candidate_count": row.get("candidate_count"),
                    "url": row.get("url"),
                }
            )
        else:
            manual_rows.append(manual_row_from_remaining(row, bucket, "manual_review_required"))

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    upload_path = output_dir / f"upload_ready_sheet_{timestamp}.csv"
    manual_path = output_dir / f"manual_review_sheet_{timestamp}.csv"
    no_upload_path = output_dir / f"no_upload_sheet_{timestamp}.csv"
    summary_path = output_dir / f"upload_decision_summary_{timestamp}.md"

    write_csv(upload_path, upload_rows)
    write_csv(manual_path, manual_rows)
    write_csv(no_upload_path, no_upload_rows)

    upload_counts: dict[str, int] = {}
    for row in upload_rows:
        upload_counts[row["upload_group"]] = upload_counts.get(row["upload_group"], 0) + 1
    manual_counts: dict[str, int] = {}
    for row in manual_rows:
        manual_counts[row["manual_group"]] = manual_counts.get(row["manual_group"], 0) + 1
    no_upload_counts: dict[str, int] = {}
    for row in no_upload_rows:
        no_upload_counts[row["no_upload_group"]] = no_upload_counts.get(row["no_upload_group"], 0) + 1

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"upload_ready_rows={len(upload_rows)}",
        f"manual_review_rows={len(manual_rows)}",
        f"no_upload_rows={len(no_upload_rows)}",
        "",
        "## upload_ready_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(upload_counts.items()))
    lines.extend(["", "## manual_review_counts"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(manual_counts.items()))
    lines.extend(["", "## no_upload_counts"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(no_upload_counts.items()))
    lines.extend(
        [
            "",
            "## manual_input_columns",
            "- manual_review_decision: adopt_new / keep_old / exclude / support_ratio_only / needs_ocr / hold",
            "- manual_amount_manwon: 수기 채택 금액(만원)",
            "- manual_amount_actual: 화면 표시 문구",
            "- manual_amount_type: support_amount / subsidy / voucher / support_ratio / non_cash / loan / unknown",
            "- manual_roi_apply_method: subtract / ratio_cap / recommend_only / exclude / review",
            "- manual_support_ratio: 지원비율이 있으면 0.7 형태",
            "- manual_evidence: 사람이 확인한 근거 문장",
            "- manual_note: 검수 메모",
            "",
            "## outputs",
            f"- upload_ready_sheet: `{upload_path}`",
            f"- manual_review_sheet: `{manual_path}`",
            f"- no_upload_sheet: `{no_upload_path}`",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"upload_ready_rows={len(upload_rows)}")
    print(f"manual_review_rows={len(manual_rows)}")
    print(f"no_upload_rows={len(no_upload_rows)}")
    print(f"upload_ready_sheet={upload_path}")
    print(f"manual_review_sheet={manual_path}")
    print(f"no_upload_sheet={no_upload_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
