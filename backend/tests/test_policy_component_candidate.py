from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_component_candidate import (  # noqa: E402
    build_dry_run_report,
    build_dry_run_samples,
    extract_component_candidates,
    extract_policy_component_candidates,
)
from scripts.preview_policy_support_components import (  # noqa: E402
    load_policies_from_supabase,
)


def _policy(packages=None, support_items=None, **extra):
    policy = {
        "policy_id": "p1",
        "title": "복합 지원 정책",
        "organization": "지원기관",
        "temp_extraction_json": {
            "gemini_policy_enrichment_v7": {
                "support_packages": packages,
            }
        },
        "support_items": support_items,
        "selected_amount_candidate": {"amount_manwon": 9999},
        "max_amount_numeric_manwon": 9999,
        "support_ratio": 0.9,
        "roi_apply_method": "subtract",
    }
    policy.update(extra)
    return policy


def _package(package_type, name, **extra):
    package = {
        "type": package_type,
        "name": name,
        "evidence": f"{name} 지원 근거",
        "status": "확정",
    }
    package.update(extra)
    return package


def test_capex_grant_is_pending_proposal_only():
    candidate = extract_policy_component_candidates(
        _policy(
            [
                _package(
                    "현금보조",
                    "생산설비 도입비",
                    amount_numeric_manwon=3000,
                    roi_deductible=True,
                )
            ]
        )
    )[0]

    assert candidate.support_type == "direct_grant"
    assert candidate.effect_layer == "capex_offset"
    assert candidate.calculation_method == "fixed_cap"
    assert candidate.proposed_roi_apply_method == "subtract"
    assert candidate.review_status == "pending"


def test_financing_packages_are_never_roi_deduction_proposals():
    cases = [
        ("융자", "loan", "loan_terms"),
        ("이차보전", "interest_support", "interest_rate_subsidy"),
        ("보증", "guarantee", "guarantee_limit"),
    ]
    for raw_type, expected_type, method in cases:
        candidate = extract_policy_component_candidates(
            _policy([_package(raw_type, raw_type, amount_numeric_manwon=5000)])
        )[0]
        assert candidate.support_type == expected_type
        assert candidate.effect_layer == "financing_effect"
        assert candidate.calculation_method == method
        assert candidate.proposed_roi_apply_method == "none"
        assert candidate.cap_amount_manwon is None


def test_loan_labeled_interest_subsidy_is_classified_by_specific_effect():
    candidate = extract_policy_component_candidates(
        _policy([_package("융자", "중소기업육성기금 이자차액 보전")])
    )[0]

    assert candidate.support_type == "interest_support"
    assert candidate.effect_layer == "financing_effect"
    assert candidate.calculation_method == "interest_rate_subsidy"
    assert candidate.proposed_roi_apply_method == "none"


def test_execution_support_types_are_qualitative():
    for name, expected in [
        ("전문가 컨설팅", "consulting"),
        ("현장 멘토링", "mentoring"),
        ("재직자 교육", "education"),
    ]:
        candidate = extract_policy_component_candidates(
            _policy([_package("현물서비스", name, amount_numeric_manwon=1000)])
        )[0]
        assert candidate.support_type == expected
        assert candidate.effect_layer == "execution_support"
        assert candidate.calculation_method == "qualitative"
        assert candidate.proposed_roi_apply_method == "none"
        assert candidate.cap_amount_manwon is None


def test_testing_and_in_kind_do_not_estimate_amount():
    for package in [
        _package("현물서비스", "시험·인증 지원", amount_numeric_manwon=800),
        _package("현물서비스", "현물 서비스", amount_numeric_manwon=700),
    ]:
        candidate = extract_policy_component_candidates(_policy([package]))[0]
        assert candidate.effect_layer == "reference_only"
        assert candidate.proposed_roi_apply_method == "none"
        assert candidate.cap_amount_manwon is None


def test_multiple_packages_stay_separate_without_policy_amount_copy():
    candidates = extract_policy_component_candidates(
        _policy(
            [
                _package(
                    "현금보조",
                    "설비 도입비",
                    amount_numeric_manwon=2000,
                    roi_deductible=True,
                ),
                _package("융자", "시설자금 융자", amount_numeric_manwon=8000),
                _package("현물서비스", "전문가 컨설팅"),
            ]
        )
    )

    assert [item.support_type for item in candidates] == [
        "direct_grant",
        "loan",
        "consulting",
    ]
    assert [item.cap_amount_manwon for item in candidates] == [2000, None, None]
    assert all("multiple_support_effects" in item.quality_flags for item in candidates)
    assert candidates[1].source_component_json["policy_reference"][
        "max_amount_numeric_manwon"
    ] == 9999


def test_support_items_are_used_only_when_packages_are_absent():
    candidates = extract_policy_component_candidates(
        _policy(
            None,
            [
                {
                    "category": "기술·사업화",
                    "name": "기술 컨설팅",
                    "funding_type": "현물서비스",
                }
            ],
        )
    )

    assert len(candidates) == 1
    assert candidates[0].source_kind == "support_item"
    assert candidates[0].support_type == "consulting"


def test_policy_summary_fallback_marks_policy_level_amount_only():
    candidate = extract_policy_component_candidates(
        _policy(
            None,
            None,
            policy_primary_nature="지원 유형 미확인",
            support_primary_category="일반제조지원",
        )
    )[0]

    assert candidate.source_kind == "policy_summary"
    assert candidate.support_type == "other"
    assert "ambiguous_support_type" in candidate.quality_flags
    assert "policy_level_amount_only" in candidate.quality_flags
    assert "unsupported_source_shape" not in candidate.quality_flags
    assert candidate.cap_amount_manwon is None


def test_invalid_json_falls_back_without_exception():
    policy = _policy(None, "not-json")
    policy["temp_extraction_json"] = "{broken"

    candidate = extract_policy_component_candidates(policy)[0]

    assert candidate.source_kind == "support_item"
    assert "unsupported_source_shape" in candidate.quality_flags
    assert candidate.review_status == "pending"


def test_dry_run_report_has_no_auto_approval():
    policies = [
        _policy([_package("융자", "정책자금 융자")]),
        {
            **_policy(None, [{"name": "교육 지원", "funding_type": "현물서비스"}]),
            "policy_id": "p2",
        },
    ]
    candidates = extract_component_candidates(policies)
    report = build_dry_run_report(policies, candidates)

    assert report["processed_policy_count"] == 2
    assert report["financing_candidate_count"] == 1
    assert report["execution_support_candidate_count"] == 1
    assert report["auto_approved_count"] == 0
    assert report["all_candidates_pending"] is True
    assert report["financing_non_none_roi_count"] == 0
    assert report["execution_non_none_roi_count"] == 0
    assert report["reference_non_none_roi_count"] == 0
    assert report["suspected_policy_amount_duplication_count"] == 0
    assert report["duplicate_component_key_count"] == 0
    assert report["safety_checks_passed"] is True


def test_dry_run_samples_are_bounded():
    candidates = extract_policy_component_candidates(
        _policy(
            [
                _package("융자", "정책자금 융자"),
                _package("융자", "시설자금 융자"),
            ]
        )
    )

    samples = build_dry_run_samples(candidates, limit=1)

    assert len(samples["type_samples"]["loan"]) == 1
    assert len(samples["quality_flag_samples"]["missing_rate"]) == 2


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _ReadOnlyQuery:
    def __init__(self, rows, calls):
        self.rows = rows
        self.calls = calls
        self.policy_id = None
        self.bounds = (0, len(rows) - 1)

    def select(self, columns):
        self.calls.append(("select", columns))
        return self

    def order(self, column):
        self.calls.append(("order", column))
        return self

    def eq(self, column, value):
        self.calls.append(("eq", column, value))
        self.policy_id = value
        return self

    def range(self, start, end):
        self.calls.append(("range", start, end))
        self.bounds = (start, end)
        return self

    def execute(self):
        rows = self.rows
        if self.policy_id:
            rows = [row for row in rows if row.get("policy_id") == self.policy_id]
        start, end = self.bounds
        return _FakeResult(rows[start : end + 1])


class _ReadOnlyClient:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return _ReadOnlyQuery(self.rows, self.calls)


def test_supabase_loader_uses_select_only():
    client = _ReadOnlyClient(
        [{"policy_id": "p1"}, {"policy_id": "p2"}]
    )

    rows = load_policies_from_supabase(limit=1, client=client)

    assert rows == [{"policy_id": "p1"}]
    assert client.calls == [
        ("table", "policy"),
        ("select", "*"),
        ("order", "policy_id"),
        ("range", 0, 0),
    ]


def test_preview_cli_reads_fixture_without_database(tmp_path):
    input_path = tmp_path / "policies.json"
    input_path.write_text(
        json.dumps([_policy([_package("보증", "신용보증")])], ensure_ascii=False),
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
    report = json.loads(result.stdout)["report"]
    assert report["candidate_count"] == 1
    assert report["auto_approved_count"] == 0
