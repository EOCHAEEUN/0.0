from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class DraftResult(BaseModel):
    draft_result_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    equipment_id: Optional[UUID] = None
    policy_id: Optional[str] = None
    scenario_match: Optional[list[str]] = None
    scenario_label: Optional[str] = None
    draft_content: dict
    created_at: datetime
