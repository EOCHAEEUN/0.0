from fastapi import APIRouter
from app.models.company import CompanyOnboarding
from app.core.database import get_db

router = APIRouter()

@router.post("/onboarding")
async def register_company(body: CompanyOnboarding):
    db = get_db()
    # TODO: Supabase companies 테이블 upsert
    return {"status": "ok", "company_name": body.company_name}

@router.get("/onboarding/{company_id}")
async def get_company(company_id: str):
    db = get_db()
    # TODO: Supabase 조회
    return {}
