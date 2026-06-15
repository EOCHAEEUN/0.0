from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.models.company import CompanyOnboarding, CompanyUpdate
from app.models.equipment import EquipmentInput
from app.models.user import UserProfileCreate


router = APIRouter()


@router.post("/onboarding/user")
async def register_user_profile(body: UserProfileCreate):
    db = get_db()

    profile_payload = {
        "user_id": str(body.user_id),
        "name": body.name,
        "phone": body.phone,
    }

    try:
        result = db.table("user_profile").upsert(profile_payload).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "user_profile save returned no data.",
                },
            )

        profile = result.data[0]

        return {
            "success": True,
            "data": {
                "user_id": profile.get("user_id"),
                "user_profile": profile,
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save user_profile.",
                "error": str(e),
            },
        )


@router.post("/onboarding")
async def register_company(body: CompanyOnboarding):
    db = get_db()

    company_payload = {
        "user_id": str(body.user_id) if body.user_id else None,
        "company_name": body.company_name,
        "industry_name": body.industry_name,
        "industry_code": body.industry_code,
        "region": body.region,
        "business_registration_no": body.business_registration_no,
        "company_type": body.company_type,
        "company_size": body.company_size,
        "primary_purpose": body.primary_purpose,
        "employee_count": body.employee_count,
        "annual_revenue": body.annual_revenue,
        "revenue_2y_ago_manwon": body.revenue_2y_ago_manwon,
        "revenue_3y_ago_manwon": body.revenue_3y_ago_manwon,
        "total_assets_manwon": body.total_assets_manwon,
        "is_disclosure_group_member": body.is_disclosure_group_member,
        "independence_check_passed": body.independence_check_passed,
        "energy_cost_annual": body.energy_cost_annual,
        "established_year": body.established_year,
        "workplace_type": body.workplace_type,
    }

    try:
        result = db.table("company").insert(company_payload).execute()

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "company save returned no data.",
                },
            )

        company = result.data[0]

        return {
            "success": True,
            "data": {
                "company_id": company.get("company_id"),
                "company": company,
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save onboarding company data.",
                "error": str(e),
            },
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
                "equipments": equipment_result.data,
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Company not found.",
                "error": str(e),
            },
        )


@router.patch("/onboarding/company/{company_id}")
async def update_company(company_id: str, body: CompanyUpdate):
    db = get_db()

    update_payload = body.model_dump(exclude_none=True)
    if "user_id" in update_payload:
        update_payload["user_id"] = str(update_payload["user_id"])

    if not update_payload:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "No company fields to update.",
            },
        )

    try:
        result = (
            db.table("company")
            .update(update_payload)
            .eq("company_id", company_id)
            .execute()
        )

        if not result.data:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "company update returned no data.",
                },
            )

        return {
            "success": True,
            "data": {
                "company_id": company_id,
                "company": result.data[0],
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to update company.",
                "error": str(e),
            },
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
                    "message": "equipment save returned no data.",
                },
            )

        equipment = result.data[0]

        return {
            "success": True,
            "data": {
                "equipment_id": equipment.get("equipment_id"),
                "equipment": equipment,
            },
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save equipment.",
                "error": str(e),
            },
        )
