from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel

# ==================== 공통 분류 타입 (Literal) ====================
RiskLevel = Literal["low", "medium", "high", "critical"]
# SafetyRule.risk_level — 점검 항목 자체의 중요도/위험도. 우선순위 점수(priority_score) 계산에 사용.

InspectionStatus = Literal["normal", "warning", "danger"]
# SafetyRiskFactor.status, SafetyDashboardItem.status — 점수 구간에 따른 "안전 등급" (화면 색상/라벨용)

LegalRequirement = Literal["법정점검", "자율점검"]
# SafetyRule.legal_requirement — 법적 의무 여부.
# 법정점검: 정기점검 의무, 미이행 자체가 과태료/벌칙 대상
# 자율점검: 평시 강제는 아니나, 사고 발생 시 안전조치 의무 위반 책임 가능

InspectionPurpose = Literal["안전장치점검", "유지보수점검", "안전교육"]
# SafetyRule.inspection_purpose — 점검의 목적/대상 분류 (화면 카테고리 태그용)

InspectionCompletionStatus = Literal["pending", "overdue"]
# SafetyInspection.status — 개별 점검 이력의 진행 상태.
# "completed"는 DB에 저장하지 않음 (저장 직후엔 프론트 토스트로만 안내).
# next_due_at 기준으로 pending/overdue만 재계산되어 저장됨.


# ==================== DB 테이블 1: safety_rule ====================
# 설비 카테고리별 "어떤 점검을 얼마나 자주 해야 하는가"에 대한 규칙 마스터 테이블.
class SafetyRule(BaseModel):
    rule_id: str
    equipment_category: str               # press / cnc / injection (equipment.category와 매칭)
    equipment_name_keywords: list[str] = []
    inspection_type: str
    check_item: str
    cycle_months: int
    risk_level: RiskLevel
    legal_basis: Optional[str] = None     # 법조항 텍스트 ("산업안전보건법 시행규칙 제123조" 등)
    legal_requirement: LegalRequirement   # 법정/자율 분류
    inspection_purpose: InspectionPurpose # 점검 목적 분류
    note: Optional[str] = None
    source_name: Optional[str] = None
    evidence_text: Optional[str] = None
    source_url: Optional[str] = None


# ==================== DB 테이블 2: safety_inspection ====================
# (company_id, equipment_id, rule_id) 복합 유니크 — 한 rule당 inspection 최대 1개.
class SafetyInspection(BaseModel):
    inspection_id: str
    company_id: str
    equipment_id: str
    rule_id: str
    last_checked_at: Optional[date] = None
    next_due_at: Optional[date] = None
    status: Optional[InspectionCompletionStatus] = None
    assignee: Optional[str] = None
    evidence_file_url: Optional[str] = None
    memo: Optional[str] = None


# ==================== API 응답 조립용 모델 (DB 테이블 아님) ====================
class SafetyRiskFactor(BaseModel):
    """항목별 진단 도넛 그래프 1개에 해당하는 단위. 개수는 가변."""
    key: str
    label: str
    score: int
    status: InspectionStatus  # 화면 라벨: "안전 등급"
    reason: str


class SafetyDashboardItem(BaseModel):
    equipment_id: str
    equipment_name: str
    equipment_category: str
    age_years: int
    safety_score: int
    status: InspectionStatus
    replacement_reasons: list[str]        # v1 미사용, capex 연동 보류 (프론트 렌더링 숨김)
    risk_factors: list[SafetyRiskFactor]
    rules: list[SafetyRule]
    inspections: list[SafetyInspection]


class SafetyDashboardSummary(BaseModel):
    average_score: int
    normal_count: int
    warning_count: int
    danger_count: int
    total_rules: int
    overdue_count: int


class SafetyDashboardResponse(BaseModel):
    """GET /safety/dashboard 응답 최상위 모델"""
    company_id: str
    summary: SafetyDashboardSummary
    items: list[SafetyDashboardItem]
    unsupported_equipment_names: list[str] = []
    # 등록은 됐지만 안전점검 미지원 카테고리(press/cnc/injection 외)인 설비 이름 목록.
    # 화면의 "등록 설비 선택" 리스트에서 이 이름들은 "지원 안 됨" 표시와 함께 노출하고,
    # 클릭 시 capex와 동일한 톤의 UNSUPPORTED_CATEGORY_MESSAGE를 안내.
