from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

# 임포트 (실제 경로로 수정 필요)
from app.models.equipment_guide_schema import EquipmentGuideLookup, EquipmentGuideItem
from app.models.equipment_guide_response import (
    EquipmentGuideResponse,
    EquipmentGuideResponseBuilder
)

router = APIRouter(
    prefix="/equipment-guide",
    tags=["equipment-guide"]
)

# 요청/응답 모델
class SearchRequest(BaseModel):
    """설비관리 가이드 검색 요청"""
    query: str

class SearchResponse(BaseModel):
    """설비관리 가이드 검색 응답"""
    found: bool
    label: Optional[str] = None
    why_needed: Optional[str] = None
    tip_display: Optional[str] = None
    input_method: Optional[str] = None
    examples: Optional[str] = None
    message: Optional[str] = None

# 엔드포인트

@router.post("/search", response_model=SearchResponse)
async def search_equipment_guide(request: SearchRequest):
    """설비관리 항목 검색
    
    사용자가 입력한 쿼리로 항목을 검색합니다.
    부분 일치, 오타도 인식합니다.
    
    Args:
    request: SearchRequest (query)
    
    Returns:
    SearchResponse
    """
    query = request.query.strip()
    
    if not query:
        raise HTTPException(status_code=400, detail="query는 필수입니다.")
    
    # 퍼지 매칭으로 항목 검색
    item = EquipmentGuideLookup.get_item_fuzzy(query)
    
    if not item:
        return SearchResponse(
            found=False,
            message="설비관리에서 제공하지 않는 정보입니다."
        )
    
    # 응답 포맷 변환
    response = EquipmentGuideResponseBuilder.from_item(item)
    display = EquipmentGuideResponseBuilder.format_for_display(response)
    
    return SearchResponse(
        found=True,
        label=item.label,
        why_needed=display["why_needed"],
        tip_display=display["tip_display"],
        input_method=display["input_method"],
        examples=display["examples"]
    )

@router.get("/item/{key}", response_model=SearchResponse)
async def get_equipment_guide_item(key: str):
    """특정 항목 조회 (key로)
    
    Args:
    key: 항목 key (equipment_type, equipment_name, etc)
    
    Returns:
    SearchResponse
    """
    item = EquipmentGuideLookup.get_item(key)
    
    if not item:
        raise HTTPException(status_code=404, detail=f"항목 '{key}'를 찾을 수 없습니다.")
    
    response = EquipmentGuideResponseBuilder.from_item(item)
    display = EquipmentGuideResponseBuilder.format_for_display(response)
    
    return SearchResponse(
        found=True,
        label=item.label,
        why_needed=display["why_needed"],
        tip_display=display["tip_display"],
        input_method=display["input_method"],
        examples=display["examples"]
    )
