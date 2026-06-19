from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class RoiOutput(BaseModel):
    id: Optional[UUID] = None
    company_id: str
    equipment_id: str
    roi_data: dict
    created_at: Optional[datetime] = None