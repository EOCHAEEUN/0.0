from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.models.equipment import EquipmentCreateRequest

router = APIRouter()


@router.post("/equipment")
async def create_equipment(body: EquipmentCreateRequest):
    db = get_db()

    payload = {
        "company_id": str(body.company_id),
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
        result = db.table("equipment").insert(payload).execute()

        equipment = result.data[0] if result.data else payload

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
                "message": "설비 정보를 Supabase에 저장하지 못했습니다.",
                "error": str(e)
            }
        )


@router.get("/equipment")
async def get_equipment(company_id: str):
    db = get_db()

    try:
        result = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .execute()
        )

        return {
            "success": True,
            "data": result.data
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "설비 정보를 조회하지 못했습니다.",
                "error": str(e)
            }
        )
