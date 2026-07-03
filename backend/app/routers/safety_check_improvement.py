"""
Safety Check Improvement 라우터
- FastAPI 엔드포인트 정의
- 요청 검증 및 응답 반환
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
    db: Session = Depends(get_db),
):
    """
    [설비관리 탭] - 근거 등록
    
    근거 유형을 선택하고 파일을 업로드하면:
    - inspection_purpose: 근거 유형 (safety_device, maintenance, safety_training)
    - current_safety_measures: 근거 제목 (사용자 입력)
    - pdf_file_url: Supabase Storage URL
    
    Args:
        request: SafetyCheckImprovementCreate
        - chat_id: 신청서 ID
        - inspection_purpose: 점검 목적
        - current_safety_measures: 근거 제목
        - inspection_pdf_file: PDF 파일명
        - pdf_file_url: Supabase URL
    
    Returns:
        생성된 항목 정보
    """
    
    # 중복 체크 (선택사항)
    if SafetyCheckImprovementService.check_exists(
        db,
        request.chat_id,
        request.inspection_purpose,
        request.inspection_rule_id or "",
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 항목입니다.",
        )
    
    item = SafetyCheckImprovementService.create(
        db=db,
        chat_id=request.chat_id,
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
    
    return SafetyCheckImprovementResponse.from_orm(item)


# ============================================================================
# [신청서 탭] 2단계 - 데이터 조회
# ============================================================================

@router.get("/{chat_id}", response_model=SafetyCheckImprovementListResponse)
async def get_all_by_chat(
    chat_id: str,
    db: Session = Depends(get_db),
):
    """
    [신청서 탭] - chat_id의 모든 점검항목 조회
    
    신청서 탭에서 표를 렌더링할 때 모든 점검항목을 가져옴
    (안전장치점검, 유지보수점검, 안전교육)
    
    Args:
        chat_id: 신청서 ID
    
    Returns:
        점검항목 목록
    """
    
    items = SafetyCheckImprovementService.get_by_chat_id(db, chat_id)
    
    return SafetyCheckImprovementListResponse(
        items=[SafetyCheckImprovementResponse.from_orm(item) for item in items],
        total_count=len(items),
    )


@router.get("/{chat_id}/{inspection_purpose}", response_model=list[SafetyCheckImprovementResponse])
async def get_by_chat_and_purpose(
    chat_id: str,
    inspection_purpose: str,
    db: Session = Depends(get_db),
):
    """
    [신청서 탭] - 특정 점검목적의 항목만 조회
    
    예: /api/safety-check/chat_xxx/safety_device
    → 안전장치점검 항목들만 반환
    
    Args:
        chat_id: 신청서 ID
        inspection_purpose: safety_device, maintenance, safety_training
    
    Returns:
        해당 점검목적의 항목 목록
    """
    
    # 유효한 inspection_purpose 검증 (선택사항)
    valid_purposes = ["safety_device", "maintenance", "safety_training"]
    if inspection_purpose not in valid_purposes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid inspection_purpose. Must be one of {valid_purposes}",
        )
    
    items = SafetyCheckImprovementService.get_by_chat_and_purpose(
        db, chat_id, inspection_purpose
    )
    
    return [SafetyCheckImprovementResponse.from_orm(item) for item in items]


# ============================================================================
# [신청서 탭] 2단계 - 개선대책 저장
# ============================================================================

@router.patch("/{item_id}/improvement", response_model=SafetyCheckImprovementResponse)
async def update_improvement(
    item_id: UUID,
    request: SafetyCheckImprovementUpdate,
    db: Session = Depends(get_db),
):
    """
    [신청서 탭] - 개선대책 저장/수정
    
    사용자가 신청서 탭에서 개선대책을 입력하고 저장하거나 수정할 때 호출
    (처음 저장하든, 이미 있는 값을 수정하든 동일하게 작동)
    ...
    """
    
    try:
        item = SafetyCheckImprovementService.update_improvement(
            db=db,
            item_id=item_id,
            improvement_plan=request.improvement_plan,
        )
        return SafetyCheckImprovementResponse.from_orm(item)
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ============================================================================
# 삭제 및 기타 작업
# ============================================================================

@router.delete("/{item_id}")
async def delete_safety_check(
    item_id: UUID,
    db: Session = Depends(get_db),
):
    """
    항목 삭제
    
    Args:
        item_id: 항목 ID
    
    Returns:
        삭제 성공 여부
    """
    
    if not SafetyCheckImprovementService.delete(db, item_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    
    return {
        "success": True,
        "message": "Deleted successfully",
    }


@router.delete("/{chat_id}/{inspection_purpose}")
async def delete_by_chat_and_purpose(
    chat_id: str,
    inspection_purpose: str,
    db: Session = Depends(get_db),
):
    """
    특정 chat_id와 inspection_purpose의 모든 항목 삭제
    
    Args:
        chat_id: 신청서 ID
        inspection_purpose: 점검 목적
    
    Returns:
        삭제된 항목 개수
    """
    
    count = SafetyCheckImprovementService.delete_by_chat_and_purpose(
        db, chat_id, inspection_purpose
    )
    
    return {
        "success": True,
        "deleted_count": count,
        "message": f"{count}개 항목이 삭제되었습니다.",
    }


@router.get("/{chat_id}/count")
async def count_by_chat(
    chat_id: str,
    db: Session = Depends(get_db),
):
    """
    chat_id의 항목 개수 조회
    
    Args:
        chat_id: 신청서 ID
    
    Returns:
        항목 개수
    """
    
    count = SafetyCheckImprovementService.count_by_chat_id(db, chat_id)
    
    return {
        "chat_id": chat_id,
        "total_count": count,
    }
