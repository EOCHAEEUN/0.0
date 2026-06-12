"""박 차장 데모 시나리오 검증 스크립트.

ROI 계산과 ChromaDB 정책 검색 결과를 함께 확인합니다.

실행:
    python backend/scripts/demo_scenario_test.py

옵션:
    --no-policy     : ChromaDB 검색을 생략하고 ROI 계산만 실행
    --top N         : 검색 결과 상위 N개만 출력 (기본값 5)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT))

from app.models.equipment import EquipmentInput
from app.models.roi_input import RoiInput
from app.tools.roi_calc import calculate_roi

try:
    from app.tools.vector_search import search_policies
except Exception as exc:
    search_policies = None
    SEARCH_IMPORT_ERROR = exc
else:
    SEARCH_IMPORT_ERROR = None


def build_park_test_input() -> RoiInput:
    equipment = EquipmentInput(
        name="유압 프레스 라인 A",
        category="press",
        age_years=15,
        energy_cost_annual=4800,
        defect_rate=3.2,
        maintenance_cost_annual=None,
        capacity_value=None,
        production_qty=None,
        contribution_margin_won=None,
    )

    return RoiInput(equipment=equipment)


def run_roi_test() -> dict:
    roi_input = build_park_test_input()
    result = calculate_roi(roi_input)
    return result


def print_roi_summary(result: dict) -> None:
    print("=== 박 차장 ROI 시나리오 검증 ===")
    print(f"설비명: 유압 프레스 라인 A")
    print(f"카테고리: press")
    print(f"연령: 15년")
    print(f"연간 에너지비용: 4,800만원")
    print(f"불량률: 3.2%")
    print()

    for label in ["scenario_a", "scenario_b"]:
        scenario = result[label]
        print(f"[{label.upper()}] {scenario['label']}")
        print(f"  투자금: {scenario['investment_manwon']}만원")
        print(f"  예상 지원금: {scenario['subsidy_manwon']}만원")
        print(f"  실 부담: {scenario['net_investment_manwon']}만원")
        print(f"  연간 순효과: {scenario['annual_net_benefit_manwon']}만원")
        print(f"  회수기간: {scenario['payback_years']}년")
        print(f"  ROI: {scenario['roi_pct']}%")
        print()

    print(f"추천 시나리오: {result['recommended']}")
    print(f"AI 요약: {result['ai_recommendation']['summary']}")
    print(f"데이터 품질: {result['data_quality']['level']} ({result['data_quality']['score']})")
    print()


def run_policy_search(query: str, top_n: int = 5) -> list[dict]:
    if search_policies is None:
        raise RuntimeError(
            "app.tools.vector_search.search_policies를 가져올 수 없습니다. "
            f"import error: {SEARCH_IMPORT_ERROR}"
        )
    return search_policies(query, n_results=top_n)


def print_search_results(results: list[dict]) -> None:
    print("=== ChromaDB 검색 결과 ===")
    print(f"검색어: 프레스 설비 스마트공장 에너지")
    print(f"결과 개수: {len(results)}")
    print()

    for idx, item in enumerate(results, start=1):
        meta = item.get("metadata", {})
        summary = meta.get("summary", "")
        summary = summary.replace("\n", " ")[:140]
        print(f"{idx}. {meta.get('title', item.get('content', '<no title>'))}")
        print(f"   policy_id: {item.get('id')}")
        print(f"   organization: {meta.get('organization')}")
        print(f"   industry_code: {meta.get('industry_code')}")
        print(f"   deadline: {meta.get('deadline')}")
        print(f"   max_amount: {meta.get('max_amount')}")
        print(f"   region: {meta.get('region')}")
        print(f"   summary: {summary}")
        print(f"   distance: {item.get('distance')}")
        print()


def main() -> None:
    parser = argparse.ArgumentParser(description="박 차장 데모 시나리오 검증")
    parser.add_argument("--no-policy", action="store_true", help="ChromaDB 검색을 생략합니다")
    parser.add_argument("--top", type=int, default=5, help="검색 결과 출력 개수")
    args = parser.parse_args()

    roi_result = run_roi_test()
    print_roi_summary(roi_result)

    if args.no_policy:
        return

    if search_policies is None:
        print("\n=== ChromaDB 검색을 실행할 수 없습니다 ===")
        print(f"import error: {SEARCH_IMPORT_ERROR}")
        return

    try:
        results = run_policy_search("프레스 설비 스마트공장 에너지", top_n=args.top)
        print_search_results(results)
    except Exception as exc:
        print("\n=== ChromaDB 검색 실행 중 오류 ===")
        print(exc)


if __name__ == "__main__":
    main()
