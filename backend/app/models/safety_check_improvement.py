"""
Safety Check Improvement 모델
- ORM 제거 (Supabase 클라이언트 방식)
- Pydantic 스키마만 유지
- chat_id 제거, equipment_id + company_id 기준
"""

from datetime import datetime
from uuid import UUID
from enum import Enum

from pydantic import BaseModel


# ============================================================================
# Enum 클래스
# ============================================================================

class InspectionPurposeEnum(str, Enum):
    """점검 목적 분류"""
    SAFETY_DEVICE = "safety_device"        # 안전장치점검
    MAINTENANCE = "maintenance"             # 유지보수점검
    SAFETY_TRAINING = "safety_training"     # 안전교육


class InspectionStatusEnum(str, Enum):
    """점검 상태"""
    PENDING = "pending"                     # 대기 중
    SAVED = "saved"                         # 저장 완료


# ============================================================================
# Pydantic 스키마 (API용)
# ============================================================================

class SafetyCheckImprovementCreate(BaseModel):
    """
    [설비관리 탭] - 근거 등록 시 POST 요청
    """
    company_id: UUID
    equipment_id: UUID
    inspection_purpose: str  # safety_device, maintenance, safety_training
    inspection_purpose_label: str | None = None
    inspection_rule_id: str | None = None
    check_item: str | None = None
    check_content: str | None = None
    inspection_pdf_file: str  # 파일명
    pdf_file_url: str         # Supabase URL
    current_safety_measures: str  # 현재 상태 (사용자 입력) ← 핵심!


class SafetyCheckImprovementUpdate(BaseModel):
    """
    [신청서 탭] - 향후 관리 계획 입력 시 PATCH 요청
    """
    improvement_plan: str  # 향후 관리 계획 (사용자 입력)


class SafetyCheckImprovementResponse(BaseModel):
    """
    GET 응답 스키마
    """
    id: UUID
    company_id: UUID
    user_id: UUID
    equipment_id: UUID
    equipment_name: str | None = None
    inspection_purpose: str
    inspection_purpose_label: str | None = None
    inspection_rule_id: str | None = None
    check_item: str | None = None
    check_content: str | None = None
    inspection_pdf_file: str | None = None
    pdf_file_url: str | None = None
    current_safety_measures: str | None = None
    pdf_uploaded_at: datetime | None = None
    improvement_plan: str | None = None
    improvement_saved_at: datetime | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True  # Supabase dict → Pydantic 변환


class SafetyCheckImprovementListResponse(BaseModel):
    """
    신청서 탭에서 테이블 렌더링용 응답
    (company_id + equipment_id의 모든 점검항목)
    """
    items: list[SafetyCheckImprovementResponse]
    total_count: int
    
    class Config:
        from_attributes = True
