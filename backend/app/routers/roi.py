from fastapi import APIRouter, HTTPException
from app.models.equipment import EquipmentInput
from app.tools.roi_calc import calculate_roi

router = APIRouter()


@router.post("/roi/simulate")
async def simulate_roi(body: EquipmentInput):
    """ROI simulation REST endpoint."""
    try:
        return {
            "success": True,
            "data": calculate_roi(body),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
