"""Policy Matching Agent — KIAT / 에너지공단 / KOTRA 공고 RAG 기반 매칭"""
from app.tools.vector_search import search_policies

def match_policies(company_context: dict, query: str) -> list[dict]:
    """
    기업 컨텍스트(업종코드, 지역 등)를 고려한 지원사업 매칭
    
    Args:
        company_context: 기업 정보 (industry_code, region 등)
        query: 사용자 검색 쿼리
    
    Returns:
        매칭된 공고 리스트 (RAG 유사도 기반 정렬)
    """
    # ChromaDB 메타데이터 기반 필터링
    where_filters = []
    
    # 1. 업종코드 필터 (optional)
    if company_context.get("industry_code"):
        # industry_codes는 쉼표로 구분된 문자열로 저장되어 있음
        where_filters.append({
            "industry_codes": {"$contains": company_context["industry_code"]}
        })
    
    # 2. 지역 필터 (optional) - 전국 공고나 해당 지역 공고만
    if company_context.get("region"):
        # region이 비어있거나 해당 지역을 포함하는 공고
        where_filters.append({
            "$or": [
                {"region": ""},  # 전국 공고
                {"region": {"$contains": company_context["region"]}}
            ]
        })
    
    # 필터가 있으면 적용, 없으면 None으로 전체 검색
    where = where_filters[0] if where_filters else None
    
    return search_policies(query, n_results=5, where=where)
