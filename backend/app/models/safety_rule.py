from datetime import datetime
from typing import Literal

from pydantic import BaseModel


BasisType = Literal["law", "official_guide", "manual", "self_check"]
RiskLevel = Literal["low", "medium", "high", "critical"]


class SafetyRule(BaseModel):
    rule_id: str
    equipment_category: str
    equipment_name_keywords: list[str] = []
    inspection_type: str
    check_item: str
    cycle_months: int
    risk_level: RiskLevel
    legal_basis: str | None = None
    source_url: str | None = None
    note: str | None = None
    basis_type: BasisType
    legal_article: str | None = None
    source_name: str | None = None
    evidence_text: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
