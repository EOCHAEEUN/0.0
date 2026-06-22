"""Supabase safety_check_status 테이블 모델."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.safety_common import (
    InspectionCompletionStatus,
    SafetyRuleType,
)


class SafetyCheckStatus(BaseModel):
    """회사가 법정·자율 점검 항목을 실제로 수행하는지 추적하는 상태."""

    id: UUID
    company_id: UUID
    equipment_id: UUID | None = None
    rule_type: SafetyRuleType
    rule_id: str
    is_conducting: bool | None = None
    last_checked_at: date | None = None
    next_due_at: date | None = None
    status: InspectionCompletionStatus | None = None
    evidence_file_url: str | None = None
    evidence_submitted_at: datetime | None = None
    assignee: str | None = None
    memo: str | None = None
    checked_at: datetime
    updated_at: datetime


class SafetyCheckStatusSaveRequest(BaseModel):
    """사용자가 점검 수행 여부와 최근 점검 정보를 저장할 때 받는 요청."""

    equipment_id: UUID | None = None
    rule_type: SafetyRuleType
    rule_id: str
    is_conducting: bool | None = None
    last_checked_at: date | None = None
    evidence_file_url: str | None = None
    assignee: str | None = None
    memo: str | None = None
