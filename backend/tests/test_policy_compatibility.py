import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_compatibility import (
    assert_policy_compatible,
    evaluate_policy_compatibility,
)


def test_blocks_district_and_narrow_purpose_mismatch():
    result = evaluate_policy_compatibility(
        company={"region": "서울 구로구"},
        equipment={"name": "프레스 1호기", "category": "금속가공"},
        policy={
            "title": "[서울] 은평구 소규모 자영업자 LED간판 설치 지원사업",
            "raw_text": "은평구 소재 사업장에 LED 간판 설치비를 지원합니다.",
        },
    )

    assert result.compatible is False
    assert any("기업 소재지" in reason for reason in result.reasons)
    assert any("투자 목적" in reason for reason in result.reasons)


def test_allows_matching_manufacturing_policy():
    result = evaluate_policy_compatibility(
        company={"region": "경기 화성시"},
        equipment={"name": "CNC 설비", "category": "금속가공"},
        policy={
            "title": "경기도 제조기업 스마트공장 구축 지원사업",
            "summary": "경기도 소재 중소 제조기업의 생산설비와 데이터 수집 체계를 지원",
        },
    )

    assert result.compatible is True


def test_explicit_ineligible_is_blocked():
    try:
        assert_policy_compatible(
            company={"region": "경기"},
            equipment={"name": "CNC 설비"},
            policy={"title": "제조혁신 지원사업"},
            matched_policy={"eligible": False},
        )
    except ValueError as exc:
        assert "정책 불일치:" in str(exc)
    else:
        raise AssertionError("explicitly ineligible policy must be blocked")
