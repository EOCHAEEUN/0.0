"""Build a local-only pending component import preview from reviewed CSV."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_component_pending_plan import (  # noqa: E402
    build_pending_plan,
    load_decision_csv,
    sha256_file,
    write_audit_csv,
    write_plan_json,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="검토 완료 CSV에서 로컬 pending 적재 미리보기만 생성합니다."
    )
    parser.add_argument("--input-csv", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--output-audit-csv", type=Path, required=True)
    parser.add_argument(
        "--allow-local-plan-export",
        action="store_true",
        help="DB 작업 없이 로컬 계획 파일 생성만 명시적으로 허용",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if not args.allow_local_plan_export:
        print(
            "--allow-local-plan-export가 없어 파일을 생성하지 않았습니다.",
            file=sys.stderr,
        )
        return 2

    before_hash = sha256_file(args.input_csv)
    before_stat = args.input_csv.stat()
    input_fields, rows = load_decision_csv(args.input_csv)
    payload, audit_rows = build_pending_plan(
        rows,
        input_file=str(args.input_csv),
        input_sha256=before_hash,
    )

    write_plan_json(args.output_json, payload)
    write_audit_csv(args.output_audit_csv, input_fields, audit_rows)

    after_hash = sha256_file(args.input_csv)
    after_stat = args.input_csv.stat()
    if (
        before_hash != after_hash
        or before_stat.st_mtime_ns != after_stat.st_mtime_ns
        or before_stat.st_size != after_stat.st_size
    ):
        raise RuntimeError("입력 CSV 무결성이 변경되었습니다.")

    planned = payload["planned_rows"]
    summary = {
        "input_sha256_before": before_hash,
        "input_sha256_after": after_hash,
        "input_mtime_unchanged": before_stat.st_mtime_ns
        == after_stat.st_mtime_ns,
        "input_row_count": len(rows),
        "audit_row_count": len(audit_rows),
        "approved_for_pending_count": payload["approved_for_pending_count"],
        "hold_count": payload["hold_count"],
        "excluded_count": payload["excluded_count"],
        "blank_decision_count": payload["blank_decision_count"],
        "invalid_decision_count": payload["invalid_decision_count"],
        "planned_insert_count": payload["planned_insert_count"],
        "planned_pending_count": sum(
            row["review_status"] == "pending" for row in planned
        ),
        "planned_approved_count": sum(
            row["review_status"] == "approved" for row in planned
        ),
        "planned_non_none_roi_count": sum(
            row["roi_apply_method"] != "none" for row in planned
        ),
        "database_write_performed": False,
        "output_json": str(args.output_json),
        "output_audit_csv": str(args.output_audit_csv),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
