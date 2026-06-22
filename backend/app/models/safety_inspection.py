from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


SafetyInspectionStatus = Literal[
    "normal",
    "scheduled",
    "warning",
    "overdue",
    "done",
    "skipped",
]
InspectionStatus = Literal["normal", "warning", "danger"]


class SafetyInspection(BaseModel):
    inspection_id: str
    company_id: str
    equipment_id: str
    rule_id: str
    last_checked_at: date | None = None
    next_due_at: date | None = None
    status: SafetyInspectionStatus | None = None
    assignee: str | None = None
    evidence_file_url: str | None = None
    memo: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # Computed by the safety dashboard API, not stored in Supabase.
    # computed_status: InspectionStatus | None = None
    # days_left: int | None = None
