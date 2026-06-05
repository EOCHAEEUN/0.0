from pydantic import BaseModel
from typing import Optional

class EquipmentInput(BaseModel):
    name: str
    category: str            # press / cnc / compressor 등
    age_years: int
    energy_cost_annual: int  # 만원/년
    defect_rate: Optional[float] = None  # %

class RoiInput(BaseModel):
    equipment: EquipmentInput
    company_context: dict = {}
