import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.support_projects_overview import load_support_projects_overview

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/support-projects/overview")
async def get_support_projects_overview(
    company_id: str = Query(...),
    analysis_id: str | None = Query(default=None),
    equipment_id: str | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        data = load_support_projects_overview(
            company_id=company_id,
            user_id=current_user.id,
            analysis_id=analysis_id,
            equipment_id=equipment_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception(
            "support projects overview failed company_id=%s analysis_id=%s user_id=%s",
            company_id,
            analysis_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=500,
            detail="지원사업 정보를 불러오지 못했습니다.",
        ) from exc

    return {"success": True, "data": data}
