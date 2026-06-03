from pydantic import BaseModel
from typing import Optional

class CompanyOnboarding(BaseModel):
    company_name: str
    industry_code: str       # 예: C24 (금속가공)
    employee_count: int
    region: str              # 예: 경기도 안산시
    annual_revenue: Optional[int] = None
    energy_cost_annual: Optional[int] = None  # 만원/년

class CompanyContext(CompanyOnboarding):
    company_id: Optional[str] = None
