import asyncio
from pprint import pprint

from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.tools.query_builder import build_policy_queries_from_roi
from app.agents.policy import match_policies, merge_policy_candidates, rerank_policies_with_roi

def test():
    print("=== 1. 테스트용 더미 데이터 세팅 ===")
    company = CompanyContext(
        company_id="test_comp",
        company_name="테스트 기업",
        industry_code=[], # 필터 해제
        region="", # 필터 해제
        company_type="제조업",
    )
    
    equipment = EquipmentInput(
        name="유압 프레스",
        category="press",
        age_years=15,
        energy_cost_annual=8000,
    )
    
    # 가상의 ROI 결과 변경: '불량률/품질 개선'이 압도적으로 큰 경우
    roi_result = {
        "recommended": "A",
        "scenario_a": {
            "investment_manwon": 15000,
            "breakdown": {
                "energy_saving_manwon": 500,
                "maintenance_saving_manwon": 1000,
                "defect_saving_manwon": 6000 # 불량률/품질 개선이 가장 큼
            }
        },
        "scenario_b": {
            "investment_manwon": 4000,
            "breakdown": {
                "energy_saving_manwon": 200,
                "maintenance_saving_manwon": 1500, 
                "defect_saving_manwon": 3000 # 불량률/품질 개선이 가장 큼
            }
        }
    }
    
    print("\n=== 2. A/B 정책 검색 쿼리 생성 ===")
    queries = build_policy_queries_from_roi(equipment, roi_result)
    print(f"A안 쿼리: {queries['a']}")
    print(f"B안 쿼리: {queries['b']}")
    
    company_context = {
        "industry_code": company.industry_code,
        "region": company.region,
        "company_type": company.company_type,
    }

    print("\n=== 3. ChromaDB 정책 검색 (A/B 각각 10개씩) ===")
    a_candidates = match_policies(company_context, queries["a"])[:10]
    b_candidates = match_policies(company_context, queries["b"])[:10]
    
    print(f"A안 검색 결과: {len(a_candidates)}개")
    for p in a_candidates:
        print(f"  - {p['metadata']['title']} (distance: {p.get('distance', 1):.3f})")
        
    print(f"\nB안 검색 결과: {len(b_candidates)}개")
    for p in b_candidates:
        print(f"  - {p['metadata']['title']} (distance: {p.get('distance', 1):.3f})")
        
    print("\n=== 4. 후보 병합 ===")
    merged = merge_policy_candidates(a_candidates, b_candidates)
    print(f"중복 제거 후 총 {len(merged)}개 후보")
    for p in merged:
        print(f"  - {p['metadata']['title']} | 매칭 시나리오: {p['scenario_match']}")
        
    print("\n=== 5. ROI 기반 재정렬 (Reranking) ===")
    ranked = rerank_policies_with_roi(merged, roi_result)
    
    print(f"최종 추천 순위:")
    for idx, p in enumerate(ranked[:10]):
        print(f"\n[{idx+1}위] {p['metadata']['title']}")
        print(f"  - 시나리오 적합도: {p['scenario_label']}")
        print(f"  - 최종 점수: {p['final_score']}")
        print(f"  - 지원금 한도: {p['metadata'].get('max_amount', '정보없음')}만원")

if __name__ == "__main__":
    test()
