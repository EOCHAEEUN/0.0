from pydantic import BaseModel, Field
from typing import Optional

## 온보딩 입력값 (ROI 시뮬레이션용)

# **목적**: 설비 교체 ROI를 계산하기 위해 최소한으로 필요한 입력값 정의
# **기준**: MVP에서 C 수준 계산이 가능하면서 입력 부담이 크지 않은 6개로 압축
# **확정일**: 2026-06-04
# **확정한 사람**: 어채은

# | 순서  | 입력 항목          | 필수/선택 | 이유                                      | 비고                              | 비고2                  |
# |------|-------------------|----------|------------------------------------------|--------------------------------- |------------------------|
# | 1    | 설비 종류          | 필수      | 프레스 / CNC / 사출성형기 구분              | 드롭다운으로 고정                   | -                      |
# | 2    | 설비 용량          | 필수      | 투자금 자동 추정 + 에너지 소비량 계산         | 숫자 입력 + 단위 자동 표시          | ton 또는 kW            |
# | 3    | 설비 연령          | 필수      | 노후도 판단 및 equipment_status 계산       | 년 단위                            | -                      |
# | 4    | 연간 에너지 비용    | 필수      | 가장 중요한 계산 기반                      | 만원 단위                           | -                      |
# | 5    | 현재 불량률         | 필수      | 불량비용 절감액 계산                      | % 단위                             | -                      |
# | 6    | 연간 가동시간       | 필수      | 에너지 절감액을 kWh 기반으로 정밀 계산       | 시간 단위 (기본값 제공 가능)          | 에너지 정밀 계산 핵심  |

# ### 선택 입력 (Phase 2 / 고도화용)
# - 연간 유지보수비 (만원)
# - 연간 생산량 (개)
# - 제품 1개당 기여이익 (원)

# > 선택 입력이 없어도 계산은 가능하지만, 정확도가 떨어지며 Data Quality 점수가 낮아집니다.  
# > AI가 사용자에게 "입력하면 더 정확해집니다"라고 안내하는 구조로 설계 예정.



class EquipmentInput(BaseModel):
    """설비 정보 입력 스키마"""
    name: str                               # 설비명
    category: str                           # press / cnc / injection
    age_years: int                          # 설비 연령 (년)
    energy_cost_annual: int                 # 연간 에너지비용 (만원)
    defect_rate: Optional[float] = None     # 현재 불량률 (%)

    # 사용자 선택 입력 — 있으면 더 정확한 계산 가능
    maintenance_cost_annual: Optional[int] = None   # 연간 유지보수비 (만원)
    capacity_value: Optional[float] = None          # 설비 용량 숫자 (톤 or kW)
    annual_operating_hours: Optional[int] = None    # 연간 가동시간 (기본 2500h)
    load_factor: Optional[float] = None             # 부하율 (기본 0.75)
    electricity_price_won: Optional[int] = None     # 전기요금 원/kWh (기본 140원)

    # 불량비용 정밀 계산용 (선택)
    production_qty: Optional[int] = None            # 연간 생산량 (개)
    contribution_margin_won: Optional[int] = None   # 제품 1개당 기여이익 (원)


class RoiInput(BaseModel):
    """ROI 시뮬레이션 입력"""
    equipment: EquipmentInput
    # 투자금 직접 입력 (없으면 설비 단가 테이블로 자동 추정 ->공공데이터 계산)
    scenario_a_investment_manwon: Optional[int] = None
    scenario_a_subsidy_manwon: Optional[int] = None
    scenario_b_investment_manwon: Optional[int] = None
    scenario_b_subsidy_manwon: Optional[int] = None