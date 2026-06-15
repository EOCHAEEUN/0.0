from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EquipmentInput(BaseModel):
    name: str
    category: str
    age_years: int = Field(ge=0)
    energy_cost_annual: int = Field(ge=0)
    defect_rate: Optional[float] = Field(default=None, ge=0, le=100)
    maintenance_cost_annual: Optional[int] = Field(default=None, ge=0)
    current_capacity_value: Optional[float] = Field(default=None, ge=0)
    production_qty: Optional[int] = Field(default=None, ge=0)
    contribution_margin_won: Optional[int] = Field(default=None, ge=0)
    scenario_a_investment_manwon: Optional[int] = Field(default=None, ge=0)
    scenario_b_investment_manwon: Optional[int] = Field(default=None, ge=0)

class EquipmentCreateRequest(EquipmentInput):
    company_id: UUID

