import uuid
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

_INDUSTRY_CODE_RE = re.compile(r"^[A-Z]\d{2}$")


class EquipmentCreate(BaseModel):
    name: str
    category: str
    age_years: int
    defect_rate: Optional[float] = None


class OnboardingRequest(BaseModel):
    company_name: str
    industry_code: str          # 예: "C24"
    region: str                 # 예: "경기도 안산시"
    employee_count: int
    annual_energy_cost: int     # 만원/년
    equipments: List[EquipmentCreate]


@router.post("/onboarding")
async def register_company(body: OnboardingRequest):
    if not _INDUSTRY_CODE_RE.match(body.industry_code):
        raise HTTPException(
            status_code=422,
            detail={"error": "업종코드 형식이 올바르지 않습니다.", "code": "INVALID_INDUSTRY"},
        )

    company_id = str(uuid.uuid4())

    # TODO: Supabase companies + equipments 테이블 upsert

    return {
        "company_id": company_id,
        "message": "등록 완료",
        "dashboard_ready": True,
    }


@router.get("/onboarding/{company_id}")
async def get_company(company_id: str):
    # TODO: Supabase 조회
    return {}
