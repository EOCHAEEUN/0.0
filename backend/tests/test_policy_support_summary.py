from __future__ import annotations

import copy
import os
from pathlib import Path
import sys


os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.models.equipment import EquipmentInput  # noqa: E402
from app.services.policy_support_summary import (  # noqa: E402
    build_policy_support_summary,
    empty_policy_support_summary,
    fetch_policy_support_components,
    load_policy_support_summary,
)
from app.tools.roi_calc import calculate_roi  # noqa: E402


def _component(**overrides):
    component = {
        "id": "component-1",
        "policy_id": "p1",
        "component_key": "support_package_0_direct_grant",
        "component_name": "생산설비 지원",
        "support_type": "direct_grant",
        "effect_layer": "capex_offset",
        "calculation_method": "fixed_cap",
        "review_status": "pending",
        "roi_apply_method": "none",
        "fixed_amount_manwon": None,
        "cap_amount_manwon": 3000,
        "support_ratio": None,
        "eligible_cost_ratio": None,
        "evidence_text": "생산설비 도입 비용 최대 3천만원",
        "evidence_source_type": "support_package",
        "evidence_source_name": "지원기관",
        "evidence_page_or_section": None,
        "source_component_json": {"component": {"name": "생산설비 지원"}},
        "component_version": 1,
    }
    component.update(overrides)
    return component


def test_pending_none_component_is_visible_without_changing_roi():
    equipment = EquipmentInput(
        name="프레스",
        category="press",
        age_years=10,
        energy_cost_annual=1000,
        scenario_a_investment_manwon=10000,
        scenario_b_investment_manwon=15000,
    )
    before = calculate_roi(
        equipment,
        energy_provided=True,
        policy_applications=None,
    )
    frozen = copy.deepcopy(before)

    summary = build_policy_support_summary([_component()])

    assert before == frozen
    assert summary["business_roi_support"]["pending_count"] == 1
    assert summary["business_roi_support"]["approved_count"] == 0
    assert summary["business_roi_support"]["roi_effect_applied"] is False
    item = summary["business_roi_support"]["items"][0]
    assert item["roi_apply_method"] == "none"
    assert item["applied_amount_manwon"] == 0
    assert item["roi_effect_applied"] is False


def test_pending_direct_grant_capex_offset_never_applies_roi_effect():
    summary = build_policy_support_summary(
        [_component(support_type="direct_grant", effect_layer="capex_offset")]
    )

    item = summary["business_roi_support"]["items"][0]
    assert item["review_status"] == "pending"
    assert item["roi_effect_applied"] is False
    assert item["applied_amount_manwon"] == 0


def test_financing_and_execution_support_have_zero_deduction():
    summary = build_policy_support_summary(
        [
            _component(
                component_key="loan",
                support_type="loan",
                effect_layer="financing_effect",
                calculation_method="loan_terms",
            ),
            _component(
                component_key="consulting",
                support_type="consulting",
                effect_layer="execution_support",
                calculation_method="qualitative",
            ),
            _component(
                component_key="testing",
                support_type="testing_certification",
                effect_layer="reference_only",
                calculation_method="qualitative",
            ),
        ]
    )

    assert len(summary["financing_support"]["items"]) == 1
    assert len(summary["execution_support"]["items"]) == 2
    assert all(
        item["applied_amount_manwon"] == 0
        and item["roi_effect_applied"] is False
        for layer in ("financing_support", "execution_support")
        for item in summary[layer]["items"]
    )


def test_no_components_or_database_failure_returns_empty_summary():
    assert build_policy_support_summary([]) == empty_policy_support_summary()

    class FailingDb:
        def table(self, _name):
            raise RuntimeError("database unavailable")

    assert load_policy_support_summary(FailingDb(), ["p1"]) == (
        empty_policy_support_summary()
    )


def test_multiple_components_for_same_policy_are_grouped_together():
    summary = build_policy_support_summary(
        [
            _component(
                policy_id="PBLN_000000000123942",
                component_key="support_package_0_direct_grant",
                component_name="금형 고도화",
            ),
            _component(
                id="component-2",
                policy_id="PBLN_000000000123942",
                component_key="support_package_1_direct_grant",
                component_name="생산설비 고도화",
            ),
        ]
    )

    items = summary["business_roi_support"]["items"]
    assert len(items) == 2
    assert {item["policy_id"] for item in items} == {
        "PBLN_000000000123942"
    }
    assert summary["business_roi_support"]["pending_count"] == 2


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, rows, calls):
        self.rows = rows
        self.calls = calls

    def select(self, fields):
        self.calls.append(("select", fields))
        return self

    def in_(self, field, values):
        self.calls.append(("in", field, values))
        return self

    def execute(self):
        self.calls.append(("execute",))
        return _Result(self.rows)


class _Db:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return _Query(self.rows, self.calls)


def test_repository_uses_policy_component_select_only():
    db = _Db([_component()])

    rows = fetch_policy_support_components(db, ["p1", "p1", ""])

    assert len(rows) == 1
    assert db.calls[0] == ("table", "policy_support_component")
    assert db.calls[1][0] == "select"
    assert db.calls[2] == ("in", "policy_id", ["p1"])
    assert db.calls[3] == ("execute",)
