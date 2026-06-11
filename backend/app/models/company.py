from pydantic import BaseModel
from typing import Optional
from app.models.equipment import EquipmentInput

class CompanyOnboarding(BaseModel):
    company_name: str
    industry_code: list[str]     # 예: C24 (금속가공)
    employee_count: Optional[int] = None
    region: str              # 예: 경기도 안산시
    annual_revenue: Optional[int] = None
    energy_cost_annual: Optional[int] = None  # 만원/년
    equipment: Optional[EquipmentInput] = None

class CompanyContext(CompanyOnboarding):
    company_id: Optional[str] = None
