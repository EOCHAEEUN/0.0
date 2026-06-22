"""
팩토핏 안전점검 계산 엔진 (Pure Logic)

이 파일은 안전점검 계산에 필요한 **순수 비즈니스 로직**만을 담고 있습니다.
LangChain, FastAPI, DB와는 완전히 독립적이며, 단순한 함수 호출만으로도 사용할 수 있습니다.

파일 내 함수 순서는 화면 위→아래 섹션 순서와 동일하게 정렬되어 있습니다.
    0. 기초 유틸 (카테고리 매칭, 날짜 계산, 상태 판정) — 다른 함수들의 재료
    1. build_inspection_items            → 모든 섹션의 공통 원본 데이터
    2. calculate_summary_counts          → 화면 "상단 요약 카드 5개" 섹션
    3. calculate_purpose_breakdown       → 화면 "분류별 점검 기록 현황" (막대그래프) 섹션
    4. sort/filter_priority_items        → 화면 "지금 처리해야 할 항목" (우선순위 카드) 섹션
       (※ "전체 점검 항목" 섹션은 build_inspection_items 결과를 그대로 사용, 별도 함수 없음)
    5. prepare_inspection_save           → "점검 기록하기" 버튼 클릭 후 저장 액션

이 파일은 services/equipment_safety.py에서 import되어 사용됩니다.
"""

from __future__ import annotations
from datetime import date
from typing import Optional, Union
from dateutil.relativedelta import relativedelta

from app.models.safety_common import InspectionCompletionStatus
from app.models.safety_rule_legal import SafetyRuleLegal
from app.models.safety_rule_voluntary import SafetyRuleVoluntary
from app.models.safety_check_status import SafetyCheckStatus

# legal/voluntary 두 룰 타입을 함수 시그니처에서 Union 없이 쓰기 위한 별명
AnyRule = Union[SafetyRuleLegal, SafetyRuleVoluntary]


# 안전점검을 지원하는 설비 카테고리 (capex.py의 supported 목록과 동일하게 유지)
SUPPORTED_CATEGORIES = ["press", "cnc", "injection"]
# common은 모든 설비에 공통 적용되는 룰 카테고리. SUPPORTED_CATEGORIES에는 포함하지 않음.
# (common은 설비 자체의 카테고리가 아니라 룰의 카테고리이기 때문에,
#  is_supported_category 체크 대상이 아님. get_applicable_rules에서 별도로 포함 처리함.)

UNSUPPORTED_CATEGORY_MESSAGE = (
    "현재 안전점검은 프레스, CNC, 사출성형기 설비만 지원합니다. "
    "설비명을 프레스/CNC/사출기 중 하나로 입력해주세요."
)

# 법정/자율점검 미이행 시 법적 책임 안내 문구 (rule_type 기준)
# "legal" → safety_rule_legal 테이블 항목, "voluntary" → safety_rule_voluntary 테이블 항목
# 주의: 법률 자문 미거친 일반 정보. 화면에 단정적 문구로 노출 전 노무사/법무 검토 필요.
LEGAL_PENALTY_INFO = {
    "legal": "안전조치 의무 위반 시 사업주 5년 이하 징역 또는 5천만원 이하 벌금, 사망사고 시 7년 이하 징역 또는 1억원 이하 벌금 (산업안전보건법 제38·39조, 제167·168조)",
    "voluntary": "법적 강제 점검 의무는 아니나, 미점검으로 사고가 발생할 경우 안전조치 의무 위반으로 처벌 책임이 발생할 수 있습니다.",
}

# risk_level(영문 코드값) -> 화면 노출용 한글 라벨
RISK_LEVEL_LABELS = {
    "critical": "위험도 매우 높음",
    "high": "위험도 높음",
    "medium": "위험도 보통",
}

RISK_LEVEL_ORDER = {"critical": 0, "high": 1, "medium": 2}

# 점검 우선순위 카드 및 "10일 이내 도래" 카드 기준 임계값.
# 이 값을 초과해 여유가 있는 항목은 우선순위 카드에서 제외하고, 전체 목록에서만 노출.
PRIORITY_DUE_THRESHOLD_DAYS = 10


# ==================== 0. 기초 유틸 ====================
def get_applicable_rules(
    equipment_category: str,
    all_rules: list[AnyRule],
) -> list[AnyRule]:
    """
    설비의 category(press/cnc/injection)와 일치하는 룰과
    모든 설비에 공통 적용되는 "common" 카테고리 룰을 함께 반환합니다.

    주의:
    - equipment_category는 capex.py의 normalize_equipment_category()를 거친
      정규화된 값("press"/"cnc"/"injection"/"unsupported")이어야 합니다.
    - "unsupported"인 경우 common 룰만 반환됩니다.
      호출 측(services/equipment_safety.py)에서 is_supported_category()로 먼저
      체크하고 UNSUPPORTED_CATEGORY_MESSAGE를 안내하는 것을 권장합니다.
    """
    return [
        rule for rule in all_rules
        if rule.equipment_category in (equipment_category, "common")
    ]


def is_supported_category(equipment_category: str) -> bool:
    """안전점검 지원 대상 카테고리인지 확인합니다."""
    return equipment_category in SUPPORTED_CATEGORIES


def calculate_next_due_at(
    last_checked_at: Optional[date],
    cycle_months: int,
) -> Optional[date]:
    """
    last_checked_at(사용자가 달력에서 선택한 이전 점검일) + cycle_months(점검 주기)로
    다음 점검 예정일을 계산합니다.

    last_checked_at이 None이면(점검 이력 없음, DB에 SafetyCheckStatus row 자체가 없는 상태)
    None을 반환합니다. 화면에서는 "점검 기록 없음"으로 표시하고 D-day 카운트다운은 표시하지 않습니다.
    """
    if last_checked_at is None:
        return None

    return last_checked_at + relativedelta(months=cycle_months)


def calculate_days_until_due(
    next_due_at: Optional[date],
    today: date,
) -> Optional[int]:
    """
    D-day 계산. next_due_at이 None이면(점검 기록 없음 상태) None 반환.
    양수: 남은 일수 (예: 17 -> "D-17")
    음수: 초과 일수 (예: -14 -> "D+14")
    """
    if next_due_at is None:
        return None

    return (next_due_at - today).days


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


# ==================== 1. 공통 원본 데이터 (rules + inspections 결합) ====================
def build_inspection_items(
    rules: list[AnyRule],
    check_statuses: list[SafetyCheckStatus],
    today: date,
    rule_type: str = "legal",
) -> list[dict]:
    """
    설비에 적용되는 모든 룰을 기준으로 순회하면서,
    매칭되는 SafetyCheckStatus가 있으면 결합하고, 없으면 "점검 기록 없음" 상태로 만듭니다.

    rule_type: "legal" 또는 "voluntary". 호출 측에서 명시적으로 전달합니다.
    각 item에 rule_type을 담아두어, calculate_summary_counts에서
    법정점검 기한초과(overdue_legal_count) 집계 시 활용합니다.

    이 함수의 결과(all_items)는 화면의 모든 섹션이 공유하는 단일 원본 데이터입니다.
    - 상단 요약 카드 5개 → calculate_summary_counts(all_items)
    - 분류별 점검 기록 현황 → calculate_purpose_breakdown(all_items)
    - 지금 처리해야 할 항목 → sort_inspection_items_by_priority(all_items) + filter
    - 전체 점검 항목 목록 → all_items를 그대로(필터/정렬 없이) 노출
    """
    status_by_rule_id = {cs.rule_id: cs for cs in check_statuses}

    items = []
    for rule in rules:
        check_status = status_by_rule_id.get(rule.rule_id)

        if check_status is None:
            items.append({
                "rule": rule,
                "rule_type": rule_type,
                "check_status": None,
                "display_status": "점검 기록 없음",
                "sub_message": None,
                "next_due_at": None,
                "days_left": None,
            })
        else:
            next_due_at = check_status.next_due_at
            days_left = calculate_days_until_due(next_due_at, today)
            is_overdue = check_status.status == "overdue"
            items.append({
                "rule": rule,
                "rule_type": rule_type,
                "check_status": check_status,
                "display_status": "기한 초과" if is_overdue else "기한 임박",
                "sub_message": "이미 점검하셨다면 점검일을 입력해주세요" if is_overdue else None,
                "next_due_at": next_due_at,
                "days_left": days_left,
            })

    return items


# ==================== 2. 상단 요약 카드 5개 (법정점검 기한초과 / 기한초과 / 10일 이내 도래 / 점검 기록 없음 / 완료) ====================
def calculate_summary_counts(all_items: list[dict]) -> dict:
    """
    build_inspection_items()의 결과(all_items)를 받아서,
    화면 상단 5개 카드에 필요한 개수를 집계합니다.

    카드 간 관계:
    - "법정점검 기한초과"는 "기한초과"의 부분집합입니다 (법정+자율 중 법정만).
    - "10일 이내 도래"는 PRIORITY_DUE_THRESHOLD_DAYS(10) 이내이며 아직 마감이
      지나지 않은(0 <= days_left <= 10) 항목만 카운트합니다 (기한초과와 중복 없음).
    - "점검 기록 없음"은 last_checked_at이 비어있는 항목(= inspection이 None)입니다.
    - "완료"는 기한초과/도래 상태가 아닌, 여유 있게 정상 상태인 항목입니다.
    """
    overdue_legal_count = 0
    overdue_count = 0
    due_soon_count = 0
    no_record_count = 0
    completed_count = 0

    for item in all_items:
        rule = item["rule"]
        days_left = item["days_left"]

        if item["check_status"] is None:
            no_record_count += 1
            continue

        if days_left is not None and days_left < 0:
            overdue_count += 1
            if item["rule_type"] == "legal":
                overdue_legal_count += 1
        elif days_left is not None and 0 <= days_left <= PRIORITY_DUE_THRESHOLD_DAYS:
            due_soon_count += 1
        else:
            completed_count += 1

    return {
        "overdue_legal_count": overdue_legal_count,
        "overdue_count": overdue_count,
        "due_soon_count": due_soon_count,
        "no_record_count": no_record_count,
        "completed_count": completed_count,
    }


# ==================== 3. 분류별 점검 기록 현황 (막대그래프) ====================
def calculate_purpose_breakdown(all_items: list[dict]) -> list[dict]:
    """
    build_inspection_items()의 결과(all_items)를 inspection_purpose
    (안전장치점검/유지보수점검/안전교육) 기준으로 묶어서, 각 그룹의
    "미완료 건수 / 전체 건수"를 계산합니다. 화면의 막대그래프 섹션용입니다.

    "미완료"의 정의: 기한 초과(overdue) 또는 점검 기록 없음(inspection is None).
    "기한 임박"(아직 마감 전)은 미완료로 집계하지 않습니다 — 아직 처리할 시간이
    남아있는 정상 상태이기 때문입니다.

    반환값 예시:
    [
        {"purpose": "안전장치점검", "incomplete_count": 3, "total_count": 6},
        {"purpose": "유지보수점검", "incomplete_count": 1, "total_count": 5},
        {"purpose": "안전교육", "incomplete_count": 0, "total_count": 1},
    ]
    그룹 순서는 안전장치점검 → 유지보수점검 → 안전교육으로 고정합니다
    (화면 디자인의 고정 순서와 맞추기 위함).
    """
    PURPOSE_ORDER = ["안전장치점검", "유지보수점검", "안전교육"]

    breakdown = {p: {"incomplete_count": 0, "total_count": 0} for p in PURPOSE_ORDER}

    for item in all_items:
        purpose = item["rule"].inspection_purpose
        if purpose not in breakdown:
            # 스키마에 정의되지 않은 값이 들어온 경우를 대비한 방어적 처리
            breakdown[purpose] = {"incomplete_count": 0, "total_count": 0}

        breakdown[purpose]["total_count"] += 1

        is_incomplete = item["check_status"] is None or (
            item["check_status"].status == "overdue"
        )
        if is_incomplete:
            breakdown[purpose]["incomplete_count"] += 1

    return [
        {"purpose": purpose, **counts}
        for purpose, counts in breakdown.items()
        if counts["total_count"] > 0  # 해당 설비에 룰이 없는 그룹은 노출하지 않음
    ]


# ==================== 4. 지금 처리해야 할 항목 (우선순위 카드 정렬/필터) ====================
def calculate_priority_sort_key(item: dict) -> tuple:
    """
    점검 우선순위 정렬 키를 계산합니다. 작을수록 우선순위가 높음(앞쪽에 배치).

    그룹 0: next_due_at 있고 D-10 이내(기한초과 포함) → days_left 짧은 순
            (기한초과는 days_left가 음수라 자동으로 더 앞에 옴)
    그룹 1: next_due_at 없음(점검 기록 없음) → risk_level 높은 순,
            동점이면 cycle_months 짧은 순(더 자주 점검해야 하는 항목 우선)
    그룹 2: next_due_at 있고 D-10 초과(여유 있음) → 우선순위 카드에서는 제외 대상이지만,
            정렬 자체는 안전하게 days_left 짧은 순으로 둠

    화면 순서: 기한초과 → 기한임박(D-10 이내) → 점검 기록 없음 → 여유 있음
    """
    days_left = item["days_left"]
    risk_level = item["rule"].risk_level
    cycle_months = item["rule"].cycle_months

    if days_left is not None and days_left <= PRIORITY_DUE_THRESHOLD_DAYS:
        return (0, days_left, 0)

    if days_left is None:
        return (1, RISK_LEVEL_ORDER.get(risk_level, 99), cycle_months)

    return (2, days_left, 0)


def sort_inspection_items_by_priority(items: list[dict]) -> list[dict]:
    """build_inspection_items() 결과를 점검 우선순위 기준으로 정렬합니다."""
    return sorted(items, key=calculate_priority_sort_key)


def filter_priority_items(
    sorted_items: list[dict],
    max_days_threshold: int = PRIORITY_DUE_THRESHOLD_DAYS,
) -> list[dict]:
    """
    정렬된 items에서 "지금 처리해야 할 항목" 카드에 노출할 항목만 필터링합니다.
    - days_left가 None(점검 기록 없음)인 것은 포함
    - days_left가 max_days_threshold 이하인 것(기한초과 포함)은 포함
    - days_left가 max_days_threshold 초과인 것(여유 있음)은 제외 → 전체 목록에서만 노출
    """
    return [
        item for item in sorted_items
        if item["days_left"] is None or item["days_left"] <= max_days_threshold
    ]


def get_priority_dashboard_items(
    rules: list[AnyRule],
    check_statuses: list[SafetyCheckStatus],
    today: date,
    rule_type: str = "legal",
) -> tuple[list[dict], list[dict]]:
    """
    전체 목록과 우선순위 카드용 목록을 한 번에 만들어 반환합니다.

    반환값: (전체_목록_정렬안함, 우선순위_카드용_정렬및필터됨)
    """
    all_items = build_inspection_items(rules, check_statuses, today, rule_type)
    sorted_items = sort_inspection_items_by_priority(all_items)
    priority_items = filter_priority_items(sorted_items)
    return all_items, priority_items


# ==================== 5. 점검 기록하기 (저장 액션) ====================
def prepare_inspection_save(
    last_checked_at: date,
    cycle_months: int,
    today: date,
) -> dict:
    """
    사용자가 달력에서 last_checked_at을 선택하고 "점검 기록하기"를 눌렀을 때,
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


# ==================== 6. 달력 보기 (날짜별 그룹핑) ====================
def group_items_by_date(items: list[dict]) -> dict[date, list[dict]]:
    """
    items를 next_due_at 날짜별로 묶어서 캘린더에서 쓸 수 있는 형태로 만듭니다.

    "점검 일정" 섹션의 달력 보기(선택된 설비 하나)에서 사용합니다.
    items에 build_inspection_items()의 결과(단일 설비)를 그대로 넣으면 됩니다.

    next_due_at이 None인 항목(점검 기록 없음)은 캘린더에 표시할 날짜가 없으므로
    제외됩니다 — 이 항목들은 "점검 기록 없음" 카드/목록에서만 노출됩니다.
    """
    grouped: dict[date, list[dict]] = {}
    for item in items:
        due = item["next_due_at"]
        if due is None:
            continue
        grouped.setdefault(due, []).append(item)
    return grouped


def group_items_by_date_with_equipment(
    items_by_equipment: list[tuple[str, list[dict]]],
) -> dict[date, list[dict]]:
    """
    여러 설비의 items를 합쳐서 날짜별로 묶습니다.

    "달력 전체 보기"(전체 설비 통합)에서 사용합니다.
    items_by_equipment는 [(equipment_name, all_items), ...] 형태로,
    각 설비마다 build_inspection_items()를 따로 호출한 결과를 모아서 넘깁니다.

    각 item에 equipment_name을 추가해서, 같은 날짜에 여러 설비의 점검이
    겹쳐도 어느 설비 항목인지 화면에서 구분할 수 있게 합니다.
    """
    grouped: dict[date, list[dict]] = {}
    for equipment_name, items in items_by_equipment:
        for item in items:
            due = item["next_due_at"]
            if due is None:
                continue
            enriched_item = {**item, "equipment_name": equipment_name}
            grouped.setdefault(due, []).append(enriched_item)
    return grouped


# ==================== 7. 작업 전 체크리스트 ====================
def build_pre_work_checklist(
    legal_rules: list,
    voluntary_rules: list,
    inspection_records: list,
    today: date,
) -> list[dict]:
    """
    pre_work_check_required=True인 룰만 필터링해서 오늘 체크 여부와 함께 반환합니다.

    checked_today 판단 기준:
    - safety_check_status의 last_checked_at이 오늘 날짜면 True
    - 기록이 없거나 오늘 날짜가 아니면 False

    inspection_type을 체크 단위(제목)로, check_item을 세부 설명으로 사용합니다.
    """
    status_by_rule_id = {r.rule_id: r for r in inspection_records}

    items = []

    for rule in legal_rules:
        if not getattr(rule, "pre_work_check_required", False):
            continue
        record = status_by_rule_id.get(rule.rule_id)
        checked_today = (
            record is not None
            and record.last_checked_at == today
        )
        items.append({
            "rule_id": rule.rule_id,
            "rule_type": "legal",
            "inspection_type": rule.inspection_type,
            "check_item": rule.check_item,
            "risk_level": rule.risk_level,
            "checked_today": checked_today,
        })

    for rule in voluntary_rules:
        if not getattr(rule, "pre_work_check_required", False):
            continue
        record = status_by_rule_id.get(rule.rule_id)
        checked_today = (
            record is not None
            and record.last_checked_at == today
        )
        items.append({
            "rule_id": rule.rule_id,
            "rule_type": "voluntary",
            "inspection_type": rule.inspection_type,
            "check_item": rule.check_item,
            "risk_level": rule.risk_level,
            "checked_today": checked_today,
        })

    # 위험도 높은 순으로 정렬 (critical → high → medium)
    return sorted(items, key=lambda x: RISK_LEVEL_ORDER.get(x["risk_level"] or "medium", 99))
