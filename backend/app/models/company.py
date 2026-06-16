from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.equipment import EquipmentInput


class CompanyOnboarding(BaseModel):
    user_id: Optional[UUID] = None
    company_name: str
    business_registration_no: Optional[str] = None
    industry_name: Optional[str] = None
    industry_code: list[str]
    region: str
    company_type: str
    primary_purpose: list[str] = Field(default_factory=list)
    employee_count: int = Field(ge=0)
    annual_revenue: int = Field(ge=0)
    revenue_2y_ago_manwon: Optional[int] = Field(default=None, ge=0)
    revenue_3y_ago_manwon: Optional[int] = Field(default=None, ge=0)
    total_assets_manwon: Optional[int] = Field(default=None, ge=0)
    is_disclosure_group_member: Optional[bool] = None
    independence_check_passed: Optional[bool] = None
    energy_cost_annual: Optional[int] = Field(default=None, ge=0)
    established_year: Optional[int] = Field(default=None, ge=1800)
    workplace_type: Optional[str] = None
    equipment: Optional[EquipmentInput] = None


class CompanyUpdate(BaseModel):
    user_id: Optional[UUID] = None
    company_name: Optional[str] = None
    business_registration_no: Optional[str] = None
    industry_name: Optional[str] = None
    industry_code: Optional[list[str]] = None
    region: Optional[str] = None
    company_type: Optional[str] = None
    primary_purpose: Optional[list[str]] = None
    employee_count: Optional[int] = Field(default=None, ge=0)
    annual_revenue: Optional[int] = Field(default=None, ge=0)
    revenue_2y_ago_manwon: Optional[int] = Field(default=None, ge=0)
    revenue_3y_ago_manwon: Optional[int] = Field(default=None, ge=0)
    total_assets_manwon: Optional[int] = Field(default=None, ge=0)
    is_disclosure_group_member: Optional[bool] = None
    independence_check_passed: Optional[bool] = None
    energy_cost_annual: Optional[int] = Field(default=None, ge=0)
    established_year: Optional[int] = Field(default=None, ge=1800)
    workplace_type: Optional[str] = None


class CompanyContext(CompanyUpdate):
    company_id: Optional[UUID | str] = None
    company_name: str = ""
    industry_code: list[str] = Field(default_factory=list)
    region: str = ""
    primary_purpose: list[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def estimated_avg_revenue_3y_manwon(self) -> Optional[int]:
        if self.annual_revenue is None:
            return None

        revenues = [
            self.annual_revenue,
            self.revenue_2y_ago_manwon or self.annual_revenue,
            self.revenue_3y_ago_manwon or self.annual_revenue,
        ]
        return round(sum(revenues) / len(revenues))
