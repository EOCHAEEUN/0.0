from pydantic import BaseModel
from typing import Optional

class EquipmentInput(BaseModel):
    name: str
    category: str
    age_years: int
    energy_cost_annual: int
    defect_rate: Optional[float] = None
    new_energy_cost_annual: Optional[int] = None
    new_investment_manwon: Optional[int] = None
    maintenance_cost_annual: Optional[int] = None
    current_capacity_value: Optional[float] = None
    production_qty: Optional[int] = None
    contribution_margin_won: Optional[int] = None
    scenario_a_investment_manwon: Optional[int] = None 
    scenario_b_investment_manwon: Optional[int] = None  
