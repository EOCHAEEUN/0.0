from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.models.company import CompanyOnboarding
from app.core.database import get_db
from app.models.equipment import EquipmentInput
from app.models.user import UserCreate
router = APIRouter()

@router.post("/onboarding/user")
async def register_user(body: UserCreate):
    db = get_db()

    user_payload = {
        "user_id": body.user_id,
        "name": body.name,
        "phone": body.phone,
    }

    try:
        result = db.table("user").insert(user_payload).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "user 저장 결과가 비어 있습니다.",
                }
            )

        user = result.data[0]

        return {
            "success": True,
            "data": {
                "user_id": user.get("user_id"),
                "user": user
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "user 정보를 저장하지 못했습니다.",
                "error": str(e)
            }
        )
    
@router.post("/onboarding")
async def register_company(body: CompanyOnboarding):
    db = get_db()

    company_payload = {
        "user_id": body.user_id,
        "company_name": body.company_name,
        "industry_name": body.industry_name,
        "industry_code": body.industry_code,
        "region": body.region,
        "business_registration_no": body.business_registration_no,
        "company_size": body.company_size,
        "primary_purpose": body.primary_purpose,
        "employee_count": body.employee_count,
    }

    try:
        result = db.table("company").insert(company_payload).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "company 저장 결과가 비어 있습니다.",
                }
            )

        company = result.data[0]

        return {
            "success": True,
            "data": {
                "company_id": company.get("company_id"),
                "company": company
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "온보딩 정보를 저장하지 못했습니다.",
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

@router.patch("/onboarding/company/{company_id}")
async def update_company(company_id: str, body: CompanyOnboarding):
    db = get_db()

    # None이 아닌 값만 업데이트
    update_payload = {}
    
    if body.company_name: update_payload["company_name"] = body.company_name
    if body.industry_name: update_payload["industry_name"] = body.industry_name
    if body.industry_code: update_payload["industry_code"] = body.industry_code
    if body.region: update_payload["region"] = body.region
    if body.business_registration_no: update_payload["business_registration_no"] = body.business_registration_no
    if body.company_type: update_payload["company_type"] = body.company_type
    if body.company_size: update_payload["company_size"] = body.company_size
    if body.primary_purpose: update_payload["primary_purpose"] = body.primary_purpose
    if body.employee_count: update_payload["employee_count"] = body.employee_count
    if body.annual_revenue: update_payload["annual_revenue"] = body.annual_revenue
    if body.avg_revenue_3y_manwon: update_payload["avg_revenue_3y_manwon"] = body.avg_revenue_3y_manwon
    if body.total_assets_manwon: update_payload["total_assets_manwon"] = body.total_assets_manwon
    if body.is_disclosure_group_member is not None: update_payload["is_disclosure_group_member"] = body.is_disclosure_group_member
    if body.independence_check_passed is not None: update_payload["independence_check_passed"] = body.independence_check_passed
    if body.energy_cost_annual: update_payload["energy_cost_annual"] = body.energy_cost_annual

    try:
        result = db.table("company").update(update_payload).eq("company_id", company_id).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "company 업데이트 결과가 비어 있습니다.",
                }
            )

        return {
            "success": True,
            "data": {
                "company_id": company_id,
                "company": result.data[0]
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "company 업데이트에 실패했습니다.",
                "error": str(e)
            }
        )
    
@router.post("/onboarding/{company_id}/equipment")
async def register_equipment(company_id: str, body: EquipmentInput):
    db = get_db()

    equipment_payload = {
        "company_id": company_id,
        "name": body.name,
        "category": body.category,
        "age_years": body.age_years,
        "energy_cost_annual": body.energy_cost_annual,
        "defect_rate": body.defect_rate,
        "maintenance_cost_annual": body.maintenance_cost_annual,
        "current_capacity_value": body.current_capacity_value,
        "production_qty": body.production_qty,
        "contribution_margin_won": body.contribution_margin_won,
        "new_energy_cost_annual": body.new_energy_cost_annual,
        "new_investment_manwon": body.new_investment_manwon,
        "scenario_a_investment_manwon": body.scenario_a_investment_manwon,
        "scenario_b_investment_manwon": body.scenario_b_investment_manwon,
    }

    try:
        result = db.table("equipment").insert(equipment_payload).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "equipment 저장 결과가 비어 있습니다.",
                }
            )

        equipment = result.data[0]

        return {
            "success": True,
            "data": {
                "equipment_id": equipment.get("equipment_id"),
                "equipment": equipment
            }
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "설비 정보를 저장하지 못했습니다.",
                "error": str(e)
            }
        )
