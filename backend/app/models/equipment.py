from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

class EquipmentInput(BaseModel):
    name: str                                                                    # 설비명 (예: 프레스 1호기)
    category: str                                                                # 설비 카테고리 (press/cnc/injection)
    age_years: int = Field(default=0, ge=0)                                      # 설비 사용연수 (년)
    energy_cost_annual: Optional[int] = Field(default=None, ge=0)               # 연간 에너지 비용 (만원)
    defect_rate: Optional[float] = Field(default=None, ge=0, le=100)            # 불량률 (%)
    maintenance_cost_annual: Optional[int] = Field(default=None, ge=0)          # 연간 유지보수 비용 (만원)
    current_capacity_value: Optional[float] = Field(default=None, ge=0)         # 설비 용량 규격 값
    production_qty: Optional[int] = Field(default=None, ge=0)                   # 연간 생산량 (개)
    process: Optional[str] = None                                                # 공정 (예: 프레스 공정)
    contribution_margin_won: Optional[int] = Field(default=None, ge=0)          # 제품 1개당 예상 이익 (원)
    scenario_a_investment_manwon: Optional[int] = Field(default=None, ge=0)     # 전체교체 예상 투자금 (만원)
    scenario_b_investment_manwon: Optional[int] = Field(default=None, ge=0)     # 부분교체 예상 투자금 (만원)

class EquipmentCreateRequest(EquipmentInput):
    company_id: UUID

