from fastapi import APIRouter
from app.models.roi_input import RoiInput
from app.tools.roi_calc import calculate_roi

router = APIRouter()

@router.post("/roi/simulate")
async def simulate_roi(body: RoiInput):
    """ROI 시뮬레이션 REST 엔드포인트"""
    return {
        "success": True,
        "data": calculate_roi(body)
    }
