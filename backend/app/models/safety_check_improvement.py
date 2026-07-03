"""
Safety Check Improvement 모델
- ORM: SQLAlchemy (Supabase 테이블 매핑)
- Schema: Pydantic (API 요청/응답)
"""

from datetime import datetime
from uuid import UUID
from enum import Enum

from sqlalchemy import Column, String, Text, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import BaseModel

from app.core.database import Base


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
# SQLAlchemy ORM 모델
# ============================================================================

class SafetyCheckImprovement(Base):
    """
    신청서용 안전점검 표 데이터
    
    2단계 프로세스:
    1️⃣ [설비관리 탭] - 근거 등록
       - 근거 유형 선택 (inspection_purpose)
       - 근거 제목 입력 (current_safety_measures)
       - 파일 업로드 (pdf_file_url)
       
    2️⃣ [신청서 탭] - 개선대책 입력
       - improvement_plan 사용자 입력
    """
    
    __tablename__ = "safety_check_improvement"
    
    # 기본 정보
    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default="gen_random_uuid()"
    )
    
    # 신청서 & 설비 정보
    chat_id = Column(
        String(255),
        nullable=False,
        index=True,
        comment="신청서 ID"
    )
    equipment_id = Column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="설비 ID"
    )
    equipment_name = Column(
        String(255),
        nullable=True,
        comment="설비명"
    )
    
    # 점검 종류
    inspection_purpose = Column(
        String(50),
        nullable=False,
        index=True,
        comment="safety_device, maintenance, safety_training"
    )
    inspection_purpose_label = Column(
        String(100),
        nullable=True,
        comment="한글: 안전장치점검, 유지보수점검, 안전교육"
    )
    
    # 규칙 & 점검 항목 (safety_rule_legal에서)
    inspection_rule_id = Column(
        String(255),
        nullable=True,
        comment="safety_rule_legal의 rule_id"
    )
    check_item = Column(
        String(500),
        nullable=True,
        comment="점검항목 (safety_rule_legal에서)"
    )
    check_content = Column(
        String(1000),
        nullable=True,
        comment="점검내용 (safety_rule_legal에서)"
    )
    
    # 1단계: 설비관리 탭 (근거 등록)
    inspection_pdf_file = Column(
        String(500),
        nullable=True,
        comment="PDF 파일명"
    )
    pdf_file_url = Column(
        Text,
        nullable=True,
        comment="Supabase Storage URL"
    )
    current_safety_measures = Column(
        Text,
        nullable=True,
        comment="근거 제목 (사용자 입력)"
    )
    pdf_uploaded_at = Column(
        DateTime,
        nullable=True,
        comment="PDF 업로드 시간"
    )
    
    # 2단계: 신청서 탭 (개선대책)
    improvement_plan = Column(
        Text,
        nullable=True,
        comment="개선대책 (사용자 입력)"
    )
    improvement_saved_at = Column(
        DateTime,
        nullable=True,
        comment="개선대책 저장 시간"
    )
    
    # 메타데이터
    status = Column(
        String(50),
        default=InspectionStatusEnum.PENDING.value,
        nullable=False,
        comment="pending, saved"
    )
    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # 제약 조건
    __table_args__ = (
        Index(
            'idx_safety_check_improvement_chat_inspection',
            'chat_id', 'inspection_purpose'
        ),
        UniqueConstraint(
            'chat_id', 'inspection_purpose', 'inspection_rule_id',
            name='uq_safety_check_improvement_unique'
        ),
    )


# ============================================================================
# Pydantic 스키마 (API용)
# ============================================================================

class SafetyCheckImprovementBase(BaseModel):
    """기본 필드"""
    equipment_id: UUID | None = None
    equipment_name: str | None = None
    inspection_purpose: str  # safety_device, maintenance, safety_training
    inspection_purpose_label: str | None = None
    inspection_rule_id: str | None = None
    check_item: str | None = None
    check_content: str | None = None


class SafetyCheckImprovementCreate(SafetyCheckImprovementBase):
    """
    [설비관리 탭] - 근거 등록 시 POST 요청
    """
    chat_id: str
    inspection_pdf_file: str  # 파일명
    pdf_file_url: str         # Supabase URL
    current_safety_measures: str  # 근거 제목 (사용자 입력) ← 핵심!


class SafetyCheckImprovementUpdate(BaseModel):
    """
    [신청서 탭] - 개선대책 입력 시 PUT 요청
    """
    improvement_plan: str  # 개선대책 (사용자 입력)


class SafetyCheckImprovementResponse(SafetyCheckImprovementBase):
    """
    GET 응답 스키마
    """
    id: UUID
    chat_id: str
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
        from_attributes = True  # ORM 모델 자동 변환


class SafetyCheckImprovementListResponse(BaseModel):
    """
    신청서 탭에서 테이블 렌더링용 응답
    (chat_id의 모든 점검항목)
    """
    items: list[SafetyCheckImprovementResponse]
    total_count: int
    
    class Config:
        from_attributes = True
