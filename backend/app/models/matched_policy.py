from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class MatchedPolicy(BaseModel):
    matched_policy_id: Optional[str] = None
    company_id: str
    equipment_id: str
    policy_id: str
    title: str
    match_score: float   # 정책 매칭 점수. 저장값은 0~100 또는 0~1 스케일을 허용.
    eligible: bool       # eligibility_checker 판단 결과
    reason: str           # 정책 추천 근거
    llm_score: Optional[str] = None  # LLM 적합도 (●●●●● ~ ●●●○○)
    scenario_match: Optional[list[str]] = None
    scenario_label: Optional[str] = None
    created_at: Optional[datetime] = None
