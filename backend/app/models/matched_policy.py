from pydantic import BaseModel

class MatchedPolicy(BaseModel):
    policy_id: str
    title: str
    match_score: float   # RAG 유사도 점수 (0.0 ~ 1.0)
    eligible: bool       # eligibility_checker 판단 결과
    reason: str          # 자격 판단 근거 (예: "업종 일치, 매출 기준 초과")
