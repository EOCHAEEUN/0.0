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
    penalty_amount_note: dict | None = None
    penalty_basis: str | None = None
    legal_check_process_type: str | None = None
    legal_check_process_label: str | None = None
    legal_check_group: str | None = None
    legal_check_group_label: str | None = None
    legal_check_detail: str | None = None
    certificate_required: bool = False
    direct_report_required: bool = False
    record_keep_required: bool = True
    enforcement_type: str | None = None
    enforcement_label: str | None = None
    enforcement_trigger_type: str | None = None
    enforcement_trigger_type_label: str | None = None
    enforcement_trigger_label: str | None = None
    required_compliance_action: str | None = None
    proof_method: str | None = None
    submission_timing: str | None = None
    avoid_penalty_note: str | None = None
    process_reason: str | None = None
    created_at: datetime | None = None
