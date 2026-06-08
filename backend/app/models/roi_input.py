from pydantic import BaseModel
from typing import Optional
from app.models.equipment import EquipmentInput

class RoiInput(BaseModel):
    equipment: EquipmentInput
    company_context: dict = {}
    scenario_a_investment_manwon: Optional[int] = None
    scenario_a_subsidy_manwon: Optional[int] = None
    scenario_b_investment_manwon: Optional[int] = None
    scenario_b_subsidy_manwon: Optional[int] = None