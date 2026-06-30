from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.application_report import (
    REPORT_TYPE_APPLICATION_EVIDENCE,
    REPORT_TYPE_CONSUMER_SUMMARY,
    generate_application_report_pdf,
    load_application_report_data,
    report_file_name,
)


router = APIRouter()

SNAPSHOT_EMPTY_MESSAGE = "이 분석에는 저장된 정책 스냅샷이 없습니다. 해당 시점 정책을 조회할 수 없습니다."
SNAPSHOT_POLICY_NOT_FOUND_MESSAGE = (
    "이 분석의 저장된 정책 스냅샷에서 요청한 정책을 찾을 수 없습니다."
)
ANALYSIS_NOT_FOUND_MESSAGE = "분석 결과를 찾을 수 없습니다."


class ApplicationReportRequest(BaseModel):
    company_id: str
    equipment_id: str
    policy_id: str | None = None
    analysis_id: str | None = None
    draft_result_id: str | None = None
    report_type: Literal["consumer_summary", "application_evidence"] = (
        REPORT_TYPE_APPLICATION_EVIDENCE
    )
    tone: Literal["submission", "analyst", "nominal"] = "submission"


async def _generate_application_report_response(
    body: ApplicationReportRequest,
    current_user: CurrentUser,
    report_type: Literal["consumer_summary", "application_evidence"] | None = None,
):
    selected_report_type = report_type or body.report_type
    try:
        data = load_application_report_data(
            body.company_id,
            body.equipment_id,
            body.policy_id,
            analysis_id=body.analysis_id,
            user_id=current_user.id,
            tone=body.tone,
        )
        pdf = generate_application_report_pdf(
            report_type=selected_report_type,
            analysis_id=body.analysis_id,
            draft_result_id=body.draft_result_id,
            company_id=body.company_id,
            equipment_id=body.equipment_id,
            policy_id=body.policy_id,
            user_id=current_user.id,
            tone=body.tone,
        )
    except ValueError as exc:
        message = str(exc)
        if body.analysis_id:
            if "저장된 정책 정보 없음" in message:
                return JSONResponse(
                    status_code=409,
                    content={
                        "success": False,
                        "message": SNAPSHOT_EMPTY_MESSAGE,
                        "error_code": "POLICY_SNAPSHOT_MISSING",
                    },
                )
            if "저장된 정책 정보에서 요청한 정책을 찾을 수 없습니다." in message:
                return JSONResponse(
                    status_code=409,
                    content={
                        "success": False,
                        "message": SNAPSHOT_POLICY_NOT_FOUND_MESSAGE,
                        "error_code": "POLICY_SNAPSHOT_POLICY_NOT_FOUND",
                    },
                )
            if "분석 이력을 찾을 수 없습니다." in message:
                return JSONResponse(
                    status_code=404,
                    content={
                        "success": False,
                        "message": ANALYSIS_NOT_FOUND_MESSAGE,
                    },
                )
        raise HTTPException(status_code=404, detail=message) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate application PDF.",
        ) from exc

    file_name = report_file_name(data, selected_report_type)
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


@router.post("/reports/application.pdf")
async def generate_application_report(
    body: ApplicationReportRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await _generate_application_report_response(body, current_user)


@router.post("/reports/consumer-summary.pdf")
async def generate_consumer_summary_report(
    body: ApplicationReportRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await _generate_application_report_response(
        body,
        current_user,
        REPORT_TYPE_CONSUMER_SUMMARY,
    )


@router.post("/reports/application-evidence.pdf")
async def generate_application_evidence_report(
    body: ApplicationReportRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await _generate_application_report_response(
        body,
        current_user,
        REPORT_TYPE_APPLICATION_EVIDENCE,
    )
