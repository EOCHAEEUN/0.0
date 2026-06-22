from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CompanyInputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CompanyOnboarding(CompanyInputModel):
    company_name: str = Field(min_length=1, max_length=120)
    business_registration_no: Optional[str] = Field(default=None, max_length=20)
    industry_name: Optional[str] = Field(default=None, max_length=120)
    industry_code: list[str] = Field(min_length=1, max_length=20)
    region: str = Field(min_length=1, max_length=100)
    company_type: Optional[str] = Field(default=None, max_length=50)
    primary_purpose: list[str] = Field(default_factory=list, max_length=20)
    employee_count: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    annual_revenue: int = Field(ge=0, le=10**15)


class CompanyUpdate(CompanyInputModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    business_registration_no: Optional[str] = Field(default=None, max_length=20)
    industry_name: Optional[str] = Field(default=None, max_length=120)
    industry_code: Optional[list[str]] = Field(default=None, max_length=20)
    region: Optional[str] = Field(default=None, max_length=100)
    company_type: Optional[str] = Field(default=None, max_length=50)
    primary_purpose: Optional[list[str]] = Field(default=None, max_length=20)
    employee_count: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    annual_revenue: Optional[int] = Field(default=None, ge=0, le=10**15)
    revenue_2y_ago_manwon: Optional[int] = Field(default=None, ge=0, le=10**15)
    revenue_3y_ago_manwon: Optional[int] = Field(default=None, ge=0, le=10**15)
    total_assets_manwon: Optional[int] = Field(default=None, ge=0, le=10**15)
    is_disclosure_group_member: Optional[bool] = None
    independence_check_passed: Optional[bool] = None
    established_year: Optional[int] = Field(default=None, ge=1800, le=2200)
    workplace_type: Optional[str] = Field(default=None, max_length=50)


class CompanyContext(CompanyUpdate):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    company_id: Optional[UUID | str] = None
    company_name: str = ""
    industry_code: list[str] = Field(default_factory=list)
    region: str = ""
    primary_purpose: list[str] = Field(default_factory=list)
    energy_cost_annual: Optional[int] = Field(default=None, ge=0, le=10**12)
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
