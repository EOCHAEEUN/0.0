from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / "data" / "reports" / "policy_amount_url_reparse"
DEFAULT_FIXABLE_CSV = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_json_only_fixable_review.csv"
)
DEFAULT_SUPPORT_PAYLOAD = (
    REPORT_DIR
    / "support_candidate_payload_510"
    / "policy_amount_510_support_candidate_payload_20260703_140940.json"
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


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()), escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build support-ratio-only payload for 15 json-only rows.")
    parser.add_argument("--fixable-csv", default=str(DEFAULT_FIXABLE_CSV))
    parser.add_argument("--support-payload", default=str(DEFAULT_SUPPORT_PAYLOAD))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "ratio_only_15"))
    args = parser.parse_args()

    ratio_ids = {
        clean(row.get("policy_id"))
        for row in read_csv(Path(args.fixable_csv))
        if clean(row.get("fixability_group")) == "ratio_only"
    }
    payload_by_id = {
        clean(row.get("policy_id")): row
        for row in json.loads(Path(args.support_payload).read_text(encoding="utf-8"))
    }

    payloads: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []
    for policy_id in sorted(ratio_ids):
        base = payload_by_id.get(policy_id)
        if not base:
            continue
        candidates = base.get("amount_candidates") or []
        ratio_candidate = next((candidate for candidate in candidates if candidate.get("support_ratio") is not None), None)
        ratio = ratio_candidate.get("support_ratio") if ratio_candidate else base.get("support_ratio")
        if ratio is None:
            continue
        payload = dict(base)
        payload.update(
            {
                "selected_amount_candidate": None,
                "support_ratio": ratio,
                "max_amount_actual": None,
                "max_amount_status": "비율 확인",
                "max_amount_type": "support_ratio",
                "max_amount_type_ko": "지원비율",
                "max_amount_type_reason": "대표금액 없이 지원비율만 저장",
                "max_amount_numeric_manwon": None,
                "max_amount_evidence": clean(
                    (ratio_candidate or {}).get("evidence")
                    or (ratio_candidate or {}).get("local_context")
                    or (ratio_candidate or {}).get("raw_text"),
                    1000,
                ),
                "max_amount_note": "대표금액 없이 지원비율만 저장",
                "roi_apply_method": "ratio_cap",
                "roi_apply_method_ko": "지원비율 적용",
                "roi_apply_reason": "정액 한도 없이 지원비율만 확인됨",
            }
        )
        payloads.append(payload)
        audit_rows.append(
            {
                "policy_id": policy_id,
                "support_ratio": ratio,
                "max_amount_type": payload["max_amount_type"],
                "roi_apply_method": payload["roi_apply_method"],
                "evidence": payload["max_amount_evidence"],
            }
        )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    payload_path = output_dir / f"ratio_only_15_payload_{timestamp}.json"
    audit_path = output_dir / f"ratio_only_15_audit_{timestamp}.csv"
    summary_path = output_dir / f"ratio_only_15_summary_{timestamp}.md"
    write_json(payload_path, payloads)
    write_csv(audit_path, audit_rows)
    summary_path.write_text(
        "\n".join(
            [
                "DRY-RUN only. No database rows were updated.",
                f"source_ratio_only_ids={len(ratio_ids)}",
                f"payload_rows={len(payloads)}",
                "",
                "## outputs",
                f"- payload: `{payload_path}`",
                f"- audit_csv: `{audit_path}`",
            ]
        ),
        encoding="utf-8",
    )
    print(f"source_ratio_only_ids={len(ratio_ids)}")
    print(f"payload_rows={len(payloads)}")
    print(f"payload={payload_path}")
    print(f"audit_csv={audit_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
