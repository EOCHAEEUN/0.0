from __future__ import annotations

import sys
import os
from pathlib import Path

import pytest

os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.agents.policy import (  # noqa: E402
    _estimate_policy_support,
    _support_parse_number,
    normalize_roi_apply_method,
    resolve_scenario_policy_support,
)
from app.models.equipment import EquipmentInput  # noqa: E402
from app.tools.roi_calc import BENCHMARKS, _build_scenario  # noqa: E402


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ("subtract", "subtract"),
        ("direct_subtract", "subtract"),
        ("직접 차감", "subtract"),
        ("ratio_cap", "ratio_cap"),
        ("ratio_with_cap", "ratio_cap"),
        ("비율 계산", "ratio_cap"),
        ("비율+한도", "ratio_cap"),
        ("exclude", "none"),
        (None, "none"),
        ("", "none"),
        ("unknown_method", "none"),
    ],
)
def test_normalize_roi_apply_method(raw_value, expected):
    assert normalize_roi_apply_method(raw_value) == expected


@pytest.mark.parametrize(
    ("raw_value", "expected_manwon"),
    [
        ("최대 1억원", 10000),
        ("1.5억원", 15000),
        ("100백만원", 10000),
        ("3000만원", 3000),
        ("50000000원", 5000),
    ],
)
def test_support_amount_parser_converts_korean_units(raw_value, expected_manwon):
    assert _support_parse_number(raw_value) == expected_manwon


def test_selected_candidate_display_unit_wins_over_corrupt_numeric_amount():
    result = _estimate_policy_support(
        {
            "roi_apply_method": "subtract",
            "support_ratio": 0.7,
            "selected_amount_candidate": {
                "amount_manwon": 1.0,
                "display_amount": "최대 1억원",
            },
            "max_amount_numeric_manwon": 69000,
        },
        18000,
    )

    assert result["max_amount_manwon"] == 10000
    assert result["applied_support_manwon"] == 10000


@pytest.mark.parametrize(
    ("investment", "cap", "expected"),
    [(10000, 3000, 1000), (500, 1000, 50)],
)
def test_subtract_applies_support_rate_when_present(investment, cap, expected):
    result = _estimate_policy_support(
        {
            "roi_apply_method": "subtract",
            "support_ratio": 0.1,
            "selected_amount_candidate": {"amount_manwon": cap},
            "max_amount_numeric_manwon": cap + 1000,
        },
        investment,
    )

    assert result["status"] == "applied"
    assert result["roi_apply_method"] == "subtract"
    assert result["applied_support_manwon"] == expected


def test_low_match_score_is_not_applied_to_roi():
    result = resolve_scenario_policy_support(
        "a",
        20000,
        [{
            "policy_id": "p-low",
            "title": "낮은 적합도 정책",
            "match_score": 0.54,
            "roi_apply_method": "ratio_cap",
            "support_ratio": 0.8,
            "max_amount_numeric_manwon": 30000,
        }],
    )

    assert result["status"] == "review_required"
    assert result["applied_support_manwon"] == 0
    assert result["policy_match_score"] == 0.54


def test_pending_financial_rule_is_not_applied_to_roi():
    result = resolve_scenario_policy_support(
        "a",
        20000,
        [{
            "policy_id": "p-pending",
            "title": "검토 중 정책",
            "match_score": 0.8,
            "review_status": "pending",
            "roi_apply_method": "ratio_cap",
            "support_ratio": 0.8,
            "max_amount_numeric_manwon": 30000,
        }],
    )

    assert result["status"] == "review_required"
    assert result["applied_support_manwon"] == 0


def test_approved_high_match_policy_applies_support():
    result = resolve_scenario_policy_support(
        "a",
        20000,
        [{
            "policy_id": "p-approved",
            "title": "승인 정책",
            "match_score": 0.8,
            "review_status": "approved",
            "roi_apply_method": "subtract",
            "support_ratio": 0.4,
            "max_amount_numeric_manwon": 15000,
        }],
    )

    assert result["status"] == "applied"
    assert result["applied_support_manwon"] == 8000


@pytest.mark.parametrize(
    ("raw_score", "expected_status"),
    [
        (0.59, "review_required"),
        (0.60, "applied"),
        (0.99, "applied"),
        (1.00, "applied"),
        # 보너스 가산으로 1.0을 넘는 raw 점수는 백분율로 오인되어
        # /100 처리되면 안 되고 그대로 ROI에 반영되어야 한다.
        (1.01, "applied"),
        (1.05, "applied"),
        # 산식상 상한: (1 - distance) 최대 1.0 + 보너스 최대 0.3
        (1.3, "applied"),
    ],
)
def test_roi_eligibility_uses_raw_score_scale(raw_score, expected_status):
    result = resolve_scenario_policy_support(
        "a",
        20000,
        [{
            "policy_id": "p-scale",
            "title": "점수 스케일 검증 정책",
            "match_score": raw_score,
            "roi_apply_method": "subtract",
            "support_ratio": 0.4,
            "max_amount_numeric_manwon": 15000,
        }],
    )

    assert result["status"] == expected_status
    if expected_status == "applied":
        assert result["applied_support_manwon"] == 8000
        # eligibility 점수는 0~1로 클램프되어 보고된다.
        assert result["policy_match_score"] == min(raw_score, 1.0)
    else:
        assert result["applied_support_manwon"] == 0
        assert result["policy_match_score"] == raw_score


def test_bonus_score_above_one_keeps_raw_ordering_and_is_selected():
    result = resolve_scenario_policy_support(
        "a",
        20000,
        [
            {
                "policy_id": "p-99",
                "title": "0.99 정책",
                "match_score": 0.99,
                "roi_apply_method": "subtract",
                "support_ratio": 0.4,
                "max_amount_numeric_manwon": 15000,
            },
            {
                "policy_id": "p-105",
                "title": "1.05 정책",
                "match_score": 1.05,
                "roi_apply_method": "subtract",
                "support_ratio": 0.4,
                "max_amount_numeric_manwon": 15000,
            },
        ],
    )

    # 1.05가 0.0105로 변환되어 탈락하지 않고, raw 정렬에서도 0.99보다 우선한다.
    assert result["status"] == "applied"
    assert result["policy_id"] == "p-105"
    assert result["policy_match_score"] == 1.0
    assert result["applied_support_manwon"] == 8000


@pytest.mark.parametrize(
    ("investment", "rate", "cap", "expected"),
    [(10000, 0.8, 6000, 6000), (5000, 0.5, 6000, 2500)],
)
def test_ratio_cap_requires_rate_and_cap(investment, rate, cap, expected):
    result = _estimate_policy_support(
        {
            "roi_apply_method": "ratio_cap",
            "support_ratio": rate,
            "max_amount_numeric_manwon": cap,
        },
        investment,
    )

    assert result["status"] == "applied"
    assert result["applied_support_manwon"] == expected


@pytest.mark.parametrize(
    "policy",
    [
        {"roi_apply_method": "ratio_cap", "max_amount_numeric_manwon": 6000},
        {"roi_apply_method": "ratio_cap", "support_ratio": 0.5},
    ],
)
def test_ratio_cap_missing_terms_is_not_deducted(policy):
    result = _estimate_policy_support(policy, 5000)

    assert result["status"] == "terms_missing"
    assert result["roi_apply_method"] == "ratio_cap"
    assert result["applied_support_manwon"] == 0
    assert "조건 부족" in result["calculation_basis"]


@pytest.mark.parametrize("method", ["none", "exclude", "unknown"])
def test_none_or_unknown_method_is_not_applicable(method):
    result = _estimate_policy_support(
        {
            "roi_apply_method": method,
            "support_ratio": 0.8,
            "max_amount_numeric_manwon": 6000,
        },
        10000,
    )

    assert result["status"] == "not_applicable"
    assert result["roi_apply_method"] == "none"
    assert result["applied_support_manwon"] == 0


@pytest.mark.parametrize("amount_type", ["loan", "guarantee", "interest_support"])
def test_financial_max_amount_type_blocks_deduction(amount_type):
    result = _estimate_policy_support(
        {
            "roi_apply_method": "ratio_cap",
            "max_amount_type": amount_type,
            "support_ratio": 0.8,
            "max_amount_numeric_manwon": 6000,
        },
        10000,
    )

    assert result["status"] == "not_applicable"
    assert result["roi_apply_method"] == "none"
    assert result["applied_support_manwon"] == 0
    assert amount_type in result["reason"]


def test_roi_calc_does_not_reduce_investment_for_zero_applied_support():
    equipment = EquipmentInput(
        name="프레스",
        category="press",
        age_years=10,
        energy_cost_annual=1000,
    )
    scenario = _build_scenario(
        equipment=equipment,
        bench=BENCHMARKS["press"],
        scenario_key="scenario_a",
        investment_override=10000,
        policy_application={
            "status": "not_applicable",
            "roi_apply_method": "none",
            "applied_support_manwon": 0,
        },
    )

    assert scenario["subsidy_manwon"] == 0
    assert scenario["net_investment_manwon"] == 10000
    assert scenario["roi_period_months"] == 12
    assert scenario["roi_basis"] == "annual_net_benefit"
    assert scenario["roi_pct"] == round(
        scenario["annual_net_benefit_manwon"]
        / scenario["net_investment_manwon"]
        * 100,
        1,
    )
