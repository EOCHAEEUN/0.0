from pydantic import BaseModel
from typing import Optional

class EquipmentInput(BaseModel):
    name: str
    category: str                              # press / cnc / compressor 등
    age_years: int
    energy_cost_annual: int                    # 만원/년
    defect_rate: Optional[float] = None        # %
    new_energy_cost_annual: Optional[int] = None
    new_investment_manwon: Optional[int] = None

class RoiInput(BaseModel):
    equipment: EquipmentInput
    company_context: dict = {}
    scenario_a_investment_manwon: Optional[int] = None  # 시나리오 A 총 투자금 (만원)
    scenario_a_subsidy_manwon: Optional[int] = None     # 시나리오 A 예상 지원금 (만원)
    scenario_b_investment_manwon: Optional[int] = None  # 시나리오 B 총 투자금 (만원)
    scenario_b_subsidy_manwon: Optional[int] = None     # 시나리오 B 예상 지원금 (만원)
