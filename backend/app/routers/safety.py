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
from app.models.safety_check_status import SafetyCheckStatusSaveRequest
from app.services.equipment_safety import get_safety_dashboard, save_check_status, get_pre_work_checklist

router = APIRouter()


def get_company_id_or_none(current_user: CurrentUser) -> str | None:
    """
    current_user.id로 company_id를 조회합니다. 회사가 없으면 None을 반환합니다.
    GET /safety/dashboard와 POST /safety/check-status 양쪽에서 공통으로 쓰는
    "company 먼저 조회해서 검증" 로직을 중복 없이 한 곳에 모았습니다.
    """
    db = get_db()
    result = (
        db.table("company")
        .select("company_id")
        .eq("user_id", current_user.id)
        .single()
        .execute()
    )
    return result.data["company_id"] if result.data else None


@router.get("/safety/dashboard")
async def read_safety_dashboard(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    로그인한 사용자가 소유한 회사의 안전점검 대시보드를 반환합니다.

    onboarding.py의 get_my_company()와 동일하게, current_user.id로
    company를 먼저 조회해서 company_id를 직접 받지 않습니다
    (다른 회사 데이터 조회를 막기 위함).

    v1 설계 원칙: 안전점수(도넛 그래프) 같은 합성 점수는 만들지 않고,
    모든 수치를 사실 그대로의 개수로만 노출합니다.

    화면 매핑:
    - 상단 5개 카드(법정점검 기한초과/기한초과/기한임박/점검기록없음/완료)
      -> data.items[].summary_counts (회사 전체 합계는 data.summary)
    - 설비명/카테고리/사용연수/점검 항목 개수 -> data.items[].equipment_name,
      equipment_category, age_years, total_rule_count
    - 분류별 점검 기록 현황(막대그래프, 안전장치점검/유지보수점검/안전교육)
      -> data.items[].purpose_breakdown
    - "지금 처리해야 할 항목"(우선순위 카드) -> data.items[].priority_items
    - 전체 점검 항목 목록("목록 보기") -> data.items[].all_items
    - 점검 일정 "달력 보기"(전체 설비 통합, 화면 최상단) -> data.company_calendar_view
    - 안전점검 미지원 설비("용접기" 등) -> data.unsupported_equipment_names
      (프론트에서 "지원 안 됨" 표시 + 클릭 시 안내 메시지 노출)
    """
    try:
        company_id = get_company_id_or_none(current_user)

        if company_id is None:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Company not found.",
                },
            )

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


@router.post("/safety/check-status")
async def create_or_update_check_status(
    body: SafetyCheckStatusSaveRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    화면 "점검 기록하기" 버튼 클릭 시 호출됩니다.
    (company_id, equipment_id, rule_id) 복합 유니크 제약 기준으로 upsert되므로,
    이미 기록이 있던 항목을 다시 점검해도 새 row가 쌓이지 않고 덮어써집니다.

    rule_type: "legal" 또는 "voluntary". 어느 테이블의 룰인지 명시해야 합니다.

    evidence_file_url: 사진 파일 자체가 아니라, 프론트에서 Supabase Storage에
    먼저 업로드한 뒤 받은 결과 URL을 전달받습니다. 이 라우터는 파일을 직접
    다루지 않습니다.

    응답의 status는 always pending/overdue 중 하나입니다 ("완료" 상태는
    DB에 저장하지 않고, 프론트 토스트 메시지로만 안내하는 정책 — 화면에는
    "점검 완료!" 토스트를 띄우고, 다음 GET /safety/dashboard 호출 시
    next_due_at 기준으로 갱신된 상태가 반영됩니다).
    """
    try:
        company_id = get_company_id_or_none(current_user)

        if company_id is None:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Company not found.",
                },
            )

        check_status = save_check_status(company_id, body, today=date.today())

        return {
            "success": True,
            "data": check_status.model_dump(mode="json"),
        }

    except ValueError as e:
        # fetch_rule_by_id에서 존재하지 않는 rule_id를 보낸 경우
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": str(e),
            },
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to save inspection record.",
                "error": str(e),
            },
        )


@router.get("/safety/pre-work-checklist")
async def read_pre_work_checklist(
    equipment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    선택한 설비의 오늘 작업 전 점검 체크리스트를 반환합니다.
    pre_work_check_required=True인 룰들만 필터링해서 내려줍니다.

    화면 매핑:
    - 체크 단위 제목 → items[].inspection_type
    - 세부 내용 설명 → items[].check_item
    - 오늘 체크 여부 → items[].checked_today
    - 전체/완료 건수 → total_count / checked_count
    """
    try:
        company_id = get_company_id_or_none(current_user)

        if company_id is None:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "Company not found.",
                },
            )

        checklist = get_pre_work_checklist(
            company_id=company_id,
            equipment_id=equipment_id,
            today=date.today(),
        )

        return {
            "success": True,
            "data": checklist.model_dump(mode="json"),
        }

    except ValueError as e:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "message": str(e),
            },
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Failed to load pre-work checklist.",
                "error": str(e),
            },
        )
