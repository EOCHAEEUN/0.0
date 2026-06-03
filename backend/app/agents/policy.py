"""Policy Matching Agent — KIAT / 에너지공단 / KOTRA 공고 RAG 기반 매칭"""
from app.tools.vector_search import search_policies

def match_policies(company_context: dict, query: str) -> list[dict]:
    # TODO: 업종코드 + 지역 필터 적용
    return search_policies(query, n_results=5)
