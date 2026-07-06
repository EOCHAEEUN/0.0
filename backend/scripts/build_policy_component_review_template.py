"""Build an offline CAPEX review decision template from a local queue JSON."""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_component_review_recommendation import (  # noqa: E402
    build_decision_payload,
    build_decision_template,
    load_review_queue,
    sha256_file,
    write_decision_csv,
    write_decision_json,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="로컬 CAPEX 검토 큐를 사람용 판단표로 변환합니다."
    )
    parser.add_argument("--input-json", type=Path, required=True)
    parser.add_argument("--output-csv", type=Path, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    before_hash = sha256_file(args.input_json)
    before_mtime = args.input_json.stat().st_mtime_ns
    source_payload, candidates = load_review_queue(args.input_json)
    rows = build_decision_template(candidates)
    payload = build_decision_payload(source_payload, rows)

    write_decision_csv(args.output_csv, rows)
    write_decision_json(args.output_json, payload)

    after_hash = sha256_file(args.input_json)
    after_mtime = args.input_json.stat().st_mtime_ns
    if before_hash != after_hash or before_mtime != after_mtime:
        raise RuntimeError("입력 파일 무결성이 변경되었습니다.")

    summary = {
        "input_sha256_before": before_hash,
        "input_sha256_after": after_hash,
        "input_mtime_unchanged": before_mtime == after_mtime,
        "input_candidate_count": len(candidates),
        "output_candidate_count": len(rows),
        "recommended_action_counts": dict(
            sorted(Counter(row["recommended_action"] for row in rows).items())
        ),
        "risk_level_counts": dict(
            sorted(Counter(row["risk_level"] for row in rows).items())
        ),
        "review_decision_populated_count": sum(
            row["review_decision"] is not None for row in rows
        ),
        "output_csv": str(args.output_csv),
        "output_json": str(args.output_json),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
