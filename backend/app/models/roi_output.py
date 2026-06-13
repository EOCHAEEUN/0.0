from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class RoiOutput(BaseModel):
    id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    roi_input_id: Optional[UUID] = None
    roi_data: dict
    scenario_a_subsidy_manwon: Optional[int] = None
    scenario_b_subsidy_manwon: Optional[int] = None
    new_energy_cost_annual: Optional[int] = None
    expected_capacity_value: Optional[float] = None

    created_at: Optional[datetime] = None
