from fastapi import APIRouter, HTTPException
from app.models.roi_input import RoiInput
from app.tools.roi_calc import calculate_roi

router = APIRouter()

@router.post("/roi/simulate")
async def simulate_roi(body: RoiInput):
    """ROI 시뮬레이션 REST 엔드포인트"""
    try:
        return {
            "success": True,
            "data": calculate_roi(body)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))