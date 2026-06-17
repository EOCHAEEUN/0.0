"""
ROI 결과 기반으로 정책 검색 쿼리를 A안/B안 각각 생성합니다.
"""


def _to_number(value) -> float:
    """숫자 타입 안전 변환 — 문자열, None 등 방어."""
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _get_equipment_keywords(equipment) -> list[str]:
    """설비 카테고리를 한글 키워드로 매핑합니다."""
    name = getattr(equipment, "name", "") or ""
    category = getattr(equipment, "category", "") or ""

    mapping = {
        "press": ["프레스", "금속가공"],
        "cnc": ["CNC", "가공설비", "공작기계"],
        "injection": ["사출기", "사출성형기", "플라스틱"],
    }

    return [name] + mapping.get(str(category).lower(), [category] if category else [])


def _get_scenario_keywords(scenario_key: str) -> list[str]:
    """A안/B안 투자방식 키워드 — 금액이 아닌 시나리오로 결정."""
    if scenario_key == "scenario_a":
        return ["전체교체", "노후설비 교체", "설비투자", "고효율 설비"]
    if scenario_key == "scenario_b":
        return ["부분교체", "부품교체", "공정개선", "스마트 모니터링", "유지보수 개선"]
    return []


def _get_scale_keywords(investment_manwon: float) -> list[str]:
    """투자 규모 보조 키워드 — 전체/부분 구분 용도가 아님."""
    if investment_manwon >= 10000:
        return ["대규모 투자", "스마트공장", "고도화", "지원금 규모 큰 사업"]
    elif investment_manwon >= 3000:
        return ["중규모 투자", "설비개선", "자동화"]
    else:
        return ["소규모 개선", "바우처", "컨설팅"]


def _get_impact_keywords(breakdown: dict) -> list[str]:
    """ROI breakdown 기준 개선 목적 키워드."""
    energy = breakdown.get("energy_saving_manwon") or 0
    maintenance = breakdown.get("maintenance_saving_manwon") or 0
    defect = breakdown.get("defect_saving_manwon") or 0

    # 전부 0이면 기본 키워드
    if energy == 0 and maintenance == 0 and defect == 0:
        return ["설비개선", "생산성 향상"]

    largest = max(
        [("energy", energy), ("maintenance", maintenance), ("defect", defect)],
        key=lambda x: x[1],
    )[0]

    if largest == "energy":
        return ["에너지절감", "에너지효율", "탄소감축", "전력비 절감"]
    if largest == "maintenance":
        return ["유지보수", "설비개선", "예방정비", "설비관리"]
    return ["품질개선", "불량률 감소", "생산성 향상", "스마트제조"]


def _unique_keywords(keywords: list[str]) -> list[str]:
    """순서 유지하며 중복 제거."""
    seen = set()
    result = []
    for kw in keywords:
        kw = str(kw).strip()
        if kw and kw not in seen:
            seen.add(kw)
            result.append(kw)
    return result


def build_policy_queries_from_roi(equipment, roi_result: dict) -> dict[str, str]:
    """
    ROI 결과 기반으로 A안/B안 정책 검색 쿼리를 반환합니다.

    Returns:
        {"a": "쿼리 문자열", "b": "쿼리 문자열"}
    """
    scenario_a = roi_result.get("scenario_a", {})
    scenario_b = roi_result.get("scenario_b", {})

    equipment_keywords = _get_equipment_keywords(equipment)

    # A안 쿼리 구성
    a_keywords = (
        equipment_keywords
        + _get_scenario_keywords("scenario_a")
        + _get_impact_keywords(scenario_a.get("breakdown", {}))
        + _get_scale_keywords(_to_number(scenario_a.get("investment_manwon")))
        + ["지원사업"]
    )

    # B안 쿼리 구성
    b_keywords = (
        equipment_keywords
        + _get_scenario_keywords("scenario_b")
        + _get_impact_keywords(scenario_b.get("breakdown", {}))
        + _get_scale_keywords(_to_number(scenario_b.get("investment_manwon")))
        + ["지원사업"]
    )

    return {
        "a": " ".join(_unique_keywords(a_keywords)),
        "b": " ".join(_unique_keywords(b_keywords)),
    }
