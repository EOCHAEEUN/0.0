from datetime import date
from typing import Optional
from pydantic import BaseModel

from app.models.safety_common import (
    InspectionCompletionStatus,
    InspectionPurpose,
    LegalRequirement,
    RiskLevel,
)


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


class SafetyInspectionSaveRequest(BaseModel):
    """
    "점검 기록하기" 버튼 클릭 시 라우터가 받는 요청 바디.

    inspection_id/company_id/next_due_at/status는 사용자 입력이 아니라
    서버가 계산/생성하므로 여기 포함하지 않습니다.

    evidence_file_url: 사진 파일 자체가 아니라, 프론트에서 Supabase Storage에
    먼저 업로드한 뒤 받은 결과 URL을 문자열로 전달받습니다 (백엔드는 파일을
    직접 다루지 않음).
    """
    equipment_id: str
    rule_id: str
    last_checked_at: date
    assignee: Optional[str] = None
    memo: Optional[str] = None
    evidence_file_url: Optional[str] = None


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
    all_items: list[dict]                 # 전체 점검 항목 목록 (필터/정렬 없음) — "목록 보기" 토글용
    calendar_view: dict                   # 날짜(date)별로 묶은 동일 데이터 — "달력 보기" 토글용. 키는 JSON 직렬화 시 "YYYY-MM-DD" 문자열로 자동 변환됨
    rules: list[SafetyRule]               # 이 설비에 적용되는 safety_rule들
    inspections: list[SafetyInspection]   # 이 설비의 safety_inspection 이력들

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
