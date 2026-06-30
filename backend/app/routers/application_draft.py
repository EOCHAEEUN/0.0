from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.application_draft_workspace import load_application_draft_workspace


router = APIRouter()


@router.get("/application-draft/workspace")
async def get_application_draft_workspace(
    company_id: str = Query(...),
    analysis_id: str | None = Query(default=None),
    policy_id: str | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        payload = load_application_draft_workspace(
            company_id=company_id,
            analysis_id=analysis_id,
            policy_id=policy_id,
            user_id=current_user.id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="신청서 초안 화면 데이터를 불러오지 못했습니다.",
        ) from exc

    if payload.get("state") == "analysis_required":
        return JSONResponse(status_code=400, content=payload)

    return {"success": True, "data": payload}
