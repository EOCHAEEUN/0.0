from __future__ import annotations

import json
import re
from typing import Any

from app.agents.capex import compare_scenarios, format_roi_result
from app.agents.equipment_safety import build_safety_snapshot
from app.core.database import get_db
from app.models.equipment import EquipmentInput
from app.state import FactofitState
from app.tools.roi_calc import calculate_roi

EXPLICIT_ACTION_TO_ROUTE = {
    "roi_detail": "roi_snapshot",
    "roi_compare": "roi_snapshot",
    "matched_policies": "policy_snapshot",
    "policy_calendar": "calendar_snapshot",
    "application_draft_status": "draft_status",
    "safety_status": "safety_snapshot",
    "investment_simulation": "investment_simulation",
    "current_analysis_summary": "current_analysis_summary",
}

NEW_ANALYSIS_ACTIONS = {"start_analysis", "new_analysis", "roi_analyze"}
SIMULATION_ACTIONS = {"investment_simulation", "simulate", "roi_simulate", "investment_change"}
REANALYSIS_ACTIONS = {"reanalyze", "reanalysis"}


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _find_amount_manwon(question: str) -> int | None:
    text = _as_text(question).replace(",", "").replace(" ", "")
    if not text:
        return None
    total = 0.0
    matched = False
    for value in re.findall(r"(\d+(?:\.\d+)?)억", text):
        total += float(value) * 10000
        matched = True
    for value in re.findall(r"(\d+(?:\.\d+)?)천(?:만)?", text):
        total += float(value) * 1000
        matched = True
    if matched and total > 0:
        return int(round(total))
    direct = re.search(r"(\d+(?:\.\d+)?)(?:만원|만)?", text)
    if not direct:
        return None
    number = float(direct.group(1))
    if "만원" in text or "만" in text:
        return int(round(number))
    if number >= 1000:
        return int(round(number))
    return None


def _scenario_metrics(roi_data: dict[str, Any], key: str) -> dict[str, Any]:
    scenario = _as_dict(roi_data.get(key))
    policy_applied = _as_dict(_as_dict(roi_data.get("policy_applications")).get(key))
    return {
        "investment": _safe_int(scenario.get("investment_manwon")),
        "net_investment": _safe_int(scenario.get("net_investment_manwon")),
        "roi_pct": _safe_float(scenario.get("roi_pct")),
        "payback_years": _safe_float(scenario.get("payback_years")),
        "annual_benefit": _safe_int(scenario.get("annual_net_benefit_manwon")),
        "support": _safe_int(policy_applied.get("applied_support_manwon")),
    }


def _is_legacy_snapshot(snapshot: dict[str, Any]) -> bool:
    if not snapshot:
        return True
    if not snapshot.get("snapshot_version"):
        return True
    if not isinstance(snapshot.get("policies"), list):
        return True
    return False


def _load_company_snapshot(company_id: str) -> dict[str, Any]:
    row = (
        get_db()
        .table("company")
        .select("*")
        .eq("company_id", company_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return _as_dict(row[0]) if row else {}


def _load_company_equipments(company_id: str) -> list[dict[str, Any]]:
    return (
        get_db()
        .table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )


def _load_equipment_snapshot(company_id: str, equipment_id: str) -> dict[str, Any]:
    if not equipment_id:
        return {}
    row = (
        get_db()
        .table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return _as_dict(row[0]) if row else {}


def _resolve_draft_snapshot(company_id: str, analysis_id: str, policy_id: str) -> dict[str, Any]:
    if not (company_id and analysis_id and policy_id):
        return {}
    rows = (
        get_db()
        .table("draft_result")
        .select("*")
        .eq("company_id", company_id)
        .eq("analysis_id", analysis_id)
        .eq("policy_id", policy_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return _as_dict(rows[0]) if rows else {}


def _response_payload(
    state: FactofitState,
    *,
    text: str,
    cards: list[dict[str, Any]] | None = None,
    intent: str = "response",
    answer_source: str = "database",
    used_llm: bool = False,
    used_roi_recalculation: bool = False,
    used_policy_matching: bool = False,
) -> None:
    state["response"] = text
    state["cards"] = cards or []
    state["intent"] = intent
    state["answer_source"] = answer_source
    state["used_llm"] = used_llm
    state["used_roi_recalculation"] = used_roi_recalculation
    state["used_policy_matching"] = used_policy_matching


def _query_lower(state: FactofitState) -> str:
    return _as_text(state.get("message") or state.get("user_query")).lower()


def _contains_any(query: str, keywords: list[str]) -> bool:
    return any(keyword in query for keyword in keywords)


def entry_dispatch_node(state: FactofitState) -> FactofitState:
    state["used_graph"] = True
    action = _as_text(state.get("action")).lower()
    query = _query_lower(state)

    if action in EXPLICIT_ACTION_TO_ROUTE:
        state["route"] = "explicit_action"
        return state

    if action in NEW_ANALYSIS_ACTIONS:
        state["route"] = "new_analysis"
        return state

    if action in REANALYSIS_ACTIONS or _contains_any(query, ["재분석", "다시 분석", "최신 조건"]):
        state["route"] = "reanalysis_request"
        return state

    if action in SIMULATION_ACTIONS or (
        _contains_any(query, ["투자금", "비용", "금액", "예산"])
        and _contains_any(query, ["바꾸", "변경", "재계산", "다시 계산"])
        and _find_amount_manwon(query) is not None
    ):
        state["route"] = "investment_simulation"
        return state

    analysis_id = _as_text(state.get("analysis_id"))
    if analysis_id:
        if _contains_any(query, ["안전", "점검", "증빙"]):
            state["route"] = "safety_snapshot"
        elif _contains_any(query, ["마감", "캘린더", "일정", "d-day", "디데이"]):
            state["route"] = "calendar_snapshot"
        elif _contains_any(query, ["정책", "지원사업", "공고"]):
            state["route"] = "policy_snapshot"
        elif _contains_any(query, ["초안", "신청서", "draft", "pdf"]):
            state["route"] = "draft_status"
        else:
            state["route"] = "roi_snapshot"
        return state

    if _contains_any(query, ["새 설비", "새로 분석", "roi 분석", "투자 분석"]):
        state["route"] = "new_analysis"
        return state

    if _contains_any(query, ["정책", "지원사업", "공고", "탐색"]):
        state["route"] = "policy_discovery"
        return state

    if _contains_any(query, ["안녕", "무엇을 할 수", "도움", "소개", "하이", "hello"]):
        state["route"] = "conversation_fallback"
        return state

    state["route"] = "missing_data"
    return state


def explicit_action_dispatch_node(state: FactofitState) -> FactofitState:
    action = _as_text(state.get("action")).lower()
    state["route"] = EXPLICIT_ACTION_TO_ROUTE.get(action, "db_error")
    if state["route"] == "db_error":
        state["error"] = f"지원하지 않는 action입니다: {action}"
    return state


def analysis_snapshot_loader_node(state: FactofitState) -> FactofitState:
    company_id = _as_text(state.get("company_id"))
    analysis_id = _as_text(state.get("analysis_id"))

    if not analysis_id:
        state["route"] = "missing_data"
        state["error"] = "analysis_id가 없습니다."
        return state

    rows = (
        get_db()
        .table("roi_output")
        .select("*")
        .eq("id", analysis_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        state["route"] = "db_error"
        state["error"] = "분석 이력을 찾을 수 없습니다."
        return state

    roi_output = _as_dict(rows[0])
    equipment_id = _as_text(roi_output.get("equipment_id"))
    policy_snapshot = _as_dict(roi_output.get("policy_snapshot"))
    requested_policy_id = _as_text(state.get("policy_id"))
    recommended_policy_id = _as_text(policy_snapshot.get("recommended_policy_id"))
    policy_rows = policy_snapshot.get("policies") if isinstance(policy_snapshot.get("policies"), list) else []
    available_policy_ids = {
        _as_text(_as_dict(row).get("policy_id")) for row in policy_rows if _as_text(_as_dict(row).get("policy_id"))
    }
    if requested_policy_id and requested_policy_id in available_policy_ids:
        selected_policy_id = requested_policy_id
    elif recommended_policy_id and recommended_policy_id in available_policy_ids:
        selected_policy_id = recommended_policy_id
    else:
        selected_policy_id = ""

    state["roi_output"] = roi_output
    state["roi_snapshot"] = _as_dict(roi_output.get("roi_data"))
    state["policy_snapshot"] = policy_snapshot
    state["equipment_id"] = equipment_id
    state["company_snapshot"] = _load_company_snapshot(company_id)
    state["equipment_snapshot"] = _load_equipment_snapshot(company_id, equipment_id)
    state["policy_id"] = selected_policy_id
    state["draft_snapshot"] = _resolve_draft_snapshot(
        company_id,
        analysis_id,
        _as_text(state.get("policy_id")),
    )
    return state


def roi_snapshot_node(state: FactofitState) -> FactofitState:
    roi_data = _as_dict(state.get("roi_snapshot"))
    scenario_a = _scenario_metrics(roi_data, "scenario_a")
    scenario_b = _scenario_metrics(roi_data, "scenario_b")
    recommended = _as_text(roi_data.get("recommended")).upper() or "A"
    query = _query_lower(state)
    action = _as_text(state.get("action")).lower()

    if action == "roi_compare" or _contains_any(query, ["비교", "a안", "b안"]):
        text = "저장된 분석 기준 A/B 비교입니다.\n\n" + compare_scenarios(roi_data)
        cards = [{"type": "roi_compare", "data": {"scenario_a": scenario_a, "scenario_b": scenario_b, "recommended": recommended}}]
    elif action == "roi_detail":
        target = scenario_a if recommended == "A" else scenario_b
        text = (
            "현재 분석 결과를 정리했어요.\n\n"
            f"추천 {recommended}안 · 투자금 {target['investment']:,}만원 · "
            f"실부담 {target['net_investment']:,}만원 · ROI {target['roi_pct']:.1f}% · "
            f"회수기간 {target['payback_years']:.2f}년\n\n"
            f"{format_roi_result(roi_data)}"
        )
        cards = [{"type": "roi_snapshot", "data": {"scenario_a": scenario_a, "scenario_b": scenario_b, "recommended": recommended}}]
    else:
        target = scenario_a if recommended == "A" else scenario_b
        text = (
            f"추천 {recommended}안 투자금 {target['investment']:,}만원, "
            f"실부담 {target['net_investment']:,}만원, ROI {target['roi_pct']:.1f}%입니다."
        )
        cards = [{"type": "roi_snapshot", "data": {"scenario_a": scenario_a, "scenario_b": scenario_b, "recommended": recommended}}]

    _response_payload(state, text=text, cards=cards, intent="roi", answer_source="database")
    return state


def policy_snapshot_node(state: FactofitState) -> FactofitState:
    snapshot = _as_dict(state.get("policy_snapshot"))
    if _is_legacy_snapshot(snapshot):
        _response_payload(
            state,
            text="이 분석은 정책 이력 저장 전 생성되어 매칭 정책을 복원할 수 없습니다. 재분석 또는 최신 탐색을 진행해 주세요.",
            cards=[{"type": "legacy_policy_snapshot_missing", "data": {"analysis_id": state.get("analysis_id")}}],
            intent="policy",
            answer_source="database",
        )
        return state

    policies = snapshot.get("policies") if isinstance(snapshot.get("policies"), list) else []
    lines = []
    for item in policies[:5]:
        row = _as_dict(item)
        title = _as_text(row.get("title")) or "정책명 미확인"
        deadline = _as_text(row.get("deadline_display") or row.get("deadline")) or "마감일 미정"
        support = _as_text(row.get("max_amount_actual")) or f"{_safe_int(row.get('max_amount_numeric_manwon')):,}만원"
        lines.append(f"- {title} / {support} / {deadline}")

    _response_payload(
        state,
        text="저장된 매칭 지원사업 snapshot입니다.\n" + ("\n".join(lines) if lines else "- 매칭 정책 없음"),
        cards=[{"type": "policy_snapshot_cards", "data": policies[:5]}],
        intent="policy",
        answer_source="database",
    )
    return state


def calendar_snapshot_node(state: FactofitState) -> FactofitState:
    snapshot = _as_dict(state.get("policy_snapshot"))
    if _is_legacy_snapshot(snapshot):
        _response_payload(
            state,
            text="분석 당시 정책 이력이 없어 캘린더를 생성할 수 없습니다. 재분석 또는 최신 탐색을 이용해 주세요.",
            cards=[{"type": "legacy_policy_snapshot_missing", "data": {"analysis_id": state.get("analysis_id")}}],
            intent="calendar",
            answer_source="database",
        )
        return state

    policies = snapshot.get("policies") if isinstance(snapshot.get("policies"), list) else []
    items = []
    for row in policies:
        item = _as_dict(row)
        deadline = _as_text(item.get("deadline_display") or item.get("deadline"))
        items.append(
            {
                "policy_id": _as_text(item.get("policy_id")),
                "title": _as_text(item.get("title")),
                "deadline": deadline or "마감일 미정",
                "d_day": _as_text(item.get("d_day")) or "-",
            }
        )
    items = sorted(items, key=lambda i: i["deadline"])

    _response_payload(
        state,
        text="현재 분석의 정책 마감 일정입니다.",
        cards=[{"type": "policy_calendar", "data": {"items": items}}],
        intent="calendar",
        answer_source="database",
    )
    return state


def draft_status_node(state: FactofitState) -> FactofitState:
    draft_row = _as_dict(state.get("draft_snapshot"))
    analysis_id = _as_text(state.get("analysis_id"))
    if draft_row:
        content = draft_row.get("draft_content")
        preview = ""
        if isinstance(content, dict):
            preview = _as_text(content.get("business_necessity") or json.dumps(content, ensure_ascii=False))
        else:
            preview = _as_text(content)
        _response_payload(
            state,
            text=f"신청서 초안이 준비되어 있습니다.\n{preview[:360]}",
            cards=[{"type": "application_draft_status", "data": {"status": "ready", "analysis_id": analysis_id, "preview": preview[:240]}}],
            intent="draft",
            answer_source="database",
        )
        return state

    _response_payload(
        state,
        text="현재 분석에 연결된 신청서 초안이 아직 없습니다. 신청서 탭에서 초안을 생성해 주세요.",
        cards=[{"type": "application_draft_status", "data": {"status": "missing", "analysis_id": analysis_id}}],
        intent="draft",
        answer_source="database",
    )
    return state


def safety_snapshot_node(state: FactofitState) -> FactofitState:
    snapshot = build_safety_snapshot(
        company_id=_as_text(state.get("company_id")),
        analysis_id=_as_text(state.get("analysis_id")),
        equipment_id=_as_text(state.get("equipment_id")),
        policy_id=_as_text(state.get("policy_id")),
    )
    _response_payload(
        state,
        text="현재 분석 기준 안전 현황입니다.",
        cards=[{"type": "safety_status", "data": snapshot}],
        intent="safety",
        answer_source="database",
    )
    return state


def safety_preview_generation_node(state: FactofitState) -> FactofitState:
    _response_payload(
        state,
        text="안전 프리뷰 생성 요청은 현재 별도 생성 액션에서만 허용됩니다.",
        cards=[],
        intent="safety",
        answer_source="database",
    )
    return state


def investment_simulation_node(state: FactofitState) -> FactofitState:
    company_id = _as_text(state.get("company_id"))
    equipment_id = _as_text(state.get("equipment_id"))
    analysis_id = _as_text(state.get("analysis_id"))
    query = _query_lower(state)
    input_values = _as_dict(state.get("simulation_input"))

    rows = (
        get_db()
        .table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        state["route"] = "db_error"
        state["error"] = "시뮬레이션용 설비 정보를 찾을 수 없습니다."
        return state

    row = _as_dict(rows[0])
    roi_data = _as_dict(state.get("roi_snapshot"))
    amount = _find_amount_manwon(query)

    scenario_a = input_values.get("scenario_a_investment_manwon")
    scenario_b = input_values.get("scenario_b_investment_manwon")
    if amount is not None:
        if "b안" in query:
            scenario_b = amount
        elif "a안" in query:
            scenario_a = amount
        else:
            scenario_a = amount if scenario_a is None else scenario_a
            scenario_b = amount if scenario_b is None else scenario_b

    equipment = EquipmentInput(
        name=_as_text(row.get("name")),
        category=_as_text(row.get("category")),
        age_years=_safe_int(row.get("age_years")),
        energy_cost_annual=_safe_int(row.get("energy_cost_annual")),
        defect_rate=row.get("defect_rate"),
        maintenance_cost_annual=_safe_int(row.get("maintenance_cost_annual")),
        current_capacity_value=row.get("current_capacity_value"),
        production_qty=row.get("production_qty"),
        process=row.get("process"),
        contribution_margin_won=row.get("contribution_margin_won"),
        scenario_a_investment_manwon=_safe_int(scenario_a if scenario_a is not None else row.get("scenario_a_investment_manwon")),
        scenario_b_investment_manwon=_safe_int(scenario_b if scenario_b is not None else row.get("scenario_b_investment_manwon")),
    )
    simulated = calculate_roi(
        equipment,
        energy_provided=_safe_float(row.get("energy_cost_annual"), 0) > 0,
        policy_applications=_as_dict(roi_data.get("policy_applications")) or None,
    )
    _response_payload(
        state,
        text="임시 시뮬레이션 결과입니다. 기존 분석 데이터는 저장/수정되지 않습니다.",
        cards=[{"type": "roi_simulation", "data": {"analysis_id": analysis_id, "simulated": simulated, "temporary": True}}],
        intent="roi",
        answer_source="simulation",
        used_roi_recalculation=True,
    )
    return state


def reanalysis_request_node(state: FactofitState) -> FactofitState:
    _response_payload(
        state,
        text="재분석 요청으로 확인했습니다. 기존 analysis는 덮어쓰지 않고 신규 분석으로 진행할 수 있습니다.",
        cards=[{"type": "reanalysis_confirmation", "data": {"analysis_id": state.get("analysis_id")}}],
        intent="response",
        answer_source="reanalysis",
    )
    return state


def equipment_selection_node(state: FactofitState) -> FactofitState:
    equipments = state.get("company_equipments") or _load_company_equipments(_as_text(state.get("company_id")))
    cards = [{
        "type": "equipment_selection",
        "data": [
            {
                "equipment_id": row.get("equipment_id"),
                "name": row.get("name"),
                "category": row.get("category"),
                "age_years": row.get("age_years"),
            }
            for row in equipments
        ],
    }]
    _response_payload(
        state,
        text="분석할 설비를 선택해 주세요.",
        cards=cards,
        intent="info_missing",
        answer_source="missing_data",
    )
    return state


def new_analysis_node(state: FactofitState) -> FactofitState:
    return equipment_selection_node(state)


def policy_discovery_node(state: FactofitState) -> FactofitState:
    _response_payload(
        state,
        text="현재 선택된 분석이 없어 정책 snapshot을 보여드릴 수 없습니다. 분석을 선택하거나 지원사업 화면에서 최신 탐색을 진행해 주세요.",
        cards=[{"type": "missing_analysis", "data": {}}],
        intent="policy",
        answer_source="missing_data",
    )
    return state


def missing_data_node(state: FactofitState) -> FactofitState:
    _response_payload(
        state,
        text="현재 조회 가능한 분석 데이터가 없습니다. 분석을 선택하거나 새 분석을 시작해 주세요.",
        cards=[{"type": "missing_analysis", "data": {}}],
        intent="response",
        answer_source="missing_data",
    )
    return state


def db_error_node(state: FactofitState) -> FactofitState:
    _response_payload(
        state,
        text=_as_text(state.get("error")) or "DB 조회 중 오류가 발생했습니다.",
        cards=[],
        intent="response",
        answer_source="db_error",
    )
    return state


def conversation_fallback_node(state: FactofitState) -> FactofitState:
    _response_payload(
        state,
        text="안녕하세요. 분석을 선택하면 ROI/정책/초안/안전 상태를 DB 기준으로 바로 안내해드릴게요.",
        cards=[],
        intent="response",
        answer_source="conversation",
    )
    return state


def current_analysis_summary_node(state: FactofitState) -> FactofitState:
    roi_data = _as_dict(state.get("roi_snapshot"))
    scenario_a = _scenario_metrics(roi_data, "scenario_a")
    scenario_b = _scenario_metrics(roi_data, "scenario_b")
    recommended = _as_text(roi_data.get("recommended")).upper() or "A"
    _response_payload(
        state,
        text=(
            f"현재 분석 요약입니다. 추천 {recommended}안, "
            f"A안 ROI {scenario_a['roi_pct']:.1f}% / B안 ROI {scenario_b['roi_pct']:.1f}%."
        ),
        cards=[{"type": "roi_snapshot", "data": {"scenario_a": scenario_a, "scenario_b": scenario_b, "recommended": recommended}}],
        intent="roi",
        answer_source="database",
    )
    return state
