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
    normalize_roi_apply_method,
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
    ("investment", "cap", "expected"),
    [(10000, 3000, 3000), (500, 1000, 500)],
)
def test_subtract_uses_cap_without_applying_support_rate(investment, cap, expected):
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
