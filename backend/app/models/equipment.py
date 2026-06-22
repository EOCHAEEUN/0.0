from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EquipmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=50)
    age_years: int = Field(ge=0, le=200)
    energy_cost_annual: int = Field(ge=0, le=10**12)
    defect_rate: Optional[float] = Field(default=None, ge=0, le=100)
    maintenance_cost_annual: Optional[int] = Field(default=None, ge=0, le=10**12)
    current_capacity_value: Optional[float] = Field(default=None, ge=0, le=10**15)
    production_qty: Optional[int] = Field(default=None, ge=0, le=10**15)
    process: Optional[str] = Field(default=None, max_length=120)
    contribution_margin_won: Optional[int] = Field(default=None, ge=0, le=10**12)
    scenario_a_investment_manwon: Optional[int] = Field(
        default=None, ge=0, le=10**12
    )
    scenario_b_investment_manwon: Optional[int] = Field(
        default=None, ge=0, le=10**12
    )


class EquipmentCreateRequest(EquipmentInput):
    company_id: UUID
