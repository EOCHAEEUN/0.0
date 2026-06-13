from datetime import date
from typing import Any

from fastapi import APIRouter, Query

from app.core.database import get_db

router = APIRouter()


DEMO_EQUIPMENTS = [
    {
        "equipment_id": "demo-equipment-press-001",
        "name": "유압프레스 250톤",
        "category": "press",
        "age_years": 15,
        "defect_rate": 3.4,
        "maintenance_status": "누유 의심",
        "safety_device_status": "방호장치 재확인 필요",
        "worker_training_status": "신규 작업자 교육 예정",
    },
    {
        "equipment_id": "demo-equipment-cnc-001",
        "name": "CNC 머시닝센터 5축",
        "category": "cnc",
        "age_years": 9,
        "defect_rate": 1.6,
        "maintenance_status": "정상",
        "safety_device_status": "인터록 정상",
        "worker_training_status": "정기교육 완료",
    },
    {
        "equipment_id": "demo-equipment-injection-001",
        "name": "전동식 사출성형기 450톤",
        "category": "injection",
        "age_years": 12,
        "defect_rate": 2.8,
        "maintenance_status": "안전문 센서 점검 필요",
        "safety_device_status": "인터록 점검 지연",
        "worker_training_status": "작업표준서 개정 필요",
    },
]


DEMO_RULES = [
    {
        "rule_id": "safety-rule-press-guard-001",
        "equipment_category": "press",
        "equipment_name_keywords": ["유압프레스", "프레스", "press"],
        "inspection_type": "방호장치 점검",
        "check_item": "양수조작식 방호장치, 광전자식 방호장치, 비상정지장치 작동 상태 확인",
        "cycle_months": 1,
        "risk_level": "critical",
        "legal_basis": "산업안전보건기준에 관한 규칙의 프레스 및 전단기 방호조치 취지",
        "source_url": "https://www.law.go.kr/",
        "note": "법령 조항은 운영 전 최종 확인이 필요합니다.",
        "basis_type": "law",
        "legal_article": "산업안전보건기준에 관한 규칙: 프레스 등 방호조치 관련 조항",
        "source_name": "국가법령정보센터",
        "evidence_text": "프레스 작업 위험점에 접근하지 않도록 방호장치를 설치하고 정상 작동을 확인해야 한다는 취지의 기준입니다.",
    },
    {
        "rule_id": "safety-rule-press-hydraulic-002",
        "equipment_category": "press",
        "equipment_name_keywords": ["유압프레스", "압력계", "유압"],
        "inspection_type": "유압계통 점검",
        "check_item": "유압 누유, 압력계, 배관, 실린더 이상 여부 확인",
        "cycle_months": 3,
        "risk_level": "high",
        "legal_basis": "KOSHA 프레스 작업 안전 관련 기술자료",
        "source_url": "https://www.kosha.or.kr/",
        "note": "공식자료 참고 항목이며 법정점검으로 단정하지 않습니다.",
        "basis_type": "official_guide",
        "legal_article": None,
        "source_name": "한국산업안전보건공단",
        "evidence_text": "프레스 설비의 유압계통 이상은 끼임 및 낙하 위험으로 이어질 수 있어 정기 확인이 필요합니다.",
    },
    {
        "rule_id": "safety-rule-press-worker-003",
        "equipment_category": "press",
        "equipment_name_keywords": ["작업자", "프레스"],
        "inspection_type": "작업자 안전교육",
        "check_item": "프레스 작업 전 안전수칙, 금형 교체 절차, 비상정지 대응 교육 이수 확인",
        "cycle_months": 6,
        "risk_level": "high",
        "legal_basis": "산업안전보건법의 안전보건교육 의무 취지",
        "source_url": "https://www.law.go.kr/",
        "note": "안전보건교육 의무에 근거하되 설비별 세부 항목은 내부 점검표와 함께 운영합니다.",
        "basis_type": "law",
        "legal_article": "산업안전보건법: 안전보건교육 관련 조항",
        "source_name": "국가법령정보센터",
        "evidence_text": "사업주는 근로자에게 작업 안전에 필요한 교육을 실시해야 한다는 취지의 법령 기준입니다.",
    },
    {
        "rule_id": "safety-rule-cnc-interlock-001",
        "equipment_category": "cnc",
        "equipment_name_keywords": ["CNC", "머시닝센터", "machining center"],
        "inspection_type": "도어 인터록 점검",
        "check_item": "가공 중 도어 인터록, 칩 커버, 비상정지 버튼 작동 상태 확인",
        "cycle_months": 1,
        "risk_level": "high",
        "legal_basis": "KOSHA 기계설비 안전 일반 지침 참고",
        "source_url": "https://www.kosha.or.kr/",
        "note": "직접 법령 조항 미확인. 공식자료 참고 항목으로 표시합니다.",
        "basis_type": "official_guide",
        "legal_article": None,
        "source_name": "한국산업안전보건공단",
        "evidence_text": "회전체와 절삭칩 비산 위험이 있는 설비는 덮개, 인터록, 비상정지장치 상태 확인이 권장됩니다.",
    },
    {
        "rule_id": "safety-rule-cnc-spindle-002",
        "equipment_category": "cnc",
        "equipment_name_keywords": ["CNC", "스핀들", "툴"],
        "inspection_type": "가공부 상태 점검",
        "check_item": "스핀들 진동, 공구 체결, 절삭유 누유, 칩 배출 상태 확인",
        "cycle_months": 3,
        "risk_level": "medium",
        "legal_basis": None,
        "source_url": None,
        "note": "제조사 매뉴얼 또는 내부 보전 기준으로 운영합니다.",
        "basis_type": "self_check",
        "legal_article": None,
        "source_name": "FactoFit demo self-check",
        "evidence_text": "고속 회전부와 공구 체결 상태는 품질 및 작업자 안전에 영향을 주므로 자율점검 항목으로 관리합니다.",
    },
    {
        "rule_id": "safety-rule-injection-door-001",
        "equipment_category": "injection",
        "equipment_name_keywords": ["사출성형기", "injection", "도어"],
        "inspection_type": "안전문 및 인터록 점검",
        "check_item": "안전문 인터록, 금형 구역 접근 차단, 비상정지 버튼 작동 상태 확인",
        "cycle_months": 1,
        "risk_level": "high",
        "legal_basis": "KOSHA 기계설비 끼임 위험 예방 자료 참고",
        "source_url": "https://www.kosha.or.kr/",
        "note": "직접 법령 조항 미확인. 공식자료 참고 항목으로 표시합니다.",
        "basis_type": "official_guide",
        "legal_article": None,
        "source_name": "한국산업안전보건공단",
        "evidence_text": "금형 개폐부 접근 시 끼임 위험이 있어 안전문과 인터록 상태 확인이 필요합니다.",
    },
    {
        "rule_id": "safety-rule-injection-heater-002",
        "equipment_category": "injection",
        "equipment_name_keywords": ["사출성형기", "히터", "온도"],
        "inspection_type": "히터 및 온도제어 점검",
        "check_item": "히터 과열, 온도센서, 전장부 절연, 냉각수 누수 상태 확인",
        "cycle_months": 3,
        "risk_level": "medium",
        "legal_basis": None,
        "source_url": None,
        "note": "제조사 매뉴얼 또는 내부 보전 기준으로 운영합니다.",
        "basis_type": "self_check",
        "legal_article": None,
        "source_name": "FactoFit demo self-check",
        "evidence_text": "가열부 과열과 누수는 화상, 전기, 품질 리스크를 만들 수 있어 주기적 확인이 필요합니다.",
    },
]


DEMO_INSPECTIONS = [
    {
        "inspection_id": "safety-inspection-press-guard-001",
        "company_id": "demo-company-001",
        "equipment_id": "demo-equipment-press-001",
        "rule_id": "safety-rule-press-guard-001",
        "last_checked_at": "2026-05-15",
        "next_due_at": "2026-06-15",
        "status": "warning",
        "assignee": "생산1팀 김대리",
        "evidence_file_url": None,
        "memo": "광전자식 방호장치 반응 속도 재확인 필요",
    },
    {
        "inspection_id": "safety-inspection-press-hydraulic-002",
        "company_id": "demo-company-001",
        "equipment_id": "demo-equipment-press-001",
        "rule_id": "safety-rule-press-hydraulic-002",
        "last_checked_at": "2026-03-01",
        "next_due_at": "2026-06-01",
        "status": "overdue",
        "assignee": "보전팀 박과장",
        "evidence_file_url": None,
        "memo": "실린더 하부 미세 누유 의심",
    },
    {
        "inspection_id": "safety-inspection-press-worker-003",
        "company_id": "demo-company-001",
        "equipment_id": "demo-equipment-press-001",
        "rule_id": "safety-rule-press-worker-003",
        "last_checked_at": "2026-02-20",
        "next_due_at": "2026-08-20",
        "status": "normal",
        "assignee": "안전관리자",
        "evidence_file_url": None,
        "memo": "신규 작업자 2명 보충교육 예정",
    },
    {
        "inspection_id": "safety-inspection-cnc-interlock-001",
        "company_id": "demo-company-001",
        "equipment_id": "demo-equipment-cnc-001",
        "rule_id": "safety-rule-cnc-interlock-001",
        "last_checked_at": "2026-06-02",
        "next_due_at": "2026-07-02",
        "status": "normal",
        "assignee": "가공팀 이대리",
        "evidence_file_url": None,
        "memo": "이상 없음",
    },
    {
        "inspection_id": "safety-inspection-cnc-spindle-002",
        "company_id": "demo-company-001",
        "equipment_id": "demo-equipment-cnc-001",
        "rule_id": "safety-rule-cnc-spindle-002",
        "last_checked_at": "2026-04-05",
        "next_due_at": "2026-07-05",
        "status": "normal",
        "assignee": "보전팀 박과장",
        "evidence_file_url": None,
        "memo": "스핀들 진동 추세 관찰",
    },
    {
        "inspection_id": "safety-inspection-injection-door-001",
        "company_id": "demo-company-001",
        "equipment_id": "demo-equipment-injection-001",
        "rule_id": "safety-rule-injection-door-001",
        "last_checked_at": "2026-04-20",
        "next_due_at": "2026-05-20",
        "status": "overdue",
        "assignee": "성형팀 최주임",
        "evidence_file_url": None,
        "memo": "안전문 닫힘 센서 점검 필요",
    },
    {
        "inspection_id": "safety-inspection-injection-heater-002",
        "company_id": "demo-company-001",
        "equipment_id": "demo-equipment-injection-001",
        "rule_id": "safety-rule-injection-heater-002",
        "last_checked_at": "2026-05-25",
        "next_due_at": "2026-08-25",
        "status": "normal",
        "assignee": "성형팀 최주임",
        "evidence_file_url": None,
        "memo": "전장부 열화상 점검 예정",
    },
]


RISK_WEIGHT = {"low": 8, "medium": 15, "high": 24, "critical": 34}


def add_months(value: date, months: int) -> date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    days = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(value.day, days[month - 1]))


def parse_date(value: Any) -> date | None:
    if value is None or isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def normalize_status(next_due_at: date | None, raw_status: str | None) -> str:
    today = date.today()
    if raw_status == "overdue":
        return "danger"
    if next_due_at is None:
        return "warning"
    days_left = (next_due_at - today).days
    if days_left < 0:
        return "danger"
    if days_left <= 30:
        return "warning"
    return "normal"


def factor_status(score: int) -> str:
    if score >= 70:
        return "danger"
    if score >= 40:
        return "warning"
    return "normal"


def build_risk_factors(equipment: dict, rules: list[dict], inspections: list[dict]) -> list[dict]:
    age_years = int(equipment.get("age_years") or 0)
    defect_rate = float(equipment.get("defect_rate") or 0)
    overdue_count = sum(1 for item in inspections if item.get("computed_status") == "danger")
    warning_count = sum(1 for item in inspections if item.get("computed_status") == "warning")
    critical_rule_count = sum(1 for rule in rules if rule.get("risk_level") == "critical")
    high_rule_count = sum(1 for rule in rules if rule.get("risk_level") == "high")

    factor_values = [
        (
            "equipment_age",
            "설비 사용연수",
            min(100, max(15, age_years * 6)),
            f"{age_years}년 사용. 10년 초과 설비는 교체/정밀점검 검토 대상입니다.",
        ),
        (
            "maintenance_history",
            "유지보수 이력",
            min(100, overdue_count * 42 + warning_count * 24 + 12),
            f"지연 {overdue_count}건, 임박 {warning_count}건 기준입니다.",
        ),
        (
            "defect_trend",
            "불량률 변화",
            min(100, int(defect_rate * 18)),
            f"최근 불량률 {defect_rate:.1f}% 기준으로 추정했습니다.",
        ),
        (
            "safety_device",
            "안전장치 상태",
            min(100, critical_rule_count * 48 + high_rule_count * 18),
            "방호장치, 인터록, 비상정지 관련 규칙의 위험도를 반영했습니다.",
        ),
        (
            "worker_safety",
            "작업자 안전",
            min(100, 25 + overdue_count * 18 + critical_rule_count * 12),
            "교육, 작업표준, 점검 담당자 상태를 함께 반영했습니다.",
        ),
    ]

    return [
        {
            "key": key,
            "label": label,
            "score": score,
            "status": factor_status(score),
            "reason": reason,
        }
        for key, label, score, reason in factor_values
    ]


def replacement_reasons(equipment: dict, factors: list[dict], inspections: list[dict]) -> list[str]:
    reasons = []
    age_years = int(equipment.get("age_years") or 0)
    if age_years >= 12:
        reasons.append(f"설비 사용연수 {age_years}년으로 정밀점검 또는 교체 ROI 검토가 필요합니다.")
    if any(item.get("computed_status") == "danger" for item in inspections):
        reasons.append("기한이 지난 안전점검 항목이 있어 사고 리스크와 생산중단 리스크가 커졌습니다.")
    if any(factor["key"] == "safety_device" and factor["score"] >= 70 for factor in factors):
        reasons.append("방호장치/인터록 계열 위험도가 높아 안전장치 보강 또는 설비 교체 비교가 필요합니다.")
    if not reasons:
        reasons.append("현재는 교체보다 예방점검 주기 준수가 우선입니다.")
    return reasons


def build_dashboard(company_id: str, equipments: list[dict], rules: list[dict], inspections: list[dict]) -> dict:
    today = date.today()
    items = []

    for equipment in equipments:
        equipment_id = equipment.get("equipment_id") or equipment.get("id")
        category = (equipment.get("category") or "").lower()
        matched_rules = [rule for rule in rules if rule.get("equipment_category") == category]
        matched_rule_ids = {rule["rule_id"] for rule in matched_rules}
        matched_inspections = [
            item for item in inspections
            if item.get("equipment_id") == equipment_id and item.get("rule_id") in matched_rule_ids
        ]

        rule_by_id = {rule["rule_id"]: rule for rule in matched_rules}
        for item in matched_inspections:
            rule = rule_by_id.get(item.get("rule_id"))
            last_checked = parse_date(item.get("last_checked_at"))
            next_due = parse_date(item.get("next_due_at"))
            if not next_due and last_checked and rule:
                next_due = add_months(last_checked, int(rule.get("cycle_months") or 1))
                item["next_due_at"] = next_due.isoformat()
            item["computed_status"] = normalize_status(next_due, item.get("status"))
            if next_due:
                item["days_left"] = (next_due - today).days

        factors = build_risk_factors(equipment, matched_rules, matched_inspections)
        rule_risk = sum(RISK_WEIGHT.get(rule.get("risk_level"), 10) for rule in matched_rules)
        inspection_risk = sum(
            36 if item.get("computed_status") == "danger" else 18 if item.get("computed_status") == "warning" else 0
            for item in matched_inspections
        )
        factor_risk = round(sum(factor["score"] for factor in factors) / max(len(factors), 1) * 0.45)
        priority_score = min(100, rule_risk + inspection_risk + factor_risk)
        safety_score = max(0, 100 - priority_score)
        status = "danger" if priority_score >= 70 else "warning" if priority_score >= 40 else "normal"

        items.append({
            "equipment_id": equipment_id,
            "equipment_name": equipment.get("name") or equipment.get("equipment_name") or "이름 없는 설비",
            "equipment_category": category,
            "age_years": int(equipment.get("age_years") or 0),
            "safety_score": safety_score,
            "status": status,
            "priority_rank": 0,
            "priority_score": priority_score,
            "replacement_reasons": replacement_reasons(equipment, factors, matched_inspections),
            "risk_factors": factors,
            "rules": matched_rules,
            "inspections": matched_inspections,
        })

    items.sort(key=lambda item: item["priority_score"], reverse=True)
    for index, item in enumerate(items, start=1):
        item["priority_rank"] = index

    total = max(len(items), 1)
    summary = {
        "average_score": round(sum(item["safety_score"] for item in items) / total),
        "normal_count": sum(1 for item in items if item["status"] == "normal"),
        "warning_count": sum(1 for item in items if item["status"] == "warning"),
        "danger_count": sum(1 for item in items if item["status"] == "danger"),
        "total_rules": sum(len(item["rules"]) for item in items),
        "overdue_count": sum(
            1
            for item in items
            for inspection in item["inspections"]
            if inspection.get("computed_status") == "danger"
        ),
    }

    return {"company_id": company_id, "summary": summary, "items": items}


def demo_dashboard(company_id: str) -> dict:
    return build_dashboard(company_id, [item.copy() for item in DEMO_EQUIPMENTS], [item.copy() for item in DEMO_RULES], [item.copy() for item in DEMO_INSPECTIONS])


@router.get("/safety/dashboard")
async def get_safety_dashboard(company_id: str = Query(default="demo-company-001")):
    try:
        db = get_db()
        equipment_result = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .execute()
        )
        equipments = equipment_result.data or []
        if not equipments:
            return {"success": True, "data": demo_dashboard(company_id), "source": "demo"}

        categories = sorted({(item.get("category") or "").lower() for item in equipments if item.get("category")})
        rule_query = db.table("safety_rule").select("*")
        if categories:
            rule_query = rule_query.in_("equipment_category", categories)
        rules = rule_query.execute().data or []

        equipment_ids = [item.get("equipment_id") or item.get("id") for item in equipments if item.get("equipment_id") or item.get("id")]
        inspection_query = db.table("safety_inspection").select("*").eq("company_id", company_id)
        if equipment_ids:
            inspection_query = inspection_query.in_("equipment_id", equipment_ids)
        inspections = inspection_query.execute().data or []

        return {
            "success": True,
            "data": build_dashboard(company_id, equipments, rules, inspections),
            "source": "database",
        }
    except Exception as exc:
        print(f"safety dashboard fallback: {exc}")
        return {"success": True, "data": demo_dashboard(company_id), "source": "demo"}
