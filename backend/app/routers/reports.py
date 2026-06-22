from urllib.parse import quote
<<<<<<< HEAD
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
=======
from fastapi import APIRouter, Depends, HTTPException
>>>>>>> c403473 (feat: 파일 백시키면서 예전파일이던 보고서생성 최신화)
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.ownership import require_owned_context
from app.core.rate_limit import enforce_rate_limit
from app.models.auth import CurrentUser
from app.models.validated_types import PolicyIdText, UuidText
from app.services.application_report import (
    build_application_report_pdf,
    load_application_report_data,
    report_file_name,
)


router = APIRouter()


class ApplicationReportRequest(BaseModel):
    company_id: UuidText
    equipment_id: UuidText
    policy_id: PolicyIdText | None = None
    tone: Literal["submission", "analyst", "nominal"] = "submission"



@router.post("/reports/application.pdf")
async def generate_application_report(
    body: ApplicationReportRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
):
    enforce_rate_limit(
        request,
        scope="application-report",
        limit=settings.expensive_api_requests_per_minute,
        identifier=current_user.id,
    )
    require_owned_context(
        company_id=body.company_id,
        equipment_id=body.equipment_id,
        current_user=current_user,
    )
    try:
        data = load_application_report_data(
            body.company_id,
            body.equipment_id,
            body.policy_id,
            user_id=current_user.id,
            tone="submission",
        )
        pdf = build_application_report_pdf(data)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="신청서 PDF를 생성하지 못했습니다.",
        ) from exc

    file_name = report_file_name(data)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                'attachment; filename="factofit_application_report.pdf"; '
                f"filename*=UTF-8''{quote(file_name)}"
            ),
        },
    )
