from __future__ import annotations

import csv
import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_component_candidate import (  # noqa: E402
    PolicyComponentCandidate,
)
from app.services.policy_component_review_queue import (  # noqa: E402
    REVIEW_QUEUE_FIELDS,
    build_capex_review_queue,
    build_review_queue_payload,
    write_review_queue_csv,
    write_review_queue_json,
)


def _candidate(
    key: str,
    *,
    layer: str = "capex_offset",
    method: str = "subtract",
    evidence: str | None = "설비 도입비 지원 근거",
    amount: float | None = 1000,
    ratio: float | None = None,
) -> PolicyComponentCandidate:
    return PolicyComponentCandidate(
        policy_id=f"policy-{key}",
        policy_title=f"정책 {key}",
        component_key=key,
        component_name=f"지원 {key}",
        support_type="direct_grant",
        effect_layer=layer,
        calculation_method=(
            "ratio_cap" if method == "ratio_cap" else "fixed_cap"
        ),
        proposed_roi_apply_method=method,
        review_status="pending",
        cap_amount_manwon=amount,
        support_ratio=ratio,
        eligible_cost_ratio=0.8,
        evidence_text=evidence,
        evidence_source_type="support_package",
        evidence_source_name="지원기관",
        evidence_page_or_section="2쪽",
        source_kind="support_package",
        source_index=1,
        source_component_json={"component": {"name": f"지원 {key}"}},
        quality_flags=["multiple_support_effects"],
        review_reasons=["수동 확인 필요"],
    )


def test_review_queue_contains_only_capex_candidates():
    candidates = [
        _candidate("capex"),
        _candidate("finance", layer="financing_effect", method="none"),
        _candidate("execution", layer="execution_support", method="none"),
        _candidate("reference", layer="reference_only", method="none"),
    ]

    queue = build_capex_review_queue(candidates)

    assert [row["component_key"] for row in queue] == ["capex"]


def test_review_fields_are_empty_and_candidate_data_is_preserved():
    row = build_capex_review_queue([_candidate("one")])[0]

    assert row["review_decision"] is None
    assert row["reviewer_note"] is None
    assert row["reviewed_at"] is None
    assert row["cap_amount_manwon"] == 1000
    assert row["eligible_cost_ratio"] == 0.8
    assert row["evidence_text"] == "설비 도입비 지원 근거"
    assert row["quality_flags"] == ["multiple_support_effects"]
    assert row["source_component_json"]["component"]["name"] == "지원 one"


def test_review_queue_sort_priority():
    candidates = [
        _candidate("subtract-no-evidence", evidence=None),
        _candidate("subtract-evidence"),
        _candidate("ratio", method="ratio_cap", ratio=0.5),
        _candidate("none", method="none"),
    ]

    queue = build_capex_review_queue(candidates)

    assert [row["component_key"] for row in queue] == [
        "ratio",
        "subtract-evidence",
        "subtract-no-evidence",
        "none",
    ]


def test_json_payload_has_metadata_and_no_auto_approval():
    payload = build_review_queue_payload(
        [{"policy_id": "p1"}, {"policy_id": "p2"}],
        [_candidate("one")],
    )

    assert payload["mode"] == "dry_run_review_queue"
    assert payload["source"] == "public.policy"
    assert payload["policy_count"] == 2
    assert payload["candidate_count"] == 1
    assert payload["auto_approved_count"] == 0
    assert payload["candidates"][0]["review_decision"] is None


def test_csv_and_json_writers_use_required_shape(tmp_path):
    payload = build_review_queue_payload(
        [{"policy_id": "p1"}],
        [_candidate("one")],
    )
    csv_path = tmp_path / "review.csv"
    json_path = tmp_path / "review.json"

    write_review_queue_csv(csv_path, payload["candidates"])
    write_review_queue_json(json_path, payload)

    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
        assert list(rows[0]) == REVIEW_QUEUE_FIELDS
        assert rows[0]["review_decision"] == ""
        assert rows[0]["reviewer_note"] == ""
        assert rows[0]["reviewed_at"] == ""
        assert json.loads(rows[0]["quality_flags"]) == [
            "multiple_support_effects"
        ]
    saved = json.loads(json_path.read_text(encoding="utf-8"))
    assert saved["auto_approved_count"] == 0
    assert saved["candidates"][0]["review_decision"] is None


def test_cli_without_review_paths_creates_no_review_files(tmp_path):
    input_path = tmp_path / "policies.json"
    input_path.write_text(
        json.dumps(
            [
                {
                    "policy_id": "p1",
                    "title": "정책",
                    "support_items": [],
                }
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    script = ROOT / "scripts" / "preview_policy_support_components.py"

    result = subprocess.run(
        [sys.executable, str(script), "--input", str(input_path)],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )

    assert result.returncode == 0
    assert json.loads(result.stdout)["review_queue_summary"] is None
    assert sorted(path.name for path in tmp_path.iterdir()) == ["policies.json"]
