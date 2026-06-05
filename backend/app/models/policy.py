from datetime import date
from typing import Optional
from pydantic import BaseModel


class PolicyAnnouncement(BaseModel):
    policy_id: str
    title: str
    organization: str

    # 분류
    category: Optional[str] = None          # 예: R&D, 스마트공장, 에너지효율화, 수출지원
    sub_category: Optional[str] = None      # 예: 공정개선, 노후설비교체, 수출바우처

    # 지원 정보
    max_amount: Optional[int] = None
    deadline: Optional[date] = None
    deadline_note: Optional[str] = None  # 마감일이 불명확한 경우 설명

    # 대상 조건
    industry_codes: list[str]
    region: Optional[str] = None
    max_employee_count: Optional[int] = None  # 예: 300 (중소기업 기준)
    min_revenue: Optional[int] = None         # 만원
    max_revenue: Optional[int] = None         # 만원

    # 기타
    url: str
    summary: Optional[str] = None