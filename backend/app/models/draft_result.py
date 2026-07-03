from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DraftResult(BaseModel):
    draft_result_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    equipment_id: Optional[UUID] = None
    policy_id: Optional[str] = None
    # Scenario values are read from matched_policy and embedded in draft_content.
    draft_content: dict
    created_at: datetime
