from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_url_reparse"
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_AUDIT_CSV = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_support_candidate_audit_20260703_134149.csv"
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


def subtype(row: dict[str, Any]) -> tuple[str, str, str]:
    fetch_status = clean(row.get("fetch_status"))
    source_kind = clean(row.get("source_kind"))
    detail_len = int(row.get("detail_text_length") or 0)
    attach_len = int(row.get("attachment_text_length") or 0)
    raw_count = len(row.get("new_amount_candidates") or [])
    url = clean(row.get("url"))

    if fetch_status in {"fetch_failed", "missing_url", "fetched_empty"}:
        return "url_retry_or_new_source", "URL 재조회 또는 새 원문 확보", "원문 조회 실패/URL 없음/본문 비어 있음"
    if not url:
        return "new_crawl_needed", "새 수집으로 원문 URL 확보", "기존 policy에 유효 URL이 없음"
    if detail_len == 0 and attach_len == 0:
        return "source_text_missing", "첨부/OCR 또는 수동 원문 확보", "상세 본문과 첨부 텍스트가 모두 없음"
    if attach_len > 0 and raw_count == 0:
        return "attachment_ocr_or_table_review", "첨부 표/OCR 재파싱", "첨부 텍스트는 있으나 금액 후보가 없음"
    if detail_len > 0 and raw_count == 0:
        return "detail_text_no_amount", "상세 본문 규칙 재검토", "상세 본문은 있으나 금액 후보가 없음"
    return "support_type_filter_excluded", "지원분류 필터 재검토", "금액 후보는 있으나 지원 후보 타입으로 남지 않음"


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify 72 no-support-candidate rows for next collection/parsing work.")
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--audit-csv", default=str(DEFAULT_AUDIT_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "no_support_candidate_72"))
    args = parser.parse_args()

    rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in rows}
    audit_rows = [row for row in read_csv(Path(args.audit_csv)) if clean(row.get("payload_source")) == "no_support_candidate"]

    review_rows: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    for audit in audit_rows:
        policy_id = clean(audit.get("policy_id"))
        row = rows_by_id.get(policy_id, {})
        group, action, reason = subtype(row)
        counts[group] = counts.get(group, 0) + 1
        review_rows.append(
            {
                "policy_id": policy_id,
                "title": row.get("title") or audit.get("title"),
                "organization": row.get("organization") or audit.get("organization"),
                "subtype": group,
                "recommended_action": action,
                "reason": reason,
                "fetch_status": row.get("fetch_status"),
                "source_kind": row.get("source_kind"),
                "detail_text_length": row.get("detail_text_length"),
                "attachment_text_length": row.get("attachment_text_length"),
                "raw_candidate_count": len(row.get("new_amount_candidates") or []),
                "decision_reasons_ko": " | ".join(row.get("decision_reasons_ko") or []),
                "fetch_error": clean(row.get("fetch_error"), 400),
                "url": row.get("url"),
            }
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    review_csv = output_dir / f"no_support_candidate_72_review_{timestamp}.csv"
    ids_csv = output_dir / f"no_support_candidate_72_ids_{timestamp}.csv"
    summary_path = output_dir / f"no_support_candidate_72_summary_{timestamp}.md"

    write_csv(review_csv, review_rows)
    write_csv(ids_csv, [{"policy_id": row["policy_id"], "subtype": row["subtype"]} for row in review_rows])

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"rows={len(review_rows)}",
        "",
        "## subtype_counts",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(counts.items()))
    lines.extend(
        [
            "",
            "## outputs",
            f"- review_csv: `{review_csv}`",
            f"- ids_csv: `{ids_csv}`",
        ]
    )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"rows={len(review_rows)}")
    for key, value in sorted(counts.items()):
        print(f"{key}: {value}")
    print(f"review_csv={review_csv}")
    print(f"ids_csv={ids_csv}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
