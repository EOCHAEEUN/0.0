"""Supabase safety_rule_voluntary 테이블 모델."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.safety_common import InspectionPurpose, RiskLevel


class SafetyRuleVoluntary(BaseModel):
    """회사가 자체적으로 운영 여부를 정하는 자율점검 프로그램 카탈로그."""

    rule_id: str
    program_type: str | None = None
    equipment_category: str | None = None
    equipment_name_keywords: list[str] = Field(default_factory=list)
    inspection_type: str
    check_item: str
    cycle_months: int | None = None
    risk_level: RiskLevel | None = None
    inspection_purpose: InspectionPurpose | None = None
    legal_basis: str | None = None
    source_name: str | None = None
    evidence_text: str | None = None
    evidence_required: bool = True
    evidence_note: str | None = None
    penalty_type: str | None = None
    penalty_amount_note: str | None = None
    penalty_basis: str | None = None
    created_at: datetime | None = None
