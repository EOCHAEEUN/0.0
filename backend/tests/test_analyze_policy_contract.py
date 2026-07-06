"""POST /api/analyze 응답(스냅샷 아이템 원형)과 GET 변환 응답의 정책 계약 검증.

- POST 응답의 policies/matched_policies는 policy_snapshot["policies"]
  (= _build_snapshot_policy_item 결과)를 그대로 내보낸다.
- GET /analyze/support-projects는 같은 아이템을
  _snapshot_policy_item_to_response로 변환해 내보낸다.
- 두 경로에서 프론트가 소비하는 핵심 필드(식별자, 정책명, match_score,
  금액 키, support_items)가 동일해야 한다.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.routers.analyze import (  # noqa: E402
    _build_snapshot_policy_item,
    _score_to_percent,
    _snapshot_policy_item_to_response,
)

# 프론트 금액 리더(RoiResultSections.getPolicyAmountText 등)가 조회하는 숫자 키.
# 이 중 하나라도 양수로 존재해야 "지원 한도 공고 확인 필요" 폴백을 피할 수 있다.
FRONTEND_AMOUNT_KEYS = (
    "max_amount_manwon",
    "max_amount",
    "support_amount",
    "support_limit",
    "subsidy_amount",
)


@pytest.mark.parametrize(
    ("raw_score", "expected_percent"),
    [
        (0.59, 59),
        (0.60, 60),
        (0.99, 99),
        (1.00, 100),
        # 1.0 초과 보너스 구간이 1%로 붕괴하지 않고 100으로 클램프된다.
        (1.01, 100),
        (1.05, 100),
        (1.3, 100),
    ],
)
def test_score_to_percent_uses_raw_scale_without_magnitude_heuristic(
    raw_score, expected_percent
):
    assert _score_to_percent({"hybrid_score": raw_score}) == expected_percent


def _matched_policy(**overrides):
    base = {
        "policy_id": "p1",
        "title": "설비 교체 지원",
        "hybrid_score": 1.05,
        "final_score": 1.02,
        "match_score": 1.05,
        "eligible": True,
        "reason": "설비 적합",
        "scenario_match": ["a"],
        "scenario_label": "A안 전체교체 적합",
        "llm_score": "●●●●○",
    }
    base.update(overrides)
    return base


def _policy_detail(**overrides):
    base = {
        "policy_id": "p1",
        "title": "설비 교체 지원",
        "summary": "노후 설비 교체 지원",
        "max_amount": 10000,
        "max_amount_actual": "최대 1억원",
        "support_items": [{"name": "설비구입비", "amount": "최대 1억원"}],
        "url": "https://example.com",
    }
    base.update(overrides)
    return base


def test_snapshot_item_contains_frontend_amount_and_identity_keys():
    item = _build_snapshot_policy_item(_matched_policy(), _policy_detail())

    assert item["policy_id"] == "p1"
    assert item["id"] == "p1"
    assert item["title"] == "설비 교체 지원"
    # 표시용 percent: raw 1.05 → 100 (1%가 아님)
    assert item["match_score"] == 100
    assert item["max_amount"] == 10000
    assert item["max_amount_manwon"] == 10000
    assert item["support_items"] == [{"name": "설비구입비", "amount": "최대 1억원"}]
    assert any(
        isinstance(item.get(key), (int, float)) and item.get(key) > 0
        for key in FRONTEND_AMOUNT_KEYS
    )


def test_post_snapshot_item_matches_get_converted_response_core_fields():
    item = _build_snapshot_policy_item(_matched_policy(), _policy_detail())
    converted = _snapshot_policy_item_to_response(item)

    for key in (
        "policy_id",
        "id",
        "title",
        "match_score",
        "max_amount",
        "max_amount_manwon",
        "support_items",
    ):
        assert converted[key] == item[key], key


def test_snapshot_item_without_numeric_amount_falls_back_to_actual_text():
    item = _build_snapshot_policy_item(
        _matched_policy(),
        _policy_detail(max_amount=None),
    )

    assert item["max_amount"] == "최대 1억원"

    converted = _snapshot_policy_item_to_response(item)
    assert converted["max_amount"] == "최대 1억원"


def test_legacy_snapshot_item_without_max_amount_key_keeps_numeric_fallback():
    # 과거에 저장된 스냅샷(max_amount 키 없음)은 기존 numeric 폴백을 유지한다.
    legacy_item = {
        "policy_id": "p-legacy",
        "title": "과거 스냅샷 정책",
        "match_score": 78,
        "max_amount_numeric_manwon": 5000,
        "max_amount_actual": "최대 5천만원",
        "support_items": [],
    }

    converted = _snapshot_policy_item_to_response(legacy_item)
    assert converted["max_amount"] == 5000
    assert converted["max_amount_manwon"] == 5000
    assert converted["match_score"] == 78
