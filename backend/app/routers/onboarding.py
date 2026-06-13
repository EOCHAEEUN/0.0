from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.models.company import CompanyOnboarding
from app.core.database import get_db

router = APIRouter()


@router.post("/onboarding")
async def register_company(body: CompanyOnboarding):
    db = get_db()

    company_payload = {
        "company_name": body.company_name,
        "industry_code": body.industry_code,
        "company_type": body.company_type,
        "employee_count": body.employee_count,
        "region": body.region,
        "annual_revenue": body.annual_revenue,
        "energy_cost_annual": body.energy_cost_annual,
    }

    try:
        # 1. company 저장
        company_result = db.table("company").insert(company_payload).execute()

        if not company_result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "company 저장 결과가 비어 있습니다.",
                    "error": "company_result.data is empty"
                }
            )

        company = company_result.data[0]
        company_id = company.get("company_id")

        # 2. equipment 저장
        equipment_payload = {
            "company_id": company_id,
            "name": body.equipment.name,
            "category": body.equipment.category,
            "age_years": body.equipment.age_years,
            "energy_cost_annual": body.equipment.energy_cost_annual,
            "defect_rate": body.equipment.defect_rate,
            "capacity_value": body.equipment.capacity_value,
            "new_energy_cost_annual": body.equipment.new_energy_cost_annual,
            "new_investment_manwon": body.equipment.new_investment_manwon,
            "maintenance_cost_annual": body.equipment.maintenance_cost_annual,
            "production_qty": body.equipment.production_qty,
            "contribution_margin_won": body.equipment.contribution_margin_won,
        }

        equipment_result = db.table("equipment").insert(equipment_payload).execute()

        if not equipment_result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "equipment 저장 결과가 비어 있습니다.",
                    "error": "equipment_result.data is empty"
                }
            )

        equipment = equipment_result.data[0]
        equipment_id = equipment.get("equipment_id")

        # 3. company_id + equipment_id 같이 반환
        return {
            "success": True,
            "data": {
                "company_id": company_id,
                "equipment_id": equipment_id,
                "company": company,
                "equipment": equipment
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
        company_result = (
            db.table("company")
            .select("*")
            .eq("company_id", company_id)
            .single()
            .execute()
        )

        equipment_result = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .execute()
        )

        return {
            "success": True,
            "data": {
                "company": company_result.data,
                "equipments": equipment_result.data
            }
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
