"""
Safety Check Improvement 라우터
- Supabase 클라이언트 방식
- chat_id 제거, equipment_id + company_id 기준
- FastAPI 엔드포인트 정의
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.core.database import get_db
from app.models.safety_check_improvement import (
    SafetyCheckImprovementCreate,
    SafetyCheckImprovementUpdate,
    SafetyCheckImprovementResponse,
    SafetyCheckImprovementListResponse,
)
from app.services.safety_check_improvement_service import SafetyCheckImprovementService

# 라우터 정의
router = APIRouter(
    tags=["safety-check-improvement"],
)


# ============================================================================
# [설비관리 탭] 1단계 - 근거 등록
# ============================================================================

@router.post("/create", response_model=SafetyCheckImprovementResponse)
async def create_safety_check(
    request: SafetyCheckImprovementCreate,
    supabase: Client = Depends(get_db),
):
    """
    [설비관리 탭] - 근거 등록
    
    Args:
        request: SafetyCheckImprovementCreate
        - company_id: 회사 ID (필수)
        - equipment_id: 설비 ID (필수)
        - inspection_purpose: 점검 목적
        - current_safety_measures: 현재 상태
        - inspection_pdf_file: PDF 파일명
        - pdf_file_url: Supabase URL
    """
    
    # 중복 체크
    if SafetyCheckImprovementService.check_exists(
        supabase,
        request.company_id,
        request.equipment_id,
        request.inspection_purpose,
        request.inspection_rule_id or "",
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 항목입니다.",
        )
    
    item = SafetyCheckImprovementService.create(
        supabase=supabase,
        company_id=request.company_id,
        user_id=request.user_id if hasattr(request, 'user_id') else UUID('00000000-0000-0000-0000-000000000000'),
        equipment_id=request.equipment_id,
        equipment_name=request.equipment_name,
        inspection_purpose=request.inspection_purpose,
        inspection_purpose_label=request.inspection_purpose_label,
        inspection_rule_id=request.inspection_rule_id,
        check_item=request.check_item,
        check_content=request.check_content,
        inspection_pdf_file=request.inspection_pdf_file,
        pdf_file_url=request.pdf_file_url,
        current_safety_measures=request.current_safety_measures,
    )
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="데이터 저장 실패",
        )
    
    return SafetyCheckImprovementResponse(**item)


# ============================================================================
# [신청서 탭] 2단계 - 데이터 조회
# ============================================================================

@router.get("/{company_id}/{equipment_id}", response_model=SafetyCheckImprovementListResponse)
async def get_all_by_company_and_equipment(
    company_id: UUID,
    equipment_id: UUID,
    supabase: Client = Depends(get_db),
):
    """
    [신청서 탭] - company_id와 equipment_id의 모든 점검항목 조회
    
    Args:
        company_id: 회사 ID
        equipment_id: 설비 ID
    
    Returns:
        점검항목 목록
    """
    
    items = SafetyCheckImprovementService.get_by_company_and_equipment(
        supabase, company_id, equipment_id
    )
    
    return SafetyCheckImprovementListResponse(
        items=[SafetyCheckImprovementResponse(**item) for item in items],
        total_count=len(items),
    )


@router.get("/{company_id}/{equipment_id}/{inspection_purpose}", response_model=list[SafetyCheckImprovementResponse])
async def get_by_company_equipment_and_purpose(
    company_id: UUID,
    equipment_id: UUID,
    inspection_purpose: str,
    supabase: Client = Depends(get_db),
):
    """
    [신청서 탭] - 특정 점검목적의 항목만 조회
    
    Args:
        company_id: 회사 ID
        equipment_id: 설비 ID
        inspection_purpose: safety_device, maintenance, safety_training
    
    Returns:
        해당 점검목적의 항목 목록
    """
    
    # 유효한 inspection_purpose 검증
    valid_purposes = ["safety_device", "maintenance", "safety_training"]
    if inspection_purpose not in valid_purposes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid inspection_purpose. Must be one of {valid_purposes}",
        )
    
    items = SafetyCheckImprovementService.get_by_company_equipment_and_purpose(
        supabase, company_id, equipment_id, inspection_purpose
    )
    
    return [SafetyCheckImprovementResponse(**item) for item in items]


# ============================================================================
# [신청서 탭] 2단계 - 향후 관리 계획 저장
# ============================================================================

@router.patch("/{item_id}/improvement", response_model=SafetyCheckImprovementResponse)
async def update_improvement(
    item_id: UUID,
    request: SafetyCheckImprovementUpdate,
    supabase: Client = Depends(get_db),
):
    """
    [신청서 탭] - 향후 관리 계획 저장/수정
    
    Args:
        item_id: 항목 ID
        request: SafetyCheckImprovementUpdate
        - improvement_plan: 향후 관리 계획
    
    Returns:
        업데이트된 항목 정보
    """
    
    item = SafetyCheckImprovementService.update_improvement(
        supabase=supabase,
        item_id=item_id,
        improvement_plan=request.improvement_plan,
    )
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="업데이트 실패",
        )
    
    return SafetyCheckImprovementResponse(**item)


# ============================================================================
# 삭제 및 기타 작업
# ============================================================================

@router.delete("/{item_id}")
async def delete_safety_check(
    item_id: UUID,
    supabase: Client = Depends(get_db),
):
    """
    항목 삭제
    
    Args:
        item_id: 항목 ID
    
    Returns:
        삭제 성공 여부
    """
    
    if not SafetyCheckImprovementService.delete(supabase, item_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    
    return {
        "success": True,
        "message": "Deleted successfully",
    }


@router.delete("/{company_id}/{equipment_id}")
async def delete_by_company_and_equipment(
    company_id: UUID,
    equipment_id: UUID,
    supabase: Client = Depends(get_db),
):
    """
    특정 company_id와 equipment_id의 모든 항목 삭제
    
    Args:
        company_id: 회사 ID
        equipment_id: 설비 ID
    
    Returns:
        삭제된 항목 개수
    """
    
    count = SafetyCheckImprovementService.delete_by_company_and_equipment(
        supabase, company_id, equipment_id
    )
    
    return {
        "success": True,
        "deleted_count": count,
        "message": f"{count}개 항목이 삭제되었습니다.",
    }


@router.get("/{company_id}/{equipment_id}/count")
async def count_by_company_and_equipment(
    company_id: UUID,
    equipment_id: UUID,
    supabase: Client = Depends(get_db),
):
    """
    company_id와 equipment_id의 항목 개수 조회
    
    Args:
        company_id: 회사 ID
        equipment_id: 설비 ID
    
    Returns:
        항목 개수
    """
    
    count = SafetyCheckImprovementService.count_by_company_and_equipment(
        supabase, company_id, equipment_id
    )
    
    return {
        "company_id": str(company_id),
        "equipment_id": str(equipment_id),
        "total_count": count,
    }
