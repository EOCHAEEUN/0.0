"""
팩토핏 안전점검 계산 엔진 (Pure Logic)

이 파일은 안전점검 계산에 필요한 **순수 비즈니스 로직**만을 담고 있습니다.
LangChain, FastAPI, DB와는 완전히 독립적이며, 단순한 함수 호출만으로도 사용할 수 있습니다.

주요 기능:
- 설비 카테고리 기준 적용 규칙 필터링
- 규칙 + 점검이력 결합 (점검 이력이 없는 규칙도 누락 없이 포함)
- 다음 점검일 계산
- 점검 상태(pending/overdue) 판정

이 파일은 agents/safety.py에서 import되어 노드 로직에 사용됩니다.
"""

from __future__ import annotations
from datetime import date
from typing import Optional
from dateutil.relativedelta import relativedelta

from app.models.safety import SafetyRule, SafetyInspection, InspectionCompletionStatus


# 안전점검을 지원하는 설비 카테고리 (capex.py의 supported 목록과 동일하게 유지)
SUPPORTED_CATEGORIES = ["press", "cnc", "injection"]

UNSUPPORTED_CATEGORY_MESSAGE = (
    "현재 안전점검은 프레스, CNC, 사출성형기 설비만 지원합니다. "
    "설비명을 프레스/CNC/사출기 중 하나로 입력해주세요."
)

# 법정점검/자율점검 미이행 시 법적 책임 안내 문구 (legal_requirement 기준)
# 주의: 법률 자문 미거친 일반 정보. 화면에 단정적 문구로 노출 전 노무사/법무 검토 필요.
# 추후 법령 개정이나 자문 결과에 따라 수정될 수 있음.
LEGAL_PENALTY_INFO = {
    "법정점검": "안전조치 의무 위반 시 사업주 5년 이하 징역 또는 5천만원 이하 벌금, 사망사고 시 7년 이하 징역 또는 1억원 이하 벌금 (산업안전보건법 제38·39조, 제167·168조)",
    "자율점검": "법적 강제 점검 의무는 아니나, 미점검으로 사고가 발생할 경우 안전조치 의무 위반으로 처벌 책임이 발생할 수 있습니다.",
}

# risk_level(영문 코드값) -> 화면 노출용 한글 라벨
RISK_LEVEL_LABELS = {
    "critical": "위험도 매우 높음",
    "high": "위험도 높음",
    "medium": "위험도 보통",
    "low": "위험도 낮음",
}


# ==================== 1. 카테고리 매칭 ====================
def get_applicable_rules(
    equipment_category: str,
    all_rules: list[SafetyRule],
) -> list[SafetyRule]:
    """
    설비의 category(press/cnc/injection)와 일치하는 SafetyRule만 필터링합니다.

    주의:
    - equipment_category는 capex.py의 normalize_equipment_category()를 거친
      정규화된 값("press"/"cnc"/"injection"/"unsupported")이어야 합니다.
    - "unsupported"인 경우 매칭되는 규칙이 없어 빈 리스트가 반환됩니다.
      호출 측(agents/safety.py)에서 is_supported_category()로 먼저 체크하고
      UNSUPPORTED_CATEGORY_MESSAGE를 안내하는 것을 권장합니다.
    """
    return [
        rule for rule in all_rules
        if rule.equipment_category == equipment_category
    ]


def is_supported_category(equipment_category: str) -> bool:
    """안전점검 지원 대상 카테고리인지 확인합니다."""
    return equipment_category in SUPPORTED_CATEGORIES


# ==================== 2. 다음 점검일 계산 ====================
def calculate_next_due_at(
    last_checked_at: Optional[date],
    cycle_months: int,
) -> Optional[date]:
    """
    last_checked_at(사용자가 달력에서 선택한 이전 점검일) + cycle_months(점검 주기)로
    다음 점검 예정일을 계산합니다.

    last_checked_at이 None이면(점검 이력 없음, DB에 SafetyInspection row 자체가 없는 상태)
    None을 반환합니다. 화면에서는 "최초 점검 필요"로 표시하고 D-day 카운트다운은 표시하지 않습니다.
    """
    if last_checked_at is None:
        return None

    return last_checked_at + relativedelta(months=cycle_months)


def calculate_days_until_due(
    next_due_at: Optional[date],
    today: date,
) -> Optional[int]:
    """
    D-day 계산. next_due_at이 None이면(최초 점검 필요 상태) None 반환.
    양수: 남은 일수 (예: 17 -> "D-17")
    음수: 초과 일수 (예: -14 -> "D+14")
    """
    if next_due_at is None:
        return None

    return (next_due_at - today).days


# ==================== 3. 점검 상태 판정 ====================
def determine_inspection_status(
    next_due_at: Optional[date],
    today: date,
) -> InspectionCompletionStatus:
    """
    next_due_at 기준으로 pending/overdue를 판정합니다.

    주의:
    - "completed" 상태는 DB에 저장하지 않습니다. 점검 저장 직후의 완료 알림은
      프론트 토스트 메시지로만 처리하고("점검 완료! 다음 점검일: ..."),
      DB의 status는 항상 next_due_at 기준 미래 상태(pending/overdue)로만 둡니다.
    - next_due_at이 None인 경우(저장 시점엔 last_checked_at이 항상 입력되므로
      이론상 도달하지 않음) 안전하게 "pending"을 기본값으로 반환합니다.
    """
    if next_due_at is None:
        return "pending"

    days_left = (next_due_at - today).days
    return "overdue" if days_left < 0 else "pending"


# ==================== 4. 규칙 + 점검이력 결합 ====================
def build_inspection_items(
    rules: list[SafetyRule],
    inspections: list[SafetyInspection],
    today: date,
) -> list[dict]:
    """
    설비에 적용되는 모든 SafetyRule을 기준으로 순회하면서,
    매칭되는 SafetyInspection이 있으면 결합하고, 없으면 "점검일 입력 필요" 상태로 만듭니다.

    이 결과는 두 군데에서 쓰입니다.
    - 전체 목록 섹션("DB와 매칭된 점검 항목"): 이 결과를 그대로(필터/정렬 없이) 노출
    - 점검 우선순위 카드 섹션: sort_inspection_items_by_priority() + filter_priority_items()를
      거친 뒤 노출 (D-10 초과 항목은 우선순위 카드에서 제외, 전체 목록에는 남음)

    전제: (company_id, equipment_id, rule_id) 복합 유니크 제약으로 인해
    한 rule에 대한 inspection은 항상 최대 1개만 존재합니다 (덮어쓰기 방식).
    """
    inspection_by_rule_id = {insp.rule_id: insp for insp in inspections}

    items = []
    for rule in rules:
        inspection = inspection_by_rule_id.get(rule.rule_id)

        if inspection is None:
            items.append({
                "rule": rule,
                "inspection": None,
                "display_status": "점검일 입력 필요",
                "sub_message": None,
                "next_due_at": None,
                "days_left": None,
            })
        else:
            next_due_at = inspection.next_due_at
            days_left = calculate_days_until_due(next_due_at, today)
            is_overdue = inspection.status == "overdue"
            items.append({
                "rule": rule,
                "inspection": inspection,
                "display_status": "마감 초과" if is_overdue else "점검 임박",
                # 마감 초과는 "실제 미점검"과 "점검했지만 기록 누락"을 구분 못 하므로,
                # 사용자가 바로 행동(점검일 재입력)할 수 있도록 안내 문구를 같이 내려줌
                "sub_message": "이미 점검하셨다면 점검일을 입력해주세요" if is_overdue else None,
                "next_due_at": next_due_at,
                "days_left": days_left,
            })

    return items


# ==================== 5. 점검 우선순위 정렬 / 필터 ====================
RISK_LEVEL_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

# 점검 우선순위 카드에 노출할 D-day 임계값.
# 이 값을 초과해 여유가 있는 항목은 우선순위 카드에서 제외하고, 전체 목록에서만 노출.
PRIORITY_DUE_THRESHOLD_DAYS = 10


def calculate_priority_sort_key(item: dict) -> tuple:
    """
    점검 우선순위 정렬 키를 계산합니다. 작을수록 우선순위가 높음(앞쪽에 배치).

    그룹 0: next_due_at 없음(점검일 입력 필요) → risk_level 높은 순,
            동점이면 cycle_months 짧은 순(더 자주 점검해야 하는 항목 우선)
    그룹 1: next_due_at 있고 D-10 이내(마감초과 포함) → days_left 짧은 순
            (마감초과는 days_left가 음수라 자동으로 더 앞에 옴)
    그룹 2: next_due_at 있고 D-10 초과(여유 있음) → 우선순위 카드에서는 제외 대상이지만,
            정렬 자체는 안전하게 days_left 짧은 순으로 둠
    """
    days_left = item["days_left"]
    risk_level = item["rule"].risk_level
    cycle_months = item["rule"].cycle_months

    if days_left is None:
        return (0, RISK_LEVEL_ORDER.get(risk_level, 99), cycle_months)

    if days_left <= PRIORITY_DUE_THRESHOLD_DAYS:
        return (1, days_left, 0)

    return (2, days_left, 0)


def sort_inspection_items_by_priority(items: list[dict]) -> list[dict]:
    """build_inspection_items() 결과를 점검 우선순위 기준으로 정렬합니다."""
    return sorted(items, key=calculate_priority_sort_key)


def filter_priority_items(
    sorted_items: list[dict],
    max_days_threshold: int = PRIORITY_DUE_THRESHOLD_DAYS,
) -> list[dict]:
    """
    정렬된 items에서 점검 우선순위 카드에 노출할 항목만 필터링합니다.
    - days_left가 None(점검일 입력 필요)인 것은 포함
    - days_left가 max_days_threshold 이하인 것(마감초과 포함)은 포함
    - days_left가 max_days_threshold 초과인 것(여유 있음)은 제외 → 전체 목록에서만 노출
    """
    return [
        item for item in sorted_items
        if item["days_left"] is None or item["days_left"] <= max_days_threshold
    ]


def get_priority_dashboard_items(
    rules: list[SafetyRule],
    inspections: list[SafetyInspection],
    today: date,
) -> tuple[list[dict], list[dict]]:
    """
    전체 목록과 우선순위 카드용 목록을 한 번에 만들어 반환합니다.

    반환값: (전체_목록_정렬안함, 우선순위_카드용_정렬및필터됨)
    """
    all_items = build_inspection_items(rules, inspections, today)
    sorted_items = sort_inspection_items_by_priority(all_items)
    priority_items = filter_priority_items(sorted_items)
    return all_items, priority_items


# ==================== 6. 점검 저장 (라우터에서 호출) ====================
def prepare_inspection_save(
    last_checked_at: date,
    cycle_months: int,
    today: date,
) -> dict:
    """
    사용자가 달력에서 last_checked_at을 선택하고 "저장하기"를 눌렀을 때,
    DB에 upsert할 next_due_at / status를 계산해서 반환합니다.

    이 함수는 순수 계산만 하며, 실제 upsert는 라우터/DB 레이어에서 수행합니다.
    """
    next_due_at = calculate_next_due_at(last_checked_at, cycle_months)
    status = determine_inspection_status(next_due_at, today)

    return {
        "last_checked_at": last_checked_at,
        "next_due_at": next_due_at,
        "status": status,
    }
