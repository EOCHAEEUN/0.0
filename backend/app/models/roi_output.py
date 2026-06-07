from pydantic import BaseModel

class RoiOutput(BaseModel):
    annual_energy_saving: int
    annual_defect_saving: int
    total_annual_saving: int
    scenario_a_investment: int
    scenario_b_investment: int
    scenario_a_payback_years: float
    scenario_b_payback_years: float
    scenario_a_roi_pct: float
    scenario_b_roi_pct: float
    recommendation: str
