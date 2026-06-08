from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RoiOutput(BaseModel):
    company_id: Optional[str] = None
    roi_data: dict
    created_at: Optional[datetime] = None