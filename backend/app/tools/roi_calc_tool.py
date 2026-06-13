"""
팩토핏 ROI 계산 Tool (LangChain Tool)

이 파일은 `roi_calc.py`의 계산 로직을 LangChain이 이해할 수 있는 @tool 형태로 감싸는 역할을 합니다.

DB/UX 기준:
- Tool 입력값은 현재 설비 상태만 받습니다.
- A안/B안 투자금, 지원금, 신규 에너지 비용, 개선 후 생산능력은 calculate_roi 결과로 반환됩니다.
"""

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from app.models.equipment import EquipmentInput
from app.models.roi_input import RoiInput
from app.tools.roi_calc import calculate_roi as _calculate_roi


class ROICalculatorInput(BaseModel):
    """설비 교체 ROI 계산을 위한 입력"""
    equipment: EquipmentInput = Field(
        ...,
        description=(
            "설비 정보. 이름, 카테고리, 사용연수, 현재 에너지비용, 현재 불량률, "
            "현재 유지보수비, 현재 생산량, 현재 설비 용량/생산능력 등을 포함합니다."
        ),
    )


@tool(
    args_schema=ROICalculatorInput,
    description="""
    설비 교체 시나리오 A(전체 교체)와 B(부분 정비)의 ROI를 계산합니다.
    입력값은 현재 설비 상태입니다.
    계산 결과로 A/B 투자금, A/B 지원금, 신규 에너지 비용,
    개선 후 예상 생산능력, 회수기간, ROI, AI 추천 시나리오를 반환합니다.
    """,
)
def calculate_equipment_roi(equipment: EquipmentInput) -> dict:
    """
    설비 교체 ROI 계산 Tool.
    내부적으로 roi_calc.py의 calculate_roi를 호출하여 결과를 반환합니다.
    """
    roi_input = RoiInput(equipment=equipment)
    return _calculate_roi(roi_input)
