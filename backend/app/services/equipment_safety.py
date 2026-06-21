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
- 추후 roi/policy/draft도 AI 어드바이저 채팅 기능이 추가되면
  같은 패턴(services/ 분리)으로 리팩토링될 수 있습니다.

capex.py와 동일한 책임 분리 원칙을 따릅니다.
- 계산 로직(tools/safety_calc.py)은 이 파일과 독립적으로 테스트 가능
- 이 파일은 DB 조회 + 계산 함수 호출 + 응답 조립만 담당
"""

from __future__ import annotations
from datetime import date

from app.core.database import get_db
from app.agents.capex import normalize_equipment_category
from app.models.safety import (
    SafetyRule,
    SafetyInspection,
    SafetyDashboardItem,
    SafetyDashboardSummary,
    SafetyDashboardResponse,
)
from app.tools.safety_calc import (
    get_applicable_rules,
    is_supported_category,
    get_priority_dashboard_items,
    UNSUPPORTED_CATEGORY_MESSAGE,
    RISK_LEVEL_LABELS,
)


# ==================== DB 조회 ====================
def fetch_all_safety_rules() -> list[SafetyRule]:
    """safety_rule 테이블 전체를 조회합니다. (설비 카테고리별 필터링은 이후 safety_calc에서 처리)"""
    db = get_db()
    result = db.table("safety_rule").select("*").execute()
    return [SafetyRule(**row) for row in result.data]


def fetch_inspections(company_id: str, equipment_id: str) -> list[SafetyInspection]:
    """특정 회사의 특정 설비에 대한 점검 이력을 조회합니다."""
    db = get_db()
    result = (
        db.table("safety_inspection")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .execute()
    )
    return [SafetyInspection(**row) for row in result.data]


def fetch_all_equipments(company_id: str) -> list[dict]:
    """회사가 등록한 전체 설비 목록을 조회합니다. (대시보드 좌측 "등록 설비 선택" 영역용)"""
    db = get_db()
    result = db.table("equipment").select("*").eq("company_id", company_id).execute()
    return result.data


# ==================== 설비 1대 기준 대시보드 아이템 조립 ====================
def build_dashboard_item_for_equipment(
    equipment: dict,
    all_rules: list[SafetyRule],
    company_id: str,
    today: date,
) -> SafetyDashboardItem | None:
    """
    설비 1대에 대한 SafetyDashboardItem을 조립합니다.
    category가 지원 대상이 아니면 None을 반환합니다 (호출 측에서 처리 필요).
    """
    # 주의: 현재 설비 등록 시점(routers/equipment.py)에서는 category가 정규화되지 않고
    # 사용자가 입력한 원본 텍스트("프레스 1호기" 등)가 그대로 DB에 저장될 수 있습니다.
    # capex.py와 동일하게, 여기서도 정규화를 거쳐야 "press"/"cnc"/"injection" 외
    # 텍스트가 잘못 unsupported로 분류되는 것을 방지할 수 있습니다.
    # TODO: 근본 해결책은 등록 라우터에서 저장 시점에 정규화하는 것 (승유님 전달 필요).
    equipment_category = normalize_equipment_category(
        equipment.get("category", ""),
        equipment.get("name", ""),
    )

    if not is_supported_category(equipment_category):
        return None

    applicable_rules = get_applicable_rules(equipment_category, all_rules)
    inspections = fetch_inspections(company_id, equipment["equipment_id"])

    all_items, priority_items = get_priority_dashboard_items(
        applicable_rules, inspections, today
    )

    # risk_factor, safety_score 계산은 별도 함수로 분리 예정
    # (현재는 최소 동작 버전으로, 추후 정교화)
    risk_factors = []  # TODO: build_risk_factors() 구현 필요
    safety_score = 0   # TODO: calculate_safety_score() 구현 필요

    return SafetyDashboardItem(
        equipment_id=equipment["equipment_id"],
        equipment_name=equipment["name"],
        equipment_category=equipment_category,
        age_years=equipment["age_years"],
        safety_score=safety_score,
        status="normal",  # TODO: safety_score 기준으로 계산
        replacement_reasons=[],  # v1 미사용
        risk_factors=risk_factors,
        rules=applicable_rules,
        inspections=inspections,
    )


# ==================== 전체 대시보드 조립 ====================
def get_safety_dashboard(company_id: str, today: date | None = None) -> SafetyDashboardResponse:
    """
    GET /safety/dashboard 의 핵심 로직.
    회사의 전체 설비에 대해 SafetyDashboardItem을 만들고 SafetyDashboardResponse로 합칩니다.
    """
    if today is None:
        today = date.today()

    equipments = fetch_all_equipments(company_id)
    all_rules = fetch_all_safety_rules()

    items: list[SafetyDashboardItem] = []
    unsupported_equipment_names: list[str] = []

    for equipment in equipments:
        item = build_dashboard_item_for_equipment(equipment, all_rules, company_id, today)
        if item is None:
            unsupported_equipment_names.append(equipment["name"])
            continue
        items.append(item)

    summary = SafetyDashboardSummary(
        average_score=int(sum(i.safety_score for i in items) / len(items)) if items else 0,
        normal_count=sum(1 for i in items if i.status == "normal"),
        warning_count=sum(1 for i in items if i.status == "warning"),
        danger_count=sum(1 for i in items if i.status == "danger"),
        total_rules=sum(len(i.rules) for i in items),
        overdue_count=sum(
            1 for i in items for insp in i.inspections if insp.status == "overdue"
        ),
    )

    return SafetyDashboardResponse(
        company_id=company_id,
        summary=summary,
        items=items,
        unsupported_equipment_names=unsupported_equipment_names,
    )
