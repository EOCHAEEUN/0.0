from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.models.company import CompanyOnboarding, CompanyUpdate
from app.models.equipment import EquipmentInput

router = APIRouter()


@router.post("/onboarding")
async def register_company(
    body: CompanyOnboarding,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    company_payload = {
        "user_id": current_user.id,
        "company_name": body.company_name,
        "industry_name": body.industry_name,
        "industry_code": body.industry_code,
        "region": body.region,
        "business_registration_no": body.business_registration_no,
        "company_type": body.company_type,
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


@router.get("/onboarding/me")
async def get_my_company(
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    try:
        company_result = (
            db.table("company")
            .select("*")
            .eq("user_id", current_user.id)
            .execute()
        )

        company_id = company_result.data[0].get("company_id") if company_result.data else None

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

    except Exception as exc:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": "Company not found.",
                "error": str(exc),
            },
        )


@router.patch("/onboarding/company/{company_id}")
async def update_company(
    company_id: str,
    body: CompanyUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_db()

    update_payload = body.model_dump(exclude_none=True)
    update_payload.pop("user_id", None)

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
            .eq("user_id", current_user.id)
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
async def register_equipment(
    company_id: str,
    body: EquipmentInput,
    current_user: CurrentUser = Depends(get_current_user),
):
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
