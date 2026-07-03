from app.core.database import get_db

def get_matched_policies(company_id: str) -> list[dict]:
    """기업에 매칭된 지원사업 조회"""
    # TODO: Supabase policy_matches 테이블 조회
    return []

def save_policy_match(company_id: str, policy_id: str, score: float) -> None:
    # TODO: Supabase upsert
    pass
