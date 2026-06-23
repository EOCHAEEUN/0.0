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
# SafetyInspection.status — 개별 점검 이력의 진행 상태 (완료 / 대기·예정 / 기한초과)


# ==================== DB 테이블 1: safety_rule ====================
# 설비 카테고리별 "어떤 점검을 얼마나 자주 해야 하는가"에 대한 규칙 마스터 테이블.
# 회사/설비와 무관하게 고정된 기준 데이터 (예: "프레스는 광전자식 안전장치를 3개월마다 점검").
class SafetyRule(BaseModel):
    rule_id: str
    equipment_category: str               # 어떤 설비 카테고리에 적용되는 규칙인지 (press/cnc/injection)
    equipment_name_keywords: list[str] = []  # 설비명 매칭용 키워드
    inspection_type: str                  # 점검 종류 (세부 분류, 자유 텍스트)
    check_item: str                       # 실제 점검 항목 ("광전자식 안전장치 정상 작동 여부" 등)
    cycle_months: int                     # 점검 주기 (개월)
    risk_level: RiskLevel                 # 이 점검 항목의 중요도
    legal_basis: Optional[str] = None     # 법조항 텍스트 ("산업안전보건법 시행규칙 제123조" 등)
    legal_requirement: LegalRequirement   # 법정/자율 분류
    inspection_purpose: InspectionPurpose # 점검 목적 분류
    note: Optional[str] = None
    source_name: Optional[str] = None     # 출처 기관/문서명
    evidence_text: Optional[str] = None   # 근거 원문 발췌
    source_url: Optional[str] = None


# ==================== DB 테이블 2: safety_inspection ====================
# 특정 회사의 특정 설비가 특정 규칙(rule_id)에 대해 "실제로 언제 점검했고, 다음 점검은 언제인가"를 기록하는 이력 테이블.
# company_id + equipment_id + rule_id 조합으로 한 건의 점검 이력을 추적.
class SafetyInspection(BaseModel):
    inspection_id: str
    company_id: str
    equipment_id: str
    rule_id: str                          # safety_rule.rule_id 참조 (어떤 규칙에 대한 이력인지)
    last_checked_at: Optional[date] = None
    next_due_at: Optional[date] = None    # last_checked_at + rule.cycle_months로 계산 (계산 로직 별도 필요)
    status: Optional[InspectionCompletionStatus] = None  # 완료/대기/기한초과
    assignee: Optional[str] = None
    evidence_file_url: Optional[str] = None
    memo: Optional[str] = None


# ==================== API 응답 조립용 모델 (DB 테이블 아님) ====================
# 아래부터는 safety_rule + safety_inspection을 조회/계산해서 대시보드 화면에 내려줄 응답 형태.
# 별도 테이블로 저장되지 않고, 라우터에서 위 두 테이블 데이터를 조합해 즉석에서 만들어짐.

class SafetyRiskFactor(BaseModel):
    """항목별 진단 도넛 그래프 1개에 해당하는 단위 (설비 노후도, 작업자 안전 등)"""
    key: str
    label: str
    score: int
    status: InspectionStatus  # 화면 라벨: "안전 등급"
    reason: str


class SafetyDashboardItem(BaseModel):
    """설비 1대에 대한 대시보드 카드 전체 (안전점수 + 진단 + 우선순위 + 관련 규칙/이력)"""
    equipment_id: str
    equipment_name: str
    equipment_category: str
    age_years: int
    safety_score: int
    status: InspectionStatus
    priority_rank: int
    priority_score: int
    replacement_reasons: list[str]        # v1 미사용, capex 연동 보류 (프론트 렌더링 숨김)
    risk_factors: list[SafetyRiskFactor]  # 가변 개수
    rules: list[SafetyRule]               # 이 설비에 적용되는 safety_rule들
    inspections: list[SafetyInspection]   # 이 설비의 safety_inspection 이력들


class SafetyDashboardSummary(BaseModel):
    """대시보드 상단 요약 통계 (전체 설비 기준 집계)"""
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