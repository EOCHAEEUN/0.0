"""
팩토핏 ROI 계산 Tool (LangChain Tool)

이 파일은 `roi_calc.py`의 계산 로직을 LangChain이 이해할 수 있는 @Tool 형태로 감싸는 역할을 합니다.

주요 목적:
- LangGraph Agent가 ROI 계산을 Tool Calling으로 수행할 수 있게 함
- LLM이 언제, 어떻게 이 Tool을 사용해야 하는지 description으로 명시

관계:
- `roi_calc.py` → 순수 계산 로직 (이 파일이 import)
- 이 파일 → LangChain Tool로 변환하여 Agent에서 사용
"""

# [Agent / Node]
#       ↓ Tool Calling
# [roi_calcu_tool.py]   ← @tool 데코레이터
#       ↓ import
# [roi_calc.py]         ← 실제 계산 로직



from langchain_core.tools import tool
from pydantic import BaseModel, Field
from typing import Optional

from app.models.equipment import EquipmentInput, RoiInput
from app.tools.roi_calc import calculate_roi as _calculate_roi


class ROICalculatorInput(BaseModel):
    """설비 교체 ROI 계산을 위한 입력"""
    equipment: EquipmentInput = Field(..., description="설비 정보 (이름, 카테고리, 연령, 에너지비용, 불량률 등)")
    scenario_a_investment_manwon: Optional[int] = Field(None, description="시나리오 A 총 투자금 (만원)")
    scenario_a_subsidy_manwon: Optional[int] = Field(None, description="시나리오 A 예상 지원금 (만원)")
    scenario_b_investment_manwon: Optional[int] = Field(None, description="시나리오 B 총 투자금 (만원)")
    scenario_b_subsidy_manwon: Optional[int] = Field(None, description="시나리오 B 예상 지원금 (만원)")


@tool(
    name="calculate_equipment_roi",   # ← 이름 변경 추천
    args_schema=ROICalculatorInput,
    return_direct=False,              # ← 명시 추천
    description="""
    설비 교체 시나리오 A(전체 교체)와 B(부분 정비)의 ROI를 계산합니다.
    설비 정보(연령, 에너지 비용, 불량률, 용량 등)를 기반으로 투자 회수기간, 
    연간 절감액, AI 추천 시나리오 등을 반환합니다.
    데이터가 부족한 경우 자동으로 업종 평균 기반으로 추정하여 계산합니다.
    """
)
def calculate_equipment_roi(
    equipment: EquipmentInput,
    scenario_a_investment_manwon: Optional[int] = None,
    scenario_a_subsidy_manwon: Optional[int] = None,
    scenario_b_investment_manwon: Optional[int] = None,
    scenario_b_subsidy_manwon: Optional[int] = None,
) -> dict:
    """
    설비 교체 ROI 계산 Tool.
    내부적으로 roi_calc.py의 calculate_roi를 호출하여 결과를 반환합니다.
    """
    roi_input = RoiInput(
        equipment=equipment,
        scenario_a_investment_manwon=scenario_a_investment_manwon,
        scenario_a_subsidy_manwon=scenario_a_subsidy_manwon,
        scenario_b_investment_manwon=scenario_b_investment_manwon,
        scenario_b_subsidy_manwon=scenario_b_subsidy_manwon,
    )
    
    return _calculate_roi(roi_input)


