from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.equipment import EquipmentInput


class CompanyOnboarding(BaseModel):
    # 기업 기본정보
    company_name: str
    business_registration_no: Optional[str] = None

    # 업종정보
    industry_name: Optional[str] = None
    industry_code: list[str]  # 예: ["C25"]

    # 소재지 및 기업 형태
    region: str  # 예: 경기도 안산시
    company_type: Optional[str] = None
    # 예: individual_business, corporation

    company_size: Optional[str] = None

    # 서비스 주요 이용 목적
    primary_purpose: list[str] = Field(default_factory=list)
    # 예:
    # ["지원사업 추천", "설비 ROI 분석", "안전점검"]

    # 기업규모 판단용 정보
    employee_count: Optional[int] = Field(default=None, ge=0)
    annual_revenue: Optional[int] = Field(default=None, ge=0)  # 만원 단위
    avg_revenue_3y_manwon: Optional[int] = Field(default=None, ge=0)
    total_assets_manwon: Optional[int] = Field(default=None, ge=0)

    # 독립성 판단 정보
    is_disclosure_group_member: Optional[bool] = None
    independence_check_passed: Optional[bool] = None

    # ROI 관련 기업정보
    energy_cost_annual: Optional[int] = Field(default=None, ge=0)


    # 최초 등록 설비
    equipment: Optional[EquipmentInput] = None


class CompanyContext(CompanyOnboarding):
    # DB 및 인증 연결정보
    company_id: Optional[str] = None
    user_id: Optional[str] = None

    # 서버에서 관리하는 시간
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
