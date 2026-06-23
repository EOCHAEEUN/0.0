"""
팩토핏 안전점검 서비스 레이어

이 파일은 DB 조회와 tools/safety_calc.py의 순수 계산 함수들을 조립해서
SafetyDashboardResponse를 만드는 역할을 합니다.

services/ 레이어에 두는 이유:
- 안전점검 데이터는 routers/safety.py(대시보드 API)와
  agents/equipment_safety.py(추후 추가될 AI 어드바이저 채팅 노드)
  양쪽에서 공유해서 써야 합니다.
- roi(capex)/policy/draft는 현재 agents/ 채팅 흐름 단일 경로만 있어서
  agents/ 안에 계산 로직을 직접 두지만, 안전점검은 API와 채팅 두 경로가
  같은 데이터 조립 로직을 공유해야 하므로 services/로 분리합니다.

capex.py와 동일한 책임 분리 원칙을 따릅니다.
- 계산 로직(tools/safety_calc.py)은 이 파일과 독립적으로 테스트 가능
- 이 파일은 DB 조회 + 계산 함수 호출 + 응답 조립만 담당

섹션 순서:
    1. DB 조회
    2. 설비 1대 대시보드 조립
    3. 전체 대시보드 조립
    4. 작업 전 체크리스트 조회
    5. 점검 기록 저장
"""

from __future__ import annotations
from datetime import date

from app.core.database import get_db
from app.agents.capex import normalize_equipment_category
from app.models.safety import (
    SafetyDashboardItem,
    SafetyDashboardSummary,
    SafetyDashboardResponse,
    PreWorkChecklistItem,
    PreWorkChecklistResponse,
)
from app.models.safety_rule_legal import SafetyRuleLegal
from app.models.safety_rule_voluntary import SafetyRuleVoluntary
from app.models.safety_check_status import SafetyCheckStatus, SafetyCheckStatusSaveRequest
from app.tools.safety_calc import (
    get_applicable_rules,
    is_supported_category,
    build_inspection_items,
    calculate_summary_counts,
    calculate_purpose_breakdown,
    sort_inspection_items_by_priority,
    filter_priority_items,
    group_items_by_date_with_equipment,
    prepare_inspection_save,
    build_pre_work_checklist,
    UNSUPPORTED_CATEGORY_MESSAGE,
)


# ==================== 1. DB 조회 ====================
def fetch_legal_rules() -> list[SafetyRuleLegal]:
    """safety_rule_legal 테이블 전체를 조회합니다."""
    db = get_db()
    result = db.table("safety_rule_legal").select("*").execute()
    return [SafetyRuleLegal(**row) for row in result.data]


def fetch_voluntary_rules() -> list[SafetyRuleVoluntary]:
    """safety_rule_voluntary 테이블 전체를 조회합니다."""
    db = get_db()
    result = db.table("safety_rule_voluntary").select("*").execute()
    return [SafetyRuleVoluntary(**row) for row in result.data]


def fetch_check_statuses(company_id: str, equipment_id: str) -> list[SafetyCheckStatus]:
    """특정 회사의 특정 설비에 대한 점검 이력을 조회합니다."""
    db = get_db()
    result = (
        db.table("safety_check_status")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .execute()
    )
    return [SafetyCheckStatus(**row) for row in result.data]


def fetch_all_equipments(company_id: str) -> list[dict]:
    """회사가 등록한 전체 설비 목록을 조회합니다. (대시보드 우측 "등록 설비 선택" 영역용)"""
    db = get_db()
    result = db.table("equipment").select("*").eq("company_id", company_id).execute()
    return result.data


# ==================== 2. 설비 1대 기준 대시보드 아이템 조립 ====================
def build_dashboard_item_for_equipment(
    equipment: dict,
    all_legal_rules: list[SafetyRuleLegal],
    all_voluntary_rules: list[SafetyRuleVoluntary],
    company_id: str,
    today: date,
) -> SafetyDashboardItem | None:
    """
    설비 1대에 대한 SafetyDashboardItem을 조립합니다.
    category가 지원 대상이 아니면 None을 반환합니다 (호출 측에서 처리 필요).

    legal/voluntary 두 룰 테이블을 각각 필터링 후 build_inspection_items를 두 번 호출해서
    all_items로 합칩니다. rule_type을 각각 "legal"/"voluntary"로 태깅하므로,
    calculate_summary_counts에서 overdue_legal_count 집계가 정확히 동작합니다.
    """
    equipment_category = normalize_equipment_category(
        equipment.get("category", ""),
        equipment.get("name", ""),
    )

    if not is_supported_category(equipment_category):
        return None

    legal_rules = get_applicable_rules(equipment_category, all_legal_rules)
    voluntary_rules = get_applicable_rules(equipment_category, all_voluntary_rules)
    inspection_records = fetch_check_statuses(company_id, equipment["equipment_id"])

    # legal/voluntary 각각 rule_type 태깅해서 items 생성 후 합치기
    legal_items = build_inspection_items(legal_rules, inspection_records, today, rule_type="legal")
    voluntary_items = build_inspection_items(voluntary_rules, inspection_records, today, rule_type="voluntary")
    all_items = legal_items + voluntary_items

    sorted_items = sort_inspection_items_by_priority(all_items)
    priority_items = filter_priority_items(sorted_items)

    summary_counts = calculate_summary_counts(all_items)
    purpose_breakdown = calculate_purpose_breakdown(all_items)

    return SafetyDashboardItem(
        equipment_id=equipment["equipment_id"],
        equipment_name=equipment["name"],
        equipment_category=equipment_category,
        age_years=equipment["age_years"],
        total_rule_count=len(legal_rules) + len(voluntary_rules),
        summary_counts=summary_counts,
        purpose_breakdown=purpose_breakdown,
        priority_items=priority_items,
        all_items=all_items,
        legal_rules=legal_rules,
        voluntary_rules=voluntary_rules,
        inspection_records=inspection_records,
    )


# ==================== 3. 전체 대시보드 조립 ====================
def get_safety_dashboard(company_id: str, today: date | None = None) -> SafetyDashboardResponse:
    """
    GET /safety/dashboard 의 핵심 로직.
    회사의 전체 설비에 대해 SafetyDashboardItem을 만들고 SafetyDashboardResponse로 합칩니다.

    회사 레벨 summary(상단 통계)는 설비별 summary_counts를 그대로 합산해서 만듭니다.
    """
    if today is None:
        today = date.today()

    equipments = fetch_all_equipments(company_id)
    all_legal_rules = fetch_legal_rules()
    all_voluntary_rules = fetch_voluntary_rules()

    items: list[SafetyDashboardItem] = []
    unsupported_equipment_names: list[str] = []

    for equipment in equipments:
        item = build_dashboard_item_for_equipment(
            equipment, all_legal_rules, all_voluntary_rules, company_id, today
        )
        if item is None:
            unsupported_equipment_names.append(equipment["name"])
            continue
        items.append(item)

    summary = SafetyDashboardSummary(
        total_equipment_count=len(items),
        overdue_legal_count=sum(i.summary_counts["overdue_legal_count"] for i in items),
        overdue_count=sum(i.summary_counts["overdue_count"] for i in items),
        due_soon_count=sum(i.summary_counts["due_soon_count"] for i in items),
        no_record_count=sum(i.summary_counts["no_record_count"] for i in items),
        completed_count=sum(i.summary_counts["completed_count"] for i in items),
    )

    # "달력 전체 보기" 진입점용. 위에서 설비별로 이미 만든 all_items를 재사용해서
    # equipment_name 기준으로 다시 합치므로, DB 재조회나 추가 계산이 들지 않음.
    company_calendar_view = group_items_by_date_with_equipment([
        (item.equipment_name, item.all_items) for item in items
    ])

    return SafetyDashboardResponse(
        company_id=company_id,
        summary=summary,
        items=items,
        company_calendar_view=company_calendar_view,
        unsupported_equipment_names=unsupported_equipment_names,
    )


# ==================== 4. 작업 전 체크리스트 조회 ====================
def get_pre_work_checklist(
    company_id: str,
    equipment_id: str,
    today: date | None = None,
) -> PreWorkChecklistResponse:
    """
    GET /safety/pre-work-checklist 의 핵심 로직.
    pre_work_check_required=True인 룰들을 뽑아 오늘 체크 여부와 함께 반환합니다.
    """
    if today is None:
        today = date.today()

    db = get_db()
    eq_result = (
        db.table("equipment")
        .select("*")
        .eq("equipment_id", equipment_id)
        .eq("company_id", company_id)
        .single()
        .execute()
    )
    if not eq_result.data:
        raise ValueError(f"존재하지 않는 equipment_id입니다: {equipment_id}")

    equipment = eq_result.data
    equipment_category = normalize_equipment_category(
        equipment.get("category", ""),
        equipment.get("name", ""),
    )

    all_legal_rules = fetch_legal_rules()
    all_voluntary_rules = fetch_voluntary_rules()
    legal_rules = get_applicable_rules(equipment_category, all_legal_rules)
    voluntary_rules = get_applicable_rules(equipment_category, all_voluntary_rules)
    inspection_records = fetch_check_statuses(company_id, equipment_id)

    checklist_items = build_pre_work_checklist(
        legal_rules, voluntary_rules, inspection_records, today
    )

    return PreWorkChecklistResponse(
        equipment_id=equipment_id,
        equipment_name=equipment["name"],
        date=today.isoformat(),
        items=[PreWorkChecklistItem(**item) for item in checklist_items],
        total_count=len(checklist_items),
        checked_count=sum(1 for item in checklist_items if item["checked_today"]),
    )


# ==================== 5. 점검 기록 저장 ("점검 기록하기" 버튼) ====================
def fetch_rule_by_id(rule_id: str, rule_type: str) -> SafetyRuleLegal | SafetyRuleVoluntary:
    """
    rule_id와 rule_type으로 룰 1개를 조회합니다.
    rule_type에 따라 safety_rule_legal / safety_rule_voluntary 테이블을 선택합니다.
    cycle_months는 사용자 입력으로 받지 않고 여기서 신뢰할 수 있는 값을 가져옵니다
    (클라이언트가 임의로 주기를 조작해서 보내는 것을 방지).
    """
    db = get_db()
    table_name = "safety_rule_legal" if rule_type == "legal" else "safety_rule_voluntary"
    result = db.table(table_name).select("*").eq("rule_id", rule_id).single().execute()
    if not result.data:
        raise ValueError(f"존재하지 않는 rule_id입니다: {rule_id} (rule_type={rule_type})")
    if rule_type == "legal":
        return SafetyRuleLegal(**result.data)
    return SafetyRuleVoluntary(**result.data)


def save_check_status(
    company_id: str,
    request: SafetyCheckStatusSaveRequest,
    today: date | None = None,
) -> SafetyCheckStatus:
    """
    "점검 기록하기" 버튼 클릭 시 호출됩니다.
    (company_id, equipment_id, rule_id) 복합 유니크 제약을 이용해 upsert합니다
    (기존 기록이 있으면 덮어쓰고, 없으면 새로 생성).

    equipment_id는 필수입니다. None이면 어느 설비 기록인지 특정할 수 없어
    다른 설비 기록을 덮어쓸 위험이 있으므로 ValueError를 발생시킵니다.
    """
    if today is None:
        today = date.today()

    if not request.equipment_id:
        raise ValueError("equipment_id는 필수입니다. 어느 설비의 점검인지 명시해주세요.")

    rule = fetch_rule_by_id(request.rule_id, request.rule_type)
    calculated = prepare_inspection_save(request.last_checked_at, rule.cycle_months, today)

    db = get_db()
    payload = {
        "company_id": str(company_id),
        "equipment_id": str(request.equipment_id) if request.equipment_id else None,
        "rule_type": request.rule_type,
        "rule_id": request.rule_id,
        "is_conducting": request.is_conducting,
        "last_checked_at": calculated["last_checked_at"].isoformat(),
        "next_due_at": calculated["next_due_at"].isoformat(),
        "status": calculated["status"],
        "assignee": request.assignee,
        "memo": request.memo,
        "evidence_file_url": request.evidence_file_url,
    }

    # 작업 전 점검일 때만 추가 (None으로 덮어쓰는 것 방지)
    if request.is_pre_work_check:
        payload["pre_work_checked_date"] = request.last_checked_at.isoformat()
        
    result = (
        db.table("safety_check_status")
        .upsert(payload, on_conflict="company_id,equipment_id,rule_id")
        .execute()
    )

    return SafetyCheckStatus(**result.data[0])
