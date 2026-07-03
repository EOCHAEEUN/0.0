import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.dashboard_overview import (
    load_dashboard_overview,
    set_representative_equipment,
)


router = APIRouter()
logger = logging.getLogger(__name__)


class RepresentativeEquipmentRequest(BaseModel):
    equipment_id: str | None = None


@router.get("/dashboard/overview")
async def get_dashboard_overview(
    company_id: str = Query(...),
    analysis_id: str | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        data = load_dashboard_overview(
            company_id=company_id,
            user_id=current_user.id,
            analysis_id=analysis_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception(
            "dashboard overview failed company_id=%s analysis_id=%s user_id=%s",
            company_id,
            analysis_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=500,
            detail="대시보드 정보를 불러오지 못했습니다.",
        ) from exc

    return {"success": True, "data": data}


@router.patch("/companies/{company_id}/representative-equipment")
async def patch_representative_equipment(
    company_id: str,
    body: RepresentativeEquipmentRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        data = set_representative_equipment(
            company_id=company_id,
            equipment_id=body.equipment_id,
            user_id=current_user.id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="대표 설비를 저장하지 못했습니다.",
        ) from exc

    return {"success": True, "data": data}
