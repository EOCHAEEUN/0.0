"""Preview policy support component candidates without writing to a database."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_component_candidate import (  # noqa: E402
    build_dry_run_report,
    build_dry_run_samples,
    extract_component_candidates,
)
from app.services.policy_component_review_queue import (  # noqa: E402
    build_review_queue_payload,
    build_review_queue_summary,
    write_review_queue_csv,
    write_review_queue_json,
)


def _load_policies(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        policies = payload
    elif isinstance(payload, dict) and isinstance(payload.get("policies"), list):
        policies = payload["policies"]
    elif isinstance(payload, dict):
        policies = [payload]
    else:
        raise ValueError("입력 JSON은 policy 객체, policy 배열 또는 policies 배열이어야 합니다.")
    return [policy for policy in policies if isinstance(policy, dict)]


def load_policies_from_supabase(
    *,
    limit: int = 0,
    policy_id: str | None = None,
    client=None,
) -> list[dict[str, Any]]:
    if client is None:
        from app.core.database import get_db

        client = get_db()

    page_size = min(500, limit) if limit > 0 else 500
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        remaining = limit - len(rows) if limit > 0 else page_size
        if limit > 0 and remaining <= 0:
            break
        current_size = min(page_size, remaining) if limit > 0 else page_size
        query = client.table("policy").select("*").order("policy_id")
        if policy_id:
            query = query.eq("policy_id", policy_id)
        page = (
            query.range(offset, offset + current_size - 1).execute().data
            or []
        )
        rows.extend(row for row in page if isinstance(row, dict))
        if len(page) < current_size or policy_id:
            break
        offset += current_size
    return rows


def _write_csv(path: Path, candidates) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "policy_id",
        "policy_title",
        "component_key",
        "component_name",
        "support_type",
        "effect_layer",
        "calculation_method",
        "proposed_roi_apply_method",
        "review_status",
        "cap_amount_manwon",
        "support_ratio",
        "source_kind",
        "source_index",
        "quality_flags",
        "review_reasons",
        "source_component_json",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for candidate in candidates:
            row = candidate.to_dict()
            for key in ("quality_flags", "review_reasons", "source_component_json"):
                row[key] = json.dumps(row[key], ensure_ascii=False)
            writer.writerow({key: row.get(key) for key in fieldnames})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="정책 component 후보를 미리 봅니다. DB 쓰기는 없습니다."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="입력 JSON 파일")
    source.add_argument(
        "--from-supabase",
        action="store_true",
        help="기존 backend service client로 public.policy만 SELECT",
    )
    parser.add_argument("--limit", type=int, default=0, help="0이면 전체 조회")
    parser.add_argument("--policy-id", help="특정 policy_id만 조회")
    parser.add_argument(
        "--output-json",
        type=Path,
        help="지정한 경우에만 후보와 집계 JSON을 파일로 저장",
    )
    parser.add_argument("--output-csv", type=Path, help="지정한 경우에만 후보 CSV 저장")
    parser.add_argument(
        "--review-queue-csv",
        type=Path,
        help="지정한 경우에만 CAPEX 수동 검토 큐 CSV 저장",
    )
    parser.add_argument(
        "--review-queue-json",
        type=Path,
        help="지정한 경우에만 CAPEX 수동 검토 큐 JSON 저장",
    )
    parser.add_argument("--show-samples", type=int, default=5)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    policies = (
        load_policies_from_supabase(
            limit=max(0, args.limit),
            policy_id=args.policy_id,
        )
        if args.from_supabase
        else _load_policies(args.input)
    )
    candidates = extract_component_candidates(policies)
    report = build_dry_run_report(policies, candidates)
    samples = build_dry_run_samples(candidates, args.show_samples)

    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(
            json.dumps(
                {
                    "report": report,
                    "samples": samples,
                    "candidates": [candidate.to_dict() for candidate in candidates],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    if args.output_csv:
        _write_csv(args.output_csv, candidates)

    review_queue_summary = None
    if args.review_queue_csv or args.review_queue_json:
        review_payload = build_review_queue_payload(policies, candidates)
        review_queue = review_payload["candidates"]
        if args.review_queue_csv:
            write_review_queue_csv(args.review_queue_csv, review_queue)
        if args.review_queue_json:
            write_review_queue_json(args.review_queue_json, review_payload)
        review_queue_summary = build_review_queue_summary(
            review_queue,
            csv_path=args.review_queue_csv,
            json_path=args.review_queue_json,
        )

    print(
        json.dumps(
            {
                "report": report,
                "samples": samples,
                "review_queue_summary": review_queue_summary,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
