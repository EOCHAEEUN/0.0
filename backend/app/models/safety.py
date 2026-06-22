from pydantic import BaseModel

from app.models.safety_common import (
    InspectionCompletionStatus,
    InspectionPurpose,
    RiskLevel,
    SafetyRuleType,
)
from app.models.safety_rule_legal import SafetyRuleLegal
from app.models.safety_rule_voluntary import SafetyRuleVoluntary
from app.models.safety_check_status import SafetyCheckStatus, SafetyCheckStatusSaveRequest


# ==================== API 응답 조립용 모델 (DB 테이블 아님) ====================
# v1 설계 원칙: 안전점수/도넛 그래프 같은 "합성 점수"는 만들지 않습니다.
# 모든 수치는 사실 그대로의 개수(기한초과 N건, 기한임박 N건 등)로만 노출합니다.
# (점수화를 시도했다가, 항목 수가 설비마다 달라 점수 왜곡이 생기고
#  "법정점검 위반 1건"과 "자율점검 위반 3건"의 무게를 점수 하나로 합치는 게
#  근거 없는 추정이라는 문제로 폐기함. tools/safety_calc.py 참고.)

class SafetyDashboardItem(BaseModel):
    """설비 1대에 대한 대시보드 카드 전체"""
    equipment_id: str
    equipment_name: str
    equipment_category: str
    age_years: int
    total_rule_count: int                 # 헤더 "점검 항목 N개"
    summary_counts: dict                  # 상단 5개 카드 (overdue_legal/overdue/due_soon/no_record/completed_count)
    purpose_breakdown: list[dict]         # 분류별 점검 기록 현황 (막대그래프용)
    priority_items: list[dict]            # 지금 처리해야 할 항목 (정렬+필터된 상위 노출용)
    all_items: list[dict]                 # 전체 점검 항목 목록 (필터/정렬 없음)
    legal_rules: list[SafetyRuleLegal]    # 이 설비에 적용되는 법정점검 규칙들
    voluntary_rules: list[SafetyRuleVoluntary]  # 이 설비에 적용되는 자율점검 규칙들
    inspection_records: list[SafetyCheckStatus]     # 이 설비의 점검 이력들 (safety_check_status)

    class Config:
        arbitrary_types_allowed = True


class SafetyDashboardSummary(BaseModel):
    """대시보드 상단 요약 통계 (전체 설비 기준 집계, 회사 레벨)"""
    total_equipment_count: int
    overdue_legal_count: int
    overdue_count: int
    due_soon_count: int
    no_record_count: int
    completed_count: int


class SafetyDashboardResponse(BaseModel):
    """GET /safety/dashboard 응답 최상위 모델"""
    company_id: str
    summary: SafetyDashboardSummary
    items: list[SafetyDashboardItem]
    company_calendar_view: dict           # 전체 설비 통합 "달력 전체 보기"용. 각 항목에 equipment_name 포함됨
    unsupported_equipment_names: list[str] = []
    # 등록은 됐지만 안전점검 미지원 카테고리(press/cnc/injection 외)인 설비 이름 목록.
    # 화면의 "등록 설비 선택" 리스트에서 이 이름들은 "지원 안 됨" 표시와 함께 노출하고,
    # 클릭 시 capex와 동일한 톤의 UNSUPPORTED_CATEGORY_MESSAGE를 안내.


class PreWorkChecklistItem(BaseModel):
    """오늘의 작업 전 점검 체크리스트 항목 1개"""
    rule_id: str
    rule_type: str                        # "legal" 또는 "voluntary"
    inspection_type: str                  # 체크 단위 제목 (예: "인터록·안전문 점검")
    check_item: str                       # 세부 내용 설명
    risk_level: str                       # 위험도
    checked_today: bool                   # 오늘 체크 여부


class PreWorkChecklistResponse(BaseModel):
    """GET /safety/pre-work-checklist 응답 모델"""
    equipment_id: str
    equipment_name: str
    date: str                             # 오늘 날짜 "YYYY-MM-DD"
    items: list[PreWorkChecklistItem]
    total_count: int                      # 전체 항목 수
    checked_count: int                    # 오늘 체크 완료 수
