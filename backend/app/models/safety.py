from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel


BasisType = Literal["law", "official_guide", "manual", "self_check"]
RiskLevel = Literal["low", "medium", "high", "critical"]
InspectionStatus = Literal["normal", "warning", "danger"]


class SafetyRule(BaseModel):
    rule_id: str
    equipment_category: str
    equipment_name_keywords: list[str] = []
    inspection_type: str
    check_item: str
    cycle_months: int
    risk_level: RiskLevel
    legal_basis: Optional[str] = None
    source_url: Optional[str] = None
    note: Optional[str] = None
    basis_type: BasisType
    legal_article: Optional[str] = None
    source_name: Optional[str] = None
    evidence_text: Optional[str] = None


class SafetyInspection(BaseModel):
    inspection_id: str
    company_id: str
    equipment_id: str
    rule_id: str
    last_checked_at: Optional[date] = None
    next_due_at: Optional[date] = None
    status: Optional[str] = None
    assignee: Optional[str] = None
    evidence_file_url: Optional[str] = None
    memo: Optional[str] = None


class SafetyRiskFactor(BaseModel):
    key: str
    label: str
    score: int
    status: InspectionStatus
    reason: str


class SafetyDashboardItem(BaseModel):
    equipment_id: str
    equipment_name: str
    equipment_category: str
    age_years: int
    safety_score: int
    status: InspectionStatus
    priority_rank: int
    priority_score: int
    replacement_reasons: list[str]
    risk_factors: list[SafetyRiskFactor]
    rules: list[SafetyRule]
    inspections: list[SafetyInspection]


class SafetyDashboardSummary(BaseModel):
    average_score: int
    normal_count: int
    warning_count: int
    danger_count: int
    total_rules: int
    overdue_count: int


class SafetyDashboardResponse(BaseModel):
    company_id: str
    summary: SafetyDashboardSummary
    items: list[SafetyDashboardItem]
