# app/agents/equipment_safety.py
from __future__ import annotations
from datetime import date

from langchain_core.messages import SystemMessage

from app.state import FactofitState
from app.core.llm import llm
from app.services.equipment_safety import get_safety_dashboard
from app.prompts.equipment_safety import (
    SAFETY_CASE_CLASSIFIER_PROMPT,
    SAFETY_SUMMARY_PROMPT,
    SAFETY_QUESTION_PROMPT,
)


def _format_priority_items(priority_items: list[dict]) -> str:
    """우선순위 항목을 프롬프트용 텍스트로 변환합니다."""
    if not priority_items:
        return "우선 처리 필요 항목 없음"

    lines = []
    for i, item in enumerate(priority_items[:5], 1):
        rule = item.get("rule", {})
        name = getattr(rule, "inspection_type", "알 수 없음")
        status = item.get("display_status", "")
        days_left = item.get("days_left")
        rule_type = item.get("rule_type", "")

        dday = ""
        if days_left is not None:
            dday = f"D+{abs(days_left)}" if days_left < 0 else f"D-{days_left}"

        legal_mark = "[법정]" if rule_type == "legal" else "[자율]"
        lines.append(f"{i}. {legal_mark} {name} — {status} {dday}".strip())

    return "\n".join(lines)


def _format_purpose_breakdown(purpose_breakdown: list[dict]) -> str:
    """분류별 현황을 프롬프트용 텍스트로 변환합니다."""
    if not purpose_breakdown:
        return "분류별 데이터 없음"

    lines = []
    for item in purpose_breakdown:
        purpose = item.get("purpose", "")
        total = item.get("total_count", 0)
        incomplete = item.get("incomplete_count", 0)
        complete = total - incomplete
        lines.append(f"- {purpose}: {complete}/{total}건 완료")

    return "\n".join(lines)


def _format_relevant_rules(items: list[dict], user_query: str) -> str:
    """
    전체 룰을 나열하지 않고 요약 형태로 변환합니다.
    - 전체 법정/자율 점검 개수
    - 점검 주기 범위
    - 매일 점검 항목 수
    - 대표 예시 2-3개
    """
    if not items:
        return "관련 점검 규칙 없음"

    legal_items = [i for i in items if i.get("rule_type") == "legal"]
    voluntary_items = [i for i in items if i.get("rule_type") == "voluntary"]

    cycles = [
        getattr(i.get("rule"), "cycle_months", None)
        for i in items
        if getattr(i.get("rule"), "cycle_months", None)
    ]
    cycle_range = f"{min(cycles)}개월 ~ {max(cycles)}개월" if cycles else "정보 없음"

    pre_work_count = sum(
        1 for i in items
        if getattr(i.get("rule"), "pre_work_check_required", False)
    )

    keywords = user_query.replace("?", "").replace(".", "").split()
    matched = [
        i for i in items
        if any(kw in getattr(i.get("rule"), "inspection_type", "") for kw in keywords)
    ]
    examples = matched[:3] if matched else items[:3]

    example_lines = []
    for item in examples:
        rule = item.get("rule")
        name = getattr(rule, "inspection_type", "")
        cycle = getattr(rule, "cycle_months", "")
        rule_type = item.get("rule_type", "")
        legal_mark = "[법정]" if rule_type == "legal" else "[자율]"
        example_lines.append(f"- {legal_mark} {name} (주기: {cycle}개월)")

    summary = f"""
전체 점검 항목: {len(items)}개 (법정 {len(legal_items)}개, 자율 {len(voluntary_items)}개)
점검 주기 범위: {cycle_range}
매일 작업 전 점검 항목: {pre_work_count}개

대표 예시:
{chr(10).join(example_lines)}
"""
    return summary.strip()


def equipment_safety_node(state: FactofitState) -> FactofitState:
    """
    안전점검 AI 어드바이저 노드.

    케이스 A (summary): 전반적인 현황 요약 + 조언
    케이스 B (question): 특정 점검 항목 질문 답변
    """
    company = state.get("company_info")
    equipment = state.get("equipment")
    user_query = state.get("user_query", "")

    if not equipment:
        state["final_response"] = (
            "설비 정보가 없어서 안전점검 분석을 진행할 수 없어요. "
            "마이페이지에서 설비를 등록해주세요."
        )
        return state

    history_text = ""
    for msg in state.get("chat_history", []):
        role = "사용자" if msg["role"] == "user" else "AI"
        history_text += f"{role}: {msg['content']}\n"

    # ==================== 1단계: 케이스 분류 ====================
    classifier_prompt = SAFETY_CASE_CLASSIFIER_PROMPT.format(
        chat_history=history_text if history_text else "없음",
        user_message=user_query,
    )
    case_response = llm.invoke([SystemMessage(content=classifier_prompt)])
    case = case_response.content.strip().lower()

    if case not in ["summary", "question"]:
        case = "summary"

    # ==================== 2단계: 대시보드 데이터 조회 ====================
    company_id = company.company_id if company else None
    equipment_id = state.get("equipment_id")

    dashboard = None
    dashboard_item = None

    if company_id:
        try:
            dashboard = get_safety_dashboard(company_id, today=date.today())
            state["safety_dashboard"] = dashboard.model_dump(mode="json")

            if equipment_id and dashboard.items:
                for item in dashboard.items:
                    if item.equipment_id == equipment_id:
                        dashboard_item = item
                        break
                if not dashboard_item and dashboard.items:
                    dashboard_item = dashboard.items[0]

        except Exception as e:
            print(f"[equipment_safety_node] dashboard 조회 실패: {e}")

    equipment_name = getattr(equipment, "name", "알 수 없음")
    equipment_category = getattr(equipment, "category", "알 수 없음")
    age_years = getattr(equipment, "age_years", 0)

    # ==================== 3단계: 케이스별 처리 ====================
    if case == "summary":
        if dashboard_item:
            summary_counts = dashboard_item.summary_counts
            priority_items_text = _format_priority_items(dashboard_item.priority_items)
            purpose_breakdown_text = _format_purpose_breakdown(dashboard_item.purpose_breakdown)
            total_rule_count = dashboard_item.total_rule_count
        else:
            summary_counts = {
                "overdue_legal_count": 0,
                "overdue_count": 0,
                "due_soon_count": 0,
                "no_record_count": 0,
                "completed_count": 0,
            }
            priority_items_text = "데이터 없음"
            purpose_breakdown_text = "데이터 없음"
            total_rule_count = 0

        prompt = SAFETY_SUMMARY_PROMPT.format(
            equipment_name=equipment_name,
            equipment_category=equipment_category,
            age_years=age_years,
            total_rule_count=total_rule_count,
            overdue_legal_count=summary_counts.get("overdue_legal_count", 0),
            overdue_count=summary_counts.get("overdue_count", 0),
            due_soon_count=summary_counts.get("due_soon_count", 0),
            no_record_count=summary_counts.get("no_record_count", 0),
            completed_count=summary_counts.get("completed_count", 0),
            priority_items=priority_items_text,
            purpose_breakdown=purpose_breakdown_text,
            chat_history=history_text if history_text else "없음",
            user_message=user_query,
        )

    else:
        all_items = dashboard_item.all_items if dashboard_item else []
        relevant_rules_text = _format_relevant_rules(all_items, user_query)

        prompt = SAFETY_QUESTION_PROMPT.format(
            equipment_name=equipment_name,
            equipment_category=equipment_category,
            age_years=age_years,
            relevant_rules=relevant_rules_text,
            chat_history=history_text if history_text else "없음",
            user_message=user_query,
        )

    # ==================== 4단계: LLM 응답 생성 ====================
    response = llm.invoke([SystemMessage(content=prompt)])
    state["final_response"] = response.content.strip()

    return state
