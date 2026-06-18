from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class DraftResult(BaseModel):
    draft_result_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    equipment_id: Optional[UUID] = None
    policy_id: Optional[str] = None
    scenario: Optional[Literal["a", "b", "c"]] = None
    draft_content: dict
    created_at: datetime
