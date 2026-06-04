from pydantic import BaseModel
from typing import Optional
from datetime import date

class PolicyAnnouncement(BaseModel):
    policy_id: str
    title: str
    organization: str        # KIAT / 에너지공단 / KOTRA / KICOX
    max_amount: int          # 만원
    deadline: date
    industry_codes: list[str]
    region: Optional[str] = None
    url: str
    summary: Optional[str] = None
    max_employee_count: Optional[int] = None  # 예: 300 (중소기업 기준)
    min_revenue: Optional[int] = None         # 만원
    max_revenue: Optional[int] = None         # 만원


    #유진님 요청 추가 min, max 