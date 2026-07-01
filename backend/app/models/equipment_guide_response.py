from pydantic import BaseModel
from typing import Optional
from app.models.equipment_guide_schema import EquipmentGuideItem


class EquipmentGuideResponse(BaseModel):
    """설비관리 가이드 응답 포맷 (프론트 전달용)
    
    schema에서 필요한 필드만 추출하여 프론트에 전달합니다.
    tip은 why_needed 아래 "💡 TIP." 형태로 표시합니다.
    """
    why_needed: str
    tip: str
    input_method: str
    examples: str


class EquipmentGuideResponseBuilder:
    """EquipmentGuideItem을 EquipmentGuideResponse로 변환"""
    
    @staticmethod
    def from_item(item: EquipmentGuideItem) -> EquipmentGuideResponse:
        """항목을 응답 포맷으로 변환
        
        Args:
            item: EquipmentGuideItem
            
        Returns:
            EquipmentGuideResponse
        """
        return EquipmentGuideResponse(
            why_needed=item.why_needed,
            tip=item.tip,
            input_method=item.input_method,
            examples=item.examples
        )
    
    @staticmethod
    def format_for_display(response: EquipmentGuideResponse) -> dict:
        """디스플레이용으로 포맷팅 (프론트에서 사용)
        
        why_needed 아래에 💡 TIP. 형태로 tip을 붙입니다.
        
        Args:
            response: EquipmentGuideResponse
            
        Returns:
            프론트에서 렌더링하기 쉬운 dict
        """
        return {
            "why_needed": response.why_needed,
            "tip_display": f"💡 TIP. {response.tip}",
            "input_method": response.input_method,
            "examples": response.examples
        }
    
    @staticmethod
    def to_dict(response: EquipmentGuideResponse) -> dict:
        """응답을 dict로 변환 (JSON 직렬화용)
        
        Args:
            response: EquipmentGuideResponse
            
        Returns:
            dict
        """
        return response.model_dump()
