from pydantic import BaseModel
from typing import List, Optional
from difflib import get_close_matches


class EquipmentGuideItem(BaseModel):
    """설비관리 가이드 항목"""
    key: str
    label: str
    required: bool
    why_needed: str
    input_method: str
    examples: str
    support_range: Optional[str] = None
    tip: str


# 1. 설비 종류
equipment_type = EquipmentGuideItem(
    key="equipment_type",
    label="설비 종류",
    required=True,
    why_needed="설비별로 ROI 분석, 안전점검, 지원사업 매칭 기준이 달라집니다.",
    input_method="press, cnc, injection, welding, compressor, etc 중 선택하세요",
    examples="프레스→press, CNC→cnc, 사출기→injection",
    support_range="현재 ROI 분석과 안전점검은 press, cnc, injection만 지원합니다.",
    tip="현장에서 부르는 설비명이나 모델명으로 확인하세요."
)

# 2. 설비명
equipment_name = EquipmentGuideItem(
    key="equipment_name",
    label="설비명",
    required=True,
    why_needed="같은 종류의 설비가 여러 개일 때 구분하기 위함입니다.",
    input_method="현장에서 부르는 설비 이름이나 모델명을 입력해주세요.",
    examples="CNC 가공기 #1, 프레스 1호기, 사출기 3라인, 용접기 A타입",
    tip="여러 설비를 관리할 경우 번호나 라인을 함께 적으면 구분하기 쉽습니다."
)

# 3. 공정
process = EquipmentGuideItem(
    key="process",
    label="공정",
    required=False,
    why_needed="동일한 설비 종류라도 공정에 따라 정책 추천과 안전점검 항목이 달라집니다.",
    input_method="설비가 맡는 구체적인 작업을 입력합니다.",
    examples="금속 절삭가공, 사출성형, 용접, 압축공기 공급, 제품 검사",
    tip="공정을 함께 입력하면 정책 추천과 안전점검 항목이 더 구체화됩니다."
)

# 4. 설비 사용연수
equipment_age_years = EquipmentGuideItem(
    key="equipment_age_years",
    label="설비 사용연수",
    required=True,
    why_needed="노후 설비 교체 지원사업 조건 판단과 유지보수 비용 추정에 활용됩니다.",
    input_method="숫자 입력 (단위: 년) - 설비를 도입한 뒤 현재까지 사용한 연수를 입력합니다.",
    examples="2021년 설치, 현재 2026년→5년 입력 / 2015년 도입→약 11년 입력",
    tip="정확한 설치일이 불확실하면 대략적인 연수라도 입력하세요."
)

# 5. 연간 에너지 비용
annual_energy_cost = EquipmentGuideItem(
    key="annual_energy_cost",
    label="연간 에너지 비용",
    required=True,
    why_needed="에너지 절감 효과 분석과 ROI 계산의 핵심 요소입니다.",
    input_method="숫자 입력 (단위: 만원/년) - 월평균 비용에 12를 곱한 값입니다.",
    examples="월 400만원→4,800만원 입력 / 월 200만원→2,400만원 입력",
    support_range="에너지 절감 분석은 정확한 에너지 비용이 필수입니다.",
    tip="전체 공장 전기요금이 아니라 해당 설비 기준으로 추정하면 더 정확합니다."
)

# 6. 불량률
defect_rate = EquipmentGuideItem(
    key="defect_rate",
    label="불량률",
    required=False,
    why_needed="설비 교체 후 불량률 개선 효과는 ROI 계산에서 중요한 절감 요인입니다.",
    input_method="숫자 입력 (단위: %) - 100개 생산 시 불량품 개수의 백분율입니다.",
    examples="1,000개 중 30개 불량→3% 입력 / 월 10,000개 중 150개 불량→1.5% 입력",
    tip="최근 3개월 평균 불량률을 기준으로 입력하면 더 정확합니다."
)

# 7. 전체교체 예상 투자금
full_replacement_investment = EquipmentGuideItem(
    key="full_replacement_investment",
    label="전체교치 예상 투자금",
    required=False,
    why_needed="ROI 분석에서 투자금은 회수기간과 이익률을 결정하는 핵심 요소입니다.",
    input_method="숫자 입력 (단위: 만원) - 장비 구매비 + 설치비 + 운송비 + 시운전비 + 부대공사비",
    examples="CNC 장비 8,000만원 + 설치비 500만원 + 운송비 200만원 + 시운전비 300만원 = 9,000만원",
    support_range="ROI 분석은 정확한 투자금을 기반으로 합니다.",
    tip="견적서의 장비값만 보지 말고 부대비용까지 포함하세요."
)

# 8. 부분교체 예상 투자금
partial_replacement_investment = EquipmentGuideItem(
    key="partial_replacement_investment",
    label="부분교체 예상 투자금",
    required=False,
    why_needed="전체교체와 부분교체의 ROI를 비교 분석할 수 있습니다.",
    input_method="숫자 입력 (단위: 만원) - 필요한 부분만 개선하는 비용입니다.",
    examples="제어반 교체 800만원 + 모터 교체 700만원 = 1,500만원 입력",
    tip="전체교체보다 투자금은 낮지만 절감효과가 제한적일 수 있습니다."
)

# 9. 연간 유지보수 비용
annual_maintenance_cost = EquipmentGuideItem(
    key="annual_maintenance_cost",
    label="연간 유지보수 비용",
    required=False,
    why_needed="노후 설비는 유지보수 비용이 증가하므로 교체 ROI 판단에 중요합니다.",
    input_method="숫자 입력 (단위: 만원/년) - 월평균 수리비에 12를 곱한 값입니다.",
    examples="월 80만원→960만원 입력 / 월 120만원→1,440만원 입력",
    tip="설비가 오래될수록 유지보수 비용이 커져 교체 ROI가 좋아질 수 있습니다."
)

# 10. 설비 용량 규격값
capacity_value = EquipmentGuideItem(
    key="capacity_value",
    label="설비 용량 규격값",
    required=False,
    why_needed="동일한 설비 종류라도 규모에 따라 효율성과 비용이 달라집니다.",
    input_method="숫자 입력 - 설비 종류별 대표 규격을 입력합니다.",
    examples="프레스: 150톤, 컴프레서: 75kW, 사출기: 250톤",
    tip="설비 카탈로그나 명판에 표시된 규격값을 입력하세요."
)

# 11. 연간 생산량
annual_production = EquipmentGuideItem(
    key="annual_production",
    label="연간 생산량",
    required=False,
    why_needed="불량률 개선 효과를 금액으로 환산할 때 기준값입니다.",
    input_method="숫자 입력 (단위: 개/년) - 월평균 생산량에 12를 곱한 값입니다.",
    examples="월 10,000개→120,000개 입력 / 월 5,000개→60,000개 입력",
    tip="정확한 월별 생산량 데이터가 있으면 더 정확한 분석이 가능합니다."
)

# 12. 제품 개당 예상이익
profit_per_unit = EquipmentGuideItem(
    key="profit_per_unit",
    label="제품 개당 예상이익",
    required=False,
    why_needed="불량이 줄었을 때 회수되는 순이익을 계산하기 위함입니다.",
    input_method="숫자 입력 (단위: 원) - 원가를 제외한 순이익 기준입니다.",
    examples="판매가 50,000원 - 원가 35,000원 = 15,000원 입력",
    tip="매출액이 아니라 원가를 제외한 이익 기준으로 입력해야 ROI가 과대평가되지 않습니다."
)


# 모든 항목을 리스트로
EQUIPMENT_GUIDE_ITEMS = [
    equipment_type,
    equipment_name,
    process,
    equipment_age_years,
    annual_energy_cost,
    defect_rate,
    full_replacement_investment,
    partial_replacement_investment,
    annual_maintenance_cost,
    capacity_value,
    annual_production,
    profit_per_unit
]


class EquipmentGuideLookup:
    """설비관리 가이드 조회용 클래스"""
    
    _items_dict = {item.key: item for item in EQUIPMENT_GUIDE_ITEMS}
    
    @classmethod
    def get_item(cls, key: str) -> Optional[EquipmentGuideItem]:
        """특정 항목 조회"""
        return cls._items_dict.get(key)
    
    @classmethod
    def get_all_items(cls) -> List[EquipmentGuideItem]:
        """모든 항목 조회"""
        return EQUIPMENT_GUIDE_ITEMS
    
    @classmethod
    def get_item_by_label(cls, label: str) -> Optional[EquipmentGuideItem]:
        """라벨로 항목 조회"""
        for item in EQUIPMENT_GUIDE_ITEMS:
            if item.label == label:
                return item
        return None
    
    @classmethod
    def get_item_fuzzy(cls, query: str) -> Optional[EquipmentGuideItem]:
        """부분/오타 매칭으로 항목 조회
        
        사용자가 정확하지 않은 입력을 해도 가장 가까운 항목을 찾음
        - "설비" → "설비 종류" 찾음 (부분 일치)
        - "설비 종ㄹ" → "설비 종류" 찾음 (유사도 매칭)
        
        Args:
            query: 사용자의 입력 쿼리
            
        Returns:
            찾은 항목 또는 None
        """
        query_lower = query.lower().strip()
        
        if not query_lower:
            return None
        
        # 1️⃣ 완전 일치
        for item in EQUIPMENT_GUIDE_ITEMS:
            if item.label.lower() == query_lower:
                return item
        
        # 2️⃣ 부분 일치 (포함 관계)
        for item in EQUIPMENT_GUIDE_ITEMS:
            if query_lower in item.label.lower() or item.label.lower() in query_lower:
                return item
        
        # 3️⃣ 유사도 비교 (오타 용서)
        labels = [item.label for item in EQUIPMENT_GUIDE_ITEMS]
        close_matches = get_close_matches(query_lower, [l.lower() for l in labels], n=1, cutoff=0.6)
        
        if close_matches:
            for item in EQUIPMENT_GUIDE_ITEMS:
                if item.label.lower() == close_matches[0]:
                    return item
        
        return None
    
    @classmethod
    def get_required_items(cls) -> List[EquipmentGuideItem]:
        """필수 항목만 조회"""
        return [item for item in EQUIPMENT_GUIDE_ITEMS if item.required]
    
    @classmethod
    def get_optional_items(cls) -> List[EquipmentGuideItem]:
        """선택 항목만 조회"""
        return [item for item in EQUIPMENT_GUIDE_ITEMS if not item.required]
