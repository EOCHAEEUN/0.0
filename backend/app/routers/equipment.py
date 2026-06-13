from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.core.database import get_db

router = APIRouter()


class EquipmentCreateRequest(BaseModel):
    company_id: str
    name: str
    category: str
    age_years: int
    energy_cost_annual: int
    defect_rate: float
    current_capacity_value: int


@router.post("/equipment")
async def create_equipment(body: EquipmentCreateRequest):
    db = get_db()

    payload = {
        "company_id": body.company_id,
        "name": body.name,
        "category": body.category,
        "age_years": body.age_years,
        "energy_cost_annual": body.energy_cost_annual,
        "defect_rate": body.defect_rate,
        "current_capacity_value": body.current_capacity_value,
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