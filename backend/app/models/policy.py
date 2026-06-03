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
