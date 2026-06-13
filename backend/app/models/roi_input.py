from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from app.models.equipment import EquipmentInput


class RoiInput(BaseModel):
    """
    ROI 계산 전 입력값 모델.

    DB 기준:
    - roi_input에는 현재 설비 상태/현재 비용/현재 생산 관련 값만 저장합니다.
    - A안/B안 투자금, 지원금, 신규 에너지 비용, 개선 후 생산능력은 roi_output에 저장합니다.
    """
    company_id: Optional[UUID] = None
    equipment: EquipmentInput
    company_context: dict = Field(default_factory=dict)
