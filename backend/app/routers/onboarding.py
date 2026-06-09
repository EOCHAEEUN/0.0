from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.models.company import CompanyOnboarding
from app.core.database import get_db
from datetime import datetime

router = APIRouter()


@router.post("/onboarding")
async def register_company(body: CompanyOnboarding):
    db = get_db()

    payload = {
        "name": body.company_name,
        "industry_code": ",".join(body.industry_code),
        "employee_count": body.employee_count,
        "region": body.region,
        "annual_revenue": body.annual_revenue,
        "energy_cost_annual": body.energy_cost_annual,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }

    try:
        result = db.table("company").insert(payload).execute()

        company = result.data[0] if result.data else payload

        return {
            "success": True,
            "data": {
                "company_id": company.get("id"),
                "company": company
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "온보딩 정보를 Supabase에 저장하지 못했습니다.",
                "error": str(e)
            }
        )


@router.get("/onboarding/{company_id}")
async def get_company(company_id: str):
    db = get_db()

    try:
        result = (
            db.table("company")
            .select("*")
            .eq("id", company_id)
            .single()
            .execute()
        )

        return {
            "success": True,
            "data": result.data
        }

    except Exception as e:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "회사를 찾을 수 없습니다.",
                "error": str(e)
            }
        )
