from datetime import date
from typing import Optional
from pydantic import BaseModel


class PolicyAnnouncement(BaseModel):
    policy_id: str
    title: str
    organization: str
    max_amount: Optional[int] = None
    deadline: Optional[date] = None
    deadline_note: Optional[str] = None # 마감일이 불명확한 경우 설명을 추가할 수 있도록 deadline_note 필드 추가
    industry_codes: list[str]
    region: Optional[str] = None
    url: str
    summary: Optional[str] = None
    max_employee_count: Optional[int] = None
    min_revenue: Optional[int] = None
    max_revenue: Optional[int] = None