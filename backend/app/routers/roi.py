from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.tools.roi_calc import RoiInput, calculate_roi

router = APIRouter()

VALID_CATEGORIES = {"press", "cnc", "injection"}


class RoiSimulateRequest(RoiInput):
    company_id: Optional[str] = None


@router.post("/roi/simulate")
async def simulate_roi(body: RoiSimulateRequest):
    if body.equipment.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"지원하지 않는 설비 카테고리입니다. ({', '.join(sorted(VALID_CATEGORIES))})",
                "code": "INVALID_CATEGORY",
            },
        )

    return calculate_roi(body)
