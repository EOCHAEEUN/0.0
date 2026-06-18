"""
팩토핏 안전점검 라우터

이 파일은 services/equipment_safety.py의 get_safety_dashboard()를 호출해서
HTTP 응답으로 변환하는 역할만 합니다. 계산/조회 로직은 여기 두지 않습니다.

routers/onboarding.py와 동일한 컨벤션을 따릅니다.
- company_id는 쿼리 파라미터로 직접 받지 않고, 인증된 current_user 기준으로 조회/검증
- 응답은 {"success": bool, "data": {...}} 형태로 통일
- 에러는 JSONResponse(status_code=..., content={...})로 처리
"""

from __future__ import annotations
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.auth import CurrentUser
from app.services.equipment_safety import get_safety_dashboard

router = APIRouter()


@router.get("/safety/dashboard")
async def read_safety_dashboard(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    로그인한 사용자가 소유한 회사의 안전점검 대시보드를 반환합니다.

    onboarding.py의 get_my_company()와 동일하게, current_user.id로
    company를 먼저 조회해서 company_id를 직접 받지 않습니다
    (다른 회사 데이터 조회를 막기 위함).

    화면 매핑:
    - 좌측 큰 카드(안전점수 도넛) / 우측 "등록 설비 선택" 리스트 -> data.items
    - "정상 항목 / 주의 항목 / 위험 항목" 카운트 -> data.summary
    - 안전점검 미지원 설비("용접기" 등) -> data.unsupported_equipment_names
      (프론트에서 "지원 안 됨" 표시 + 클릭 시 안내 메시지 노출)
    """
    db = get_db()

    try:
        company_result = (
            db.table("company")
            .select("company_id")
            .eq("user_id", current_user.id)
            .single()
            .execute()
        )

        if not company_result.data:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Company not found.",
                },
            )

        company_id = company_result.data["company_id"]

        dashboard = get_safety_dashboard(company_id, today=date.today())

        return {
            "success": True,
            "data": dashboard.model_dump(mode="json"),
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to load safety dashboard.",
                "error": str(e),
            },
        )
