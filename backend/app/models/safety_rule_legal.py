"""Supabase safety_rule_legal 테이블 모델."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.safety_common import InspectionPurpose, RiskLevel


class SafetyRuleLegal(BaseModel):
    """법조항이 명시된 검사·점검·교육 및 안전조치 카탈로그."""

    rule_id: str
    equipment_category: str
    equipment_name_keywords: list[str] = Field(default_factory=list)
    inspection_type: str
    check_item: str
    cycle_months: int
    pre_work_check_required: bool = False
    pre_work_check_basis: str | None = None
    risk_level: RiskLevel
    inspection_purpose: InspectionPurpose | None = None
    legal_basis: str
    source_name: str | None = None
    evidence_text: str
    penalty_type: str | None = None
    penalty_amount_note: str | None = None
    penalty_basis: str | None = None
    created_at: datetime | None = None
