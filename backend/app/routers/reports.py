from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.application_report import (
    build_application_report_pdf,
    load_application_report_data,
    report_file_name,
)


router = APIRouter()


class ApplicationReportRequest(BaseModel):
    company_id: str
    equipment_id: str
    policy_id: str | None = None
    tone: Literal["submission", "analyst", "nominal"] = "submission"


@router.post("/reports/application.pdf")
async def generate_application_report(
    body: ApplicationReportRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        data = load_application_report_data(
            body.company_id,
            body.equipment_id,
            body.policy_id,
            user_id=current_user.id,
            tone=body.tone,
        )
        pdf = build_application_report_pdf(data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate application PDF.",
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
