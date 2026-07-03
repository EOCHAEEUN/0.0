from datetime import date

from app.services.login_briefing import (
    _build_hero_summary,
    _is_available_policy,
    _recommended_scenario_key,
    _resolve_roi_percent,
    _resolve_subsidy_manwon,
)


def test_recommended_scenario_key_defaults_to_a():
    assert _recommended_scenario_key({"recommended": ""}) == "a"
    assert _recommended_scenario_key({"recommended": "B"}) == "b"


def test_is_available_policy_requires_parseable_future_deadline():
    today = date(2026, 7, 3)
    assert _is_available_policy(
        {"eligible": True, "deadline_display": "2026.08.01"},
        today=today,
    )
    assert not _is_available_policy(
        {"eligible": True, "deadline_display": "마감일 미정"},
        today=today,
    )
    assert not _is_available_policy(
        {"eligible": False, "deadline_display": "2026.08.01"},
        today=today,
    )


def test_subsidy_and_roi_from_active_roi():
    active_roi = {
        "scenario_a_subsidy_manwon": 4200,
        "scenario_b_subsidy_manwon": 8200,
        "roi_data": {
            "recommended": "B",
            "scenario_b": {"roi_pct": 98.2},
        },
    }
    subsidy, label = _resolve_subsidy_manwon(active_roi)
    assert subsidy == 8200
    assert label == "recommended"
    assert _resolve_roi_percent(active_roi) == 98.2


def test_hero_summary_without_analysis():
    assert "설비 정보" in _build_hero_summary(False, None)
