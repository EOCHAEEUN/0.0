import json
import os
import re
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException

from app.core.database import get_db
from app.graph import factofit_graph
from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.agents.capex import compare_roi_results, compare_scenarios, format_roi_result
from app.tools.roi_calc import calculate_roi

EXPLICIT_DB_ACTIONS = {
    "roi_detail",
    "roi_compare",
    "matched_policies",
    "application_draft_status",
}
EXPLICIT_SIMULATION_ACTIONS = {"investment_simulation"}
EXPLICIT_NEW_ANALYSIS_ACTIONS = {"start_analysis", "new_analysis", "roi_analyze"}


def _as_dict(value):
    return value if isinstance(value, dict) else {}


def _as_text(value):
    if value is None:
        return ""
    return str(value).strip()


def _safe_session_id(value: str = "") -> str:
    text = _as_text(value)
    return text or str(uuid4())


def _normalize_chat_history(items: list[dict]) -> list[dict]:
    normalized = []
    for item in items[-60:]:
        row = _as_dict(item)
        role = _as_text(row.get("role")).lower()
        content = _as_text(row.get("content"))
        if role not in {"user", "assistant"} or not content:
            continue
        created_at = _as_text(row.get("created_at"))
        normalized_item = {"role": role, "content": content}
        if created_at:
            normalized_item["created_at"] = created_at
        normalized.append(normalized_item)
    return normalized


def _merge_histories(server_history: list[dict], client_history: list[dict]) -> list[dict]:
    server = _normalize_chat_history(server_history)
    client = _normalize_chat_history(client_history)
    if not server:
        return client
    if not client:
        return server
    if len(client) <= len(server):
        return server
    if client[: len(server)] == server:
        return client
    return server


def _load_company_row(company_id: str):
    return (
        get_db()
        .table("company")
        .select("*")
        .eq("company_id", company_id)
        .limit(1)
        .execute()
    )


def _load_company_context(company_id: str):
    company_data = _load_company_row(company_id)
    if not company_data.data:
        return None
    data = _as_dict(company_data.data[0])
    industry_code = data.get("industry_code")
    if isinstance(industry_code, str):
        industry_code = [code.strip() for code in industry_code.split(",") if code.strip()]
    return CompanyContext(
        company_id=data.get("company_id"),
        company_name=data.get("company_name", ""),
        business_registration_no=data.get("business_registration_no"),
        industry_name=data.get("industry_name"),
        industry_code=industry_code or [],
        region=data.get("region", ""),
        company_type=data.get("company_type"),
        primary_purpose=data.get("primary_purpose") or [],
        employee_count=data.get("employee_count"),
        annual_revenue=data.get("annual_revenue"),
        revenue_2y_ago_manwon=data.get("revenue_2y_ago_manwon"),
        revenue_3y_ago_manwon=data.get("revenue_3y_ago_manwon"),
        total_assets_manwon=data.get("total_assets_manwon"),
        is_disclosure_group_member=data.get("is_disclosure_group_member"),
        independence_check_passed=data.get("independence_check_passed"),
        energy_cost_annual=data.get("energy_cost_annual"),
        user_id=data.get("user_id"),
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
    )


def _load_company_equipments(company_id: str):
    result = (
        get_db()
        .table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .execute()
    )
    return result.data or []


def _build_equipment_input(equipment_row: dict):
    return EquipmentInput(
        name=equipment_row.get("name", ""),
        category=equipment_row.get("category", ""),
        age_years=equipment_row.get("age_years", 0),
        energy_cost_annual=equipment_row.get("energy_cost_annual", 0),
        defect_rate=equipment_row.get("defect_rate"),
        maintenance_cost_annual=equipment_row.get("maintenance_cost_annual"),
        current_capacity_value=equipment_row.get("current_capacity_value"),
        production_qty=equipment_row.get("production_qty"),
        process=equipment_row.get("process"),
        contribution_margin_won=equipment_row.get("contribution_margin_won"),
        scenario_a_investment_manwon=equipment_row.get("scenario_a_investment_manwon"),
        scenario_b_investment_manwon=equipment_row.get("scenario_b_investment_manwon"),
    )


def _resolve_equipment_from_analysis(company_id: str, analysis_id: str):
    result = (
        get_db()
        .table("roi_output")
        .select("id,company_id,equipment_id")
        .eq("id", analysis_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return ""
    return _as_text(_as_dict(result.data[0]).get("equipment_id"))


def _ensure_company_owner(company_id: str, current_user_id: str):
    company = (
        get_db()
        .table("company")
        .select("company_id,user_id")
        .eq("company_id", company_id)
        .eq("user_id", current_user_id)
        .limit(1)
        .execute()
    )
    if not company.data:
        raise HTTPException(status_code=403, detail="해당 기업 대화 내역 접근 권한이 없습니다.")


def _get_session_row(company_id: str, session_id: str):
    return (
        get_db()
        .table("chat_history")
        .select("chat_id,intent,user_query,chat_history,final_response,created_at,roi_result")
        .eq("company_id", company_id)
        .eq("chat_id", session_id)
        .limit(1)
        .execute()
    )


def _session_summary_from_row(row):
    item = _as_dict(row)
    session_id = _as_text(item.get("chat_id"))
    history = item.get("chat_history") if isinstance(item.get("chat_history"), list) else []
    normalized_history = _normalize_chat_history(history)
    first_user = next((msg for msg in normalized_history if msg.get("role") == "user"), {})
    last_message = normalized_history[-1] if normalized_history else {}
    roi_result = _as_dict(item.get("roi_result"))
    title = _as_text(_as_dict(first_user).get("content"))[:64] or _as_text(item.get("user_query"))[:64] or "새 대화"
    preview = _as_text(_as_dict(last_message).get("content")) or _as_text(item.get("final_response")) or "(미리보기 없음)"
    updated_at = _as_text(_as_dict(last_message).get("created_at")) or _as_text(item.get("created_at"))
    return {
        "session_id": session_id,
        "chat_id": session_id,
        "intent": _as_text(item.get("intent")),
        "title": title,
        "preview": preview[:140],
        "updated_at": updated_at,
        "created_at": _as_text(item.get("created_at")),
        "analysis_id": _as_text(roi_result.get("analysis_id")),
        "equipment_id": _as_text(roi_result.get("equipment_id")),
    }


def _list_sessions(company_id: str, limit: int):
    rows = (
        get_db()
        .table("chat_history")
        .select("chat_id,intent,user_query,chat_history,final_response,created_at,roi_result")
        .eq("company_id", company_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [_session_summary_from_row(row) for row in rows.data or [] if _as_text(_as_dict(row).get("chat_id"))]


def _is_dev_mode() -> bool:
    env = _as_text(os.getenv("APP_ENV") or os.getenv("ENV") or os.getenv("FASTAPI_ENV")).lower()
    if not env:
        return True
    return env not in {"prod", "production"}


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(round(float(value)))
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


def _extract_bundle_row(analysis_row: dict | None, company_row: dict | None, equipment_row: dict | None):
    return {
        "analysis_id": _as_text((analysis_row or {}).get("id")),
        "company_id": _as_text((analysis_row or {}).get("company_id")) or _as_text((company_row or {}).get("company_id")),
        "equipment_id": _as_text((analysis_row or {}).get("equipment_id")) or _as_text((equipment_row or {}).get("equipment_id")),
        "company_name": _as_text((company_row or {}).get("company_name")),
        "equipment_name": _as_text((equipment_row or {}).get("name")),
        "roi_data": _as_dict((analysis_row or {}).get("roi_data")),
        "policy_snapshot": _as_dict((analysis_row or {}).get("policy_snapshot")),
    }


def _load_analysis_bundle(company_id: str, analysis_id: str):
    db = get_db()
    analysis_result = (
        db.table("roi_output")
        .select("id,company_id,equipment_id,roi_data,policy_snapshot,created_at")
        .eq("id", analysis_id)
        .eq("company_id", company_id)
        .limit(1)
        .execute()
    )
    if not analysis_result.data:
        return None
    analysis_row = _as_dict(analysis_result.data[0])
    company_result = _load_company_row(company_id)
    company_row = _as_dict(company_result.data[0]) if company_result.data else {}
    equipment_result = (
        db.table("equipment")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", _as_text(analysis_row.get("equipment_id")))
        .limit(1)
        .execute()
    )
    equipment_row = _as_dict(equipment_result.data[0]) if equipment_result.data else {}
    bundle = _extract_bundle_row(analysis_row, company_row, equipment_row)
    draft_rows = (
        db.table("draft_result")
        .select("policy_id,draft_content,created_at")
        .eq("company_id", company_id)
        .eq("equipment_id", bundle["equipment_id"])
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    draft_content = ""
    target_policy_id = _as_text(bundle["policy_snapshot"].get("recommended_policy_id"))
    for row in draft_rows.data or []:
        item = _as_dict(row)
        if target_policy_id and _as_text(item.get("policy_id")) not in {"", target_policy_id}:
            continue
        content = item.get("draft_content")
        if isinstance(content, dict):
            draft_content = _as_text(content.get("business_necessity") or json.dumps(content, ensure_ascii=False))
        else:
            draft_content = _as_text(content)
        if draft_content:
            break
    bundle["draft_content"] = draft_content
    return bundle


def _latest_analysis_id(company_id: str) -> str:
    result = (
        get_db()
        .table("roi_output")
        .select("id")
        .eq("company_id", company_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return ""
    return _as_text(_as_dict(result.data[0]).get("id"))


def _legacy_snapshot(bundle: dict) -> bool:
    snapshot = _as_dict(bundle.get("policy_snapshot"))
    if not snapshot:
        return True
    if not snapshot.get("snapshot_version"):
        return True
    if not isinstance(snapshot.get("policies"), list):
        return True
    return False


def _scenario_metrics(roi_data: dict, key: str):
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


def _is_simulation_request(query: str, action: str) -> bool:
    if action in {"simulate", "roi_simulate", "investment_change", "investment_simulation"}:
        return True
    if not any(keyword in query for keyword in ["바꾸", "변경", "다시 계산", "재계산"]):
        return False
    if not any(keyword in query for keyword in ["투자금", "비용", "금액", "예산"]):
        return False
    return _find_amount_manwon(query) is not None


def _is_reanalysis_request(query: str, action: str) -> bool:
    if action in {"reanalyze", "reanalysis"}:
        return True
    return any(keyword in query for keyword in ["재분석", "다시 분석", "다시 실행", "최신 조건", "재추천"])


def _is_new_analysis_request(query: str, action: str) -> bool:
    if action in {"start_analysis", "new_analysis", "roi_analyze"}:
        return True
    return any(keyword in query for keyword in ["새 설비", "새로 분석", "roi 분석", "투자 분석", "교체 분석"])


def _is_graph_worthy_no_bundle(query: str, action: str) -> bool:
    if _is_new_analysis_request(query, action):
        return True
    if action in {"policy_view", "policy_search", "draft_start", "safety_check"}:
        return True
    return any(keyword in query for keyword in ["지원사업", "정책", "신청서", "안전점검", "점검"])


def _cards_from_graph_result(result: dict):
    intent = result.get("intent")
    if intent == "roi":
        return [{"type": "roi_result", "data": result.get("roi_result", {})}]
    if intent == "policy":
        return [{"type": "policy_card", "data": item} for item in result.get("matched_policies", [])]
    if intent == "draft":
        return [{"type": "draft_result", "data": result.get("draft_result", "")}]
    if intent == "info_missing":
        return [{
            "type": "equipment_selection",
            "data": [
                {
                    "equipment_id": row.get("equipment_id"),
                    "name": row.get("name"),
                    "category": row.get("category"),
                    "age_years": row.get("age_years"),
                }
                for row in (result.get("equipments") or [])
            ],
        }]
    if intent == "response" and result.get("options"):
        return [{"type": "intent_confirmation", "data": result.get("options", [])}]
    return []


def _build_database_answer(bundle: dict, query: str, action: str):
    roi_data = _as_dict(bundle.get("roi_data"))
    snapshot = _as_dict(bundle.get("policy_snapshot"))
    policies = snapshot.get("policies") if isinstance(snapshot.get("policies"), list) else []
    scenario_a = _scenario_metrics(roi_data, "scenario_a")
    scenario_b = _scenario_metrics(roi_data, "scenario_b")
    recommended = _as_text(roi_data.get("recommended")).upper() or "A"
    is_policy_query = action in {"policy_view", "policy_summary"} or any(keyword in query for keyword in ["정책", "지원사업", "마감", "공고", "추천"])
    is_draft_query = action in {"draft_status", "draft_summary", "pdf_preview"} or any(keyword in query for keyword in ["초안", "신청서", "계획서", "pdf"])
    is_compare_query = action in {"roi_compare", "ab_compare"} or ("비교" in query or ("a안" in query and "b안" in query))
    is_metric_query = action in {"roi_detail", "roi_summary"} or any(keyword in query for keyword in ["roi", "투자금", "실부담", "회수", "순편익", "퍼센트"])
    is_summary_query = action in {"analysis_summary", "next_step"} or any(keyword in query for keyword in ["요약", "다음", "무엇", "해야"])

    if is_policy_query:
        if _legacy_snapshot(bundle):
            return {
                "text": "이 분석은 정책 이력 저장 전 생성되어 매칭 정책을 복원할 수 없습니다. 최신 지원사업을 둘러보거나 재분석을 진행해 주세요.",
                "cards": [{"type": "legacy_policy_snapshot_missing", "data": {"analysis_id": bundle.get("analysis_id")}}],
            }
        policy_lines = []
        for policy in policies[:5]:
            row = _as_dict(policy)
            title = _as_text(row.get("title")) or "정책명 미확인"
            deadline = _as_text(row.get("deadline_display") or row.get("deadline")) or "마감일 미정"
            support = _as_text(row.get("max_amount_actual")) or f"{_safe_int(row.get('max_amount_numeric_manwon'))}만원"
            policy_lines.append(f"- {title} / {support} / {deadline}")
        return {
            "text": "현재 분석의 저장된 정책 snapshot입니다.\n" + ("\n".join(policy_lines) if policy_lines else "- 매칭 정책 없음"),
            "cards": [{"type": "policy_snapshot_cards", "data": policies[:5]}],
        }

    if is_draft_query:
        draft_content = _as_text(bundle.get("draft_content"))
        if draft_content:
            return {"text": f"신청서 초안이 준비되어 있습니다.\n{draft_content[:360]}", "cards": []}
        return {"text": "현재 분석에 연결된 신청서 초안이 아직 없습니다.", "cards": []}

    if is_compare_query:
        return {
            "text": (
                "저장된 분석 기준 A/B 비교입니다.\n"
                f"A안: 투자금 {scenario_a['investment']}만원, 실부담 {scenario_a['net_investment']}만원, ROI {scenario_a['roi_pct']:.1f}%, 회수기간 {scenario_a['payback_years']:.2f}년\n"
                f"B안: 투자금 {scenario_b['investment']}만원, 실부담 {scenario_b['net_investment']}만원, ROI {scenario_b['roi_pct']:.1f}%, 회수기간 {scenario_b['payback_years']:.2f}년\n"
                f"추천 시나리오: {recommended}안"
            ),
            "cards": [{"type": "roi_compare", "data": {"scenario_a": scenario_a, "scenario_b": scenario_b, "recommended": recommended}}],
        }

    if is_metric_query or is_summary_query or not query:
        target = scenario_a if recommended == "A" else scenario_b
        return {
            "text": (
                f"{bundle.get('equipment_name') or '설비'} 기준 저장된 분석값입니다.\n"
                f"추천 {recommended}안 투자금 {target['investment']}만원, 실부담 {target['net_investment']}만원, "
                f"ROI {target['roi_pct']:.1f}%, 회수기간 {target['payback_years']:.2f}년입니다."
            ),
            "cards": [{"type": "roi_snapshot", "data": {"scenario_a": scenario_a, "scenario_b": scenario_b, "recommended": recommended}}],
        }

    return {
        "text": "현재 분석 DB 값으로 답변합니다. ROI/A·B 비교/정책 snapshot/신청서 초안 상태를 확인해 드릴 수 있습니다.",
        "cards": [],
    }


def _simulate_with_input(bundle: dict, simulation_input: dict):
    """Run temporary ROI simulation without persisting to roi_output."""
    db = get_db()
    equipment_result = (
        db.table("equipment")
        .select("*")
        .eq("company_id", bundle.get("company_id"))
        .eq("equipment_id", bundle.get("equipment_id"))
        .limit(1)
        .execute()
    )
    if not equipment_result.data:
        raise HTTPException(status_code=404, detail="시뮬레이션용 설비 정보를 찾을 수 없습니다.")
    equipment_row = _as_dict(equipment_result.data[0])
    roi_data = _as_dict(bundle.get("roi_data"))
    baseline_a = _scenario_metrics(roi_data, "scenario_a")
    baseline_b = _scenario_metrics(roi_data, "scenario_b")
    input_values = _as_dict(simulation_input)
    scenario_a = (
        input_values.get("scenario_a_investment_manwon")
        if input_values.get("scenario_a_investment_manwon") is not None
        else equipment_row.get("scenario_a_investment_manwon")
    )
    scenario_b = (
        input_values.get("scenario_b_investment_manwon")
        if input_values.get("scenario_b_investment_manwon") is not None
        else equipment_row.get("scenario_b_investment_manwon")
    )
    if scenario_a is None and scenario_b is None:
        raise HTTPException(status_code=400, detail="변경할 투자금(A안 또는 B안)을 입력해 주세요.")
    simulation_equipment = EquipmentInput(
        name=_as_text(equipment_row.get("name")),
        category=_as_text(equipment_row.get("category")),
        age_years=_safe_int(equipment_row.get("age_years")),
        energy_cost_annual=_safe_int(equipment_row.get("energy_cost_annual")),
        defect_rate=equipment_row.get("defect_rate"),
        maintenance_cost_annual=_safe_int(equipment_row.get("maintenance_cost_annual")),
        current_capacity_value=equipment_row.get("current_capacity_value"),
        production_qty=equipment_row.get("production_qty"),
        process=equipment_row.get("process"),
        contribution_margin_won=equipment_row.get("contribution_margin_won"),
        scenario_a_investment_manwon=_safe_int(scenario_a if scenario_a is not None else baseline_a["investment"]),
        scenario_b_investment_manwon=_safe_int(scenario_b if scenario_b is not None else baseline_b["investment"]),
    )
    policy_applications = _as_dict(roi_data.get("policy_applications"))
    energy_provided = _safe_float(equipment_row.get("energy_cost_annual"), 0) > 0
    simulated = calculate_roi(
        simulation_equipment,
        energy_provided=energy_provided,
        policy_applications=policy_applications if policy_applications else None,
    )
    a = _scenario_metrics(simulated, "scenario_a")
    b = _scenario_metrics(simulated, "scenario_b")
    recommended = _as_text(simulated.get("recommended")).upper() or "A"
    compare_text = compare_roi_results(roi_data, simulated)
    text = (
        "임시 시뮬레이션 결과입니다. 기존 분석 결과는 변경되지 않습니다.\n\n"
        f"{compare_text}\n\n"
        f"A안 ROI {a['roi_pct']:.1f}% / 회수 {a['payback_years']:.2f}년, "
        f"B안 ROI {b['roi_pct']:.1f}% / 회수 {b['payback_years']:.2f}년, 추천 {recommended}안"
    )
    return {
        "text": text,
        "cards": [
            {
                "type": "roi_simulation",
                "data": {
                    "baseline": {"scenario_a": baseline_a, "scenario_b": baseline_b},
                    "simulated": simulated,
                    "temporary": True,
                },
            }
        ],
    }


def _build_explicit_action_answer(action: str, bundle: dict | None, simulation_input: dict | None = None):
    if action in EXPLICIT_DB_ACTIONS | EXPLICIT_SIMULATION_ACTIONS and not bundle:
        return {
            "text": "현재 선택된 분석이 없습니다. 분석을 선택하거나 새 투자 분석을 시작해 주세요.",
            "cards": [{"type": "missing_analysis", "data": {}}],
            "answer_source": "missing_data",
            "used_roi_recalculation": False,
        }

    if action == "roi_detail":
        roi_data = _as_dict(bundle.get("roi_data"))
        scenario_a = _scenario_metrics(roi_data, "scenario_a")
        scenario_b = _scenario_metrics(roi_data, "scenario_b")
        recommended = _as_text(roi_data.get("recommended")).upper() or "A"
        target = scenario_a if recommended == "A" else scenario_b
        detail_text = format_roi_result(roi_data)
        text = (
            "현재 분석 결과를 정리했어요.\n\n"
            f"추천 {recommended}안 · 투자금 {target['investment']:,}만원 · "
            f"실부담 {target['net_investment']:,}만원 · ROI {target['roi_pct']:.1f}% · "
            f"회수기간 {target['payback_years']:.2f}년 · 연간 순편익 {target['annual_benefit']:,}만원\n\n"
            f"{detail_text}"
        )
        return {
            "text": text,
            "cards": [
                {
                    "type": "roi_snapshot",
                    "data": {
                        "scenario_a": scenario_a,
                        "scenario_b": scenario_b,
                        "recommended": recommended,
                    },
                }
            ],
            "answer_source": "database",
            "used_roi_recalculation": False,
        }

    if action == "roi_compare":
        roi_data = _as_dict(bundle.get("roi_data"))
        scenario_a = _scenario_metrics(roi_data, "scenario_a")
        scenario_b = _scenario_metrics(roi_data, "scenario_b")
        recommended = _as_text(roi_data.get("recommended")).upper() or "A"
        text = "저장된 분석 기준 A/B 비교입니다.\n\n" + compare_scenarios(roi_data)
        return {
            "text": text,
            "cards": [
                {
                    "type": "roi_compare",
                    "data": {
                        "scenario_a": scenario_a,
                        "scenario_b": scenario_b,
                        "recommended": recommended,
                    },
                }
            ],
            "answer_source": "database",
            "used_roi_recalculation": False,
        }

    if action == "matched_policies":
        if _legacy_snapshot(bundle):
            return {
                "text": (
                    "이 분석은 정책 이력 저장 전 생성되어 매칭 정책을 복원할 수 없습니다. "
                    "재분석 또는 최신 지원사업 보기를 이용해 주세요."
                ),
                "cards": [
                    {
                        "type": "legacy_policy_snapshot_missing",
                        "data": {"analysis_id": bundle.get("analysis_id")},
                    }
                ],
                "answer_source": "database",
                "used_roi_recalculation": False,
            }
        snapshot = _as_dict(bundle.get("policy_snapshot"))
        policies = snapshot.get("policies") if isinstance(snapshot.get("policies"), list) else []
        policy_lines = []
        for policy in policies[:5]:
            row = _as_dict(policy)
            title = _as_text(row.get("title")) or "정책명 미확인"
            deadline = _as_text(row.get("deadline_display") or row.get("deadline")) or "마감일 미정"
            support = _as_text(row.get("max_amount_actual")) or f"{_safe_int(row.get('max_amount_numeric_manwon')):,}만원"
            policy_lines.append(f"- {title} / {support} / {deadline}")
        return {
            "text": "저장된 매칭 지원사업 snapshot입니다.\n" + ("\n".join(policy_lines) if policy_lines else "- 매칭 정책 없음"),
            "cards": [{"type": "policy_snapshot_cards", "data": policies[:5]}],
            "answer_source": "database",
            "used_roi_recalculation": False,
        }

    if action == "application_draft_status":
        draft_content = _as_text(bundle.get("draft_content"))
        analysis_id = _as_text(bundle.get("analysis_id"))
        if draft_content:
            return {
                "text": f"신청서 초안이 준비되어 있습니다.\n{draft_content[:360]}",
                "cards": [
                    {
                        "type": "application_draft_status",
                        "data": {
                            "status": "ready",
                            "analysis_id": analysis_id,
                            "preview": draft_content[:240],
                        },
                    }
                ],
                "answer_source": "database",
                "used_roi_recalculation": False,
            }
        return {
            "text": "현재 분석에 연결된 신청서 초안이 아직 없습니다. 신청서 탭에서 초안을 생성해 주세요.",
            "cards": [
                {
                    "type": "application_draft_status",
                    "data": {"status": "missing", "analysis_id": analysis_id},
                }
            ],
            "answer_source": "database",
            "used_roi_recalculation": False,
        }

    if action == "investment_simulation":
        simulated = _simulate_with_input(bundle, _as_dict(simulation_input))
        simulated["answer_source"] = "simulation"
        simulated["used_roi_recalculation"] = True
        return simulated

    return None


def _build_start_analysis_answer(equipments: list[dict]):
    if not equipments:
        return {
            "text": "등록된 설비가 없습니다. 먼저 설비 정보를 등록한 뒤 ROI 분석을 시작해 주세요.",
            "cards": [],
            "answer_source": "missing_data",
            "used_roi_recalculation": False,
        }
    return {
        "text": (
            "등록된 설비를 기반으로 ROI 분석, 투자 시나리오 비교, 맞춤 정책 추천, 신청서 초안 작성을 도와드릴 수 있어요.\n\n"
            "어떤 설비에 대해 분석해드릴까요?"
        ),
        "cards": [
            {
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
            }
        ],
        "answer_source": "missing_data",
        "used_roi_recalculation": False,
    }


def _simulate_with_new_investment(bundle: dict, query: str):
    amount_manwon = _find_amount_manwon(query)
    if amount_manwon is None:
        raise HTTPException(status_code=400, detail="투자금 숫자를 인식하지 못했습니다.")
    db = get_db()
    equipment_result = (
        db.table("equipment")
        .select("*")
        .eq("company_id", bundle.get("company_id"))
        .eq("equipment_id", bundle.get("equipment_id"))
        .limit(1)
        .execute()
    )
    if not equipment_result.data:
        raise HTTPException(status_code=404, detail="시뮬레이션용 설비 정보를 찾을 수 없습니다.")
    equipment_row = _as_dict(equipment_result.data[0])
    scenario_target = "both"
    if "a안" in query:
        scenario_target = "a"
    elif "b안" in query:
        scenario_target = "b"
    scenario_a = amount_manwon if scenario_target in {"a", "both"} else equipment_row.get("scenario_a_investment_manwon")
    scenario_b = amount_manwon if scenario_target in {"b", "both"} else equipment_row.get("scenario_b_investment_manwon")
    simulation_equipment = EquipmentInput(
        name=_as_text(equipment_row.get("name")),
        category=_as_text(equipment_row.get("category")),
        age_years=_safe_int(equipment_row.get("age_years")),
        energy_cost_annual=_safe_int(equipment_row.get("energy_cost_annual")),
        defect_rate=equipment_row.get("defect_rate"),
        maintenance_cost_annual=_safe_int(equipment_row.get("maintenance_cost_annual")),
        current_capacity_value=equipment_row.get("current_capacity_value"),
        production_qty=equipment_row.get("production_qty"),
        process=equipment_row.get("process"),
        contribution_margin_won=equipment_row.get("contribution_margin_won"),
        scenario_a_investment_manwon=_safe_int(scenario_a),
        scenario_b_investment_manwon=_safe_int(scenario_b),
    )
    roi_data = _as_dict(bundle.get("roi_data"))
    policy_applications = _as_dict(roi_data.get("policy_applications"))
    energy_provided = _safe_float(equipment_row.get("energy_cost_annual"), 0) > 0
    simulated = calculate_roi(simulation_equipment, energy_provided=energy_provided, policy_applications=policy_applications if policy_applications else None)
    a = _scenario_metrics(simulated, "scenario_a")
    b = _scenario_metrics(simulated, "scenario_b")
    recommended = _as_text(simulated.get("recommended")).upper() or "A"
    text = (
        "임시 시뮬레이션 결과입니다. (저장되지 않음)\n"
        f"A안 ROI {a['roi_pct']:.1f}% / 회수 {a['payback_years']:.2f}년, "
        f"B안 ROI {b['roi_pct']:.1f}% / 회수 {b['payback_years']:.2f}년, 추천 {recommended}안"
    )
    return {"text": text, "cards": [{"type": "roi_simulation", "data": simulated}]}


def _build_metadata(
    *,
    answer_source: str,
    analysis_id: str,
    session_id: str,
    used_graph: bool = False,
    used_llm: bool = False,
    used_roi_recalculation: bool = False,
    used_policy_matching: bool = False,
):
    return {
        "answer_source": answer_source,
        "used_graph": used_graph,
        "used_llm": used_llm,
        "used_roi_recalculation": used_roi_recalculation,
        "used_policy_matching": used_policy_matching,
        "analysis_id": analysis_id,
        "session_id": session_id,
    }


def _upsert_session(
    *,
    company_id: str,
    session_id: str,
    analysis_id: str,
    equipment_id: str,
    intent: str,
    user_message: str,
    assistant_message: str,
    server_history: list[dict],
    client_history: list[dict],
):
    db = get_db()
    existing_row = _get_session_row(company_id, session_id)
    base_history = _merge_histories(server_history, client_history)
    history = _normalize_chat_history(base_history)
    now_iso = datetime.now().isoformat()
    history.append({"role": "user", "content": user_message, "created_at": now_iso})
    history.append({"role": "assistant", "content": assistant_message, "created_at": datetime.now().isoformat()})
    title = ""
    for item in history:
        if item.get("role") == "user":
            title = _as_text(item.get("content"))[:64]
            if title:
                break
    if not title:
        title = "새 대화"
    payload = {
        "company_id": company_id,
        "chat_id": session_id,
        "intent": intent,
        "user_query": title,
        "final_response": assistant_message,
        "chat_history": history[-80:],
        "roi_result": {"analysis_id": analysis_id, "equipment_id": equipment_id},
        "created_at": datetime.now().isoformat(),
    }
    if existing_row.data:
        db.table("chat_history").update(payload).eq("company_id", company_id).eq("chat_id", session_id).execute()
        return
    db.table("chat_history").insert(payload).execute()


class AdvisorChatService:
    @staticmethod
    def ensure_company_owner(company_id: str, current_user_id: str):
        _ensure_company_owner(company_id, current_user_id)

    @staticmethod
    def list_sessions(company_id: str, limit: int):
        return _list_sessions(company_id, limit)

    @staticmethod
    def get_session(company_id: str, session_id: str):
        row = _get_session_row(company_id, session_id)
        if not row.data:
            raise HTTPException(status_code=404, detail="대화 내역을 찾을 수 없습니다.")
        item = _as_dict(row.data[0])
        history = _normalize_chat_history(item.get("chat_history") if isinstance(item.get("chat_history"), list) else [])
        summary = _session_summary_from_row(item)
        return {
            "session_id": summary["session_id"],
            "chat_id": summary["chat_id"],
            "title": summary["title"],
            "preview": summary["preview"],
            "analysis_id": summary["analysis_id"],
            "updated_at": summary["updated_at"],
            "created_at": summary["created_at"],
            "messages": history,
        }

    @staticmethod
    def create_session(company_id: str, analysis_id: str = "", equipment_id: str = ""):
        session_id = _safe_session_id()
        now_iso = datetime.now().isoformat()
        result = (
            get_db()
            .table("chat_history")
            .insert(
                {
                    "chat_id": session_id,
                    "company_id": company_id,
                    "intent": "general",
                    "user_query": "새 대화",
                    "final_response": "",
                    "chat_history": [],
                    "roi_result": {"analysis_id": _as_text(analysis_id), "equipment_id": _as_text(equipment_id)},
                    "created_at": now_iso,
                }
            )
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=500, detail="새 대화 세션 생성에 실패했습니다.")
        return _session_summary_from_row(result.data[0])

    @staticmethod
    async def handle_chat(req):
        try:
            if not req.company_id:
                return {"intent": "response", "response": "로그인 후 이용하실 수 있습니다.", "cards": [], "next_questions": [], "chat_id": "", "session_id": ""}

            requested_session_id = _as_text(req.session_id) or _as_text(req.chat_id)
            session_row = None
            server_history = []
            if requested_session_id:
                session_row = _get_session_row(req.company_id, requested_session_id)
                if not session_row.data:
                    raise HTTPException(status_code=404, detail="선택한 대화 세션을 찾을 수 없습니다.")
                server_history = _as_dict(session_row.data[0]).get("chat_history") or []

            session_id = _safe_session_id(requested_session_id)
            query = _as_text(req.message).lower()
            action = _as_text(req.action).lower()
            analysis_id = _as_text(req.analysis_id)
            if not analysis_id and requested_session_id and session_row and session_row.data:
                analysis_id = _as_text(_as_dict(_as_dict(session_row.data[0]).get("roi_result")).get("analysis_id"))
            explicit_action = action in (
                EXPLICIT_DB_ACTIONS | EXPLICIT_SIMULATION_ACTIONS | EXPLICIT_NEW_ANALYSIS_ACTIONS
            )
            if not analysis_id and explicit_action and action not in EXPLICIT_NEW_ANALYSIS_ACTIONS:
                analysis_id = _latest_analysis_id(req.company_id)
            if not analysis_id and not _is_new_analysis_request(query, action) and not explicit_action:
                analysis_id = _latest_analysis_id(req.company_id)

            bundle = _load_analysis_bundle(req.company_id, analysis_id) if analysis_id else None
            if analysis_id and not bundle:
                metadata = _build_metadata(answer_source="db_error", analysis_id=analysis_id, session_id=session_id)
                response_text = "요청한 분석 데이터를 조회하지 못했습니다. 분석 선택 상태를 다시 확인해 주세요."
                _upsert_session(
                    company_id=req.company_id,
                    session_id=session_id,
                    analysis_id=analysis_id,
                    equipment_id="",
                    intent="response",
                    user_message=req.message,
                    assistant_message=response_text,
                    server_history=server_history,
                    client_history=req.chat_history,
                )
                payload = {"intent": "response", "response": response_text, "cards": [], "next_questions": [], "chat_id": session_id, "session_id": session_id, "analysis_id": analysis_id}
                if _is_dev_mode():
                    payload["metadata"] = metadata
                return payload

            company_info = _load_company_context(req.company_id)
            equipments = _load_company_equipments(req.company_id)
            requested_equipment_id = _as_text(req.selected_equipment_id)
            if analysis_id and not requested_equipment_id:
                requested_equipment_id = _resolve_equipment_from_analysis(req.company_id, analysis_id)
            selected_equipment = next(
                (item for item in equipments if _as_text(item.get("equipment_id")) == requested_equipment_id),
                None,
            ) if requested_equipment_id else None
            selected_equipment_input = _build_equipment_input(selected_equipment) if selected_equipment else None
            selected_equipment_name = _as_text((selected_equipment or {}).get("name"))

            if explicit_action:
                if action in {"start_analysis", "new_analysis"}:
                    answered = _build_start_analysis_answer(equipments)
                    answer_source = answered["answer_source"]
                    response_text = answered["text"]
                    cards = answered["cards"]
                    used_roi_recalculation = False
                    used_graph = False
                    used_llm = False
                    intent_value = "info_missing"
                    resolved_analysis_id = analysis_id
                    resolved_equipment_id = requested_equipment_id
                    metadata = _build_metadata(
                        answer_source=answer_source,
                        analysis_id=resolved_analysis_id,
                        session_id=session_id,
                        used_graph=used_graph,
                        used_llm=used_llm,
                        used_roi_recalculation=used_roi_recalculation,
                    )
                    _upsert_session(
                        company_id=req.company_id,
                        session_id=session_id,
                        analysis_id=resolved_analysis_id,
                        equipment_id=resolved_equipment_id,
                        intent=intent_value,
                        user_message=req.message,
                        assistant_message=response_text,
                        server_history=server_history,
                        client_history=req.chat_history,
                    )
                    payload = {
                        "intent": intent_value,
                        "response": response_text,
                        "cards": cards,
                        "next_questions": [],
                        "chat_id": session_id,
                        "session_id": session_id,
                        "resolved_equipment_id": resolved_equipment_id,
                        "analysis_id": resolved_analysis_id,
                        "metadata": metadata,
                    }
                    return payload
                if action in EXPLICIT_DB_ACTIONS | EXPLICIT_SIMULATION_ACTIONS:
                    answered = _build_explicit_action_answer(
                        action,
                        bundle,
                        getattr(req, "simulation_input", None) or {},
                    )
                    if answered:
                        answer_source = answered["answer_source"]
                        response_text = answered["text"]
                        cards = answered["cards"]
                        used_roi_recalculation = answered.get("used_roi_recalculation", False)
                        used_graph = False
                        used_llm = False
                        intent_value = "response"
                        resolved_analysis_id = _as_text(bundle.get("analysis_id")) if bundle else analysis_id
                        resolved_equipment_id = _as_text(bundle.get("equipment_id")) if bundle else ""
                        metadata = _build_metadata(
                            answer_source=answer_source,
                            analysis_id=resolved_analysis_id,
                            session_id=session_id,
                            used_graph=used_graph,
                            used_llm=used_llm,
                            used_roi_recalculation=used_roi_recalculation,
                        )
                        _upsert_session(
                            company_id=req.company_id,
                            session_id=session_id,
                            analysis_id=resolved_analysis_id,
                            equipment_id=resolved_equipment_id,
                            intent=intent_value,
                            user_message=req.message,
                            assistant_message=response_text,
                            server_history=server_history,
                            client_history=req.chat_history,
                        )
                        payload = {
                            "intent": intent_value,
                            "response": response_text,
                            "cards": cards,
                            "next_questions": [],
                            "chat_id": session_id,
                            "session_id": session_id,
                            "resolved_equipment_id": resolved_equipment_id,
                            "analysis_id": resolved_analysis_id,
                            "metadata": metadata,
                        }
                        return payload

            answer_source = "missing_data"
            response_text = "현재 조회 가능한 분석 데이터가 없습니다. 먼저 분석을 선택하거나 실행해 주세요."
            cards = []
            used_roi_recalculation = False
            used_graph = False
            used_llm = False
            intent_value = "response"
            if _is_reanalysis_request(query, action):
                answer_source = "reanalysis"
                response_text = "재분석 요청으로 확인했습니다. 기존 분석값은 자동 덮어쓰지 않습니다. 원하시면 새 analysis_id로 재분석을 시작하겠습니다."
                cards = [{"type": "reanalysis_confirmation", "data": {"analysis_id": analysis_id}}]
            elif bundle and _is_simulation_request(query, action):
                answer_source = "simulation"
                simulated = _simulate_with_new_investment(bundle, query)
                response_text = simulated["text"]
                cards = simulated["cards"]
                used_roi_recalculation = True
            elif bundle:
                answer_source = "database"
                answered = _build_database_answer(bundle, query, action)
                response_text = answered["text"]
                cards = answered["cards"]
            elif _is_graph_worthy_no_bundle(query, action):
                initial_state = {
                    "user_query": req.message,
                    "intent": "",
                    "is_safe": True,
                    "company_info": company_info,
                    "equipment": selected_equipment_input,
                    "equipment_id": _as_text((selected_equipment or {}).get("equipment_id")) or None,
                    "equipments": equipments,
                    "selected_equipment_id": requested_equipment_id or None,
                    "policy_intent_choice": _as_text(req.policy_intent_choice) or None,
                    "selected_equipment_for_policy": selected_equipment_name or None,
                    "matched_policies": [],
                    "selected_policy": None,
                    "roi_result": None,
                    "draft_result": None,
                    "draft_context": None,
                    "chat_history": _merge_histories(server_history, req.chat_history),
                    "final_response": "",
                    "unsupported_equipment": False,
                    "chat_id": session_id,
                    "safety_dashboard": None,
                    "options": None,
                    "analysis_id": None,
                }
                graph_result = await factofit_graph.ainvoke(initial_state)
                used_graph = True
                used_llm = True
                answer_source = "missing_data"
                intent_value = _as_text(graph_result.get("intent")) or "response"
                response_text = _as_text(graph_result.get("final_response")) or response_text
                cards = _cards_from_graph_result(graph_result)
            else:
                if len(equipments) > 0:
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

            resolved_analysis_id = _as_text(bundle.get("analysis_id")) if bundle else analysis_id
            resolved_equipment_id = _as_text(bundle.get("equipment_id")) if bundle else ""
            metadata = _build_metadata(
                answer_source=answer_source,
                analysis_id=resolved_analysis_id,
                session_id=session_id,
                used_graph=used_graph,
                used_llm=used_llm,
                used_roi_recalculation=used_roi_recalculation,
                used_policy_matching=False,
            )
            _upsert_session(
                company_id=req.company_id,
                session_id=session_id,
                analysis_id=resolved_analysis_id,
                equipment_id=resolved_equipment_id,
                intent=intent_value,
                user_message=req.message,
                assistant_message=response_text,
                server_history=server_history,
                client_history=req.chat_history,
            )
            payload = {
                "intent": intent_value,
                "response": response_text,
                "cards": cards,
                "next_questions": [],
                "chat_id": session_id,
                "session_id": session_id,
                "resolved_equipment_id": resolved_equipment_id,
                "analysis_id": resolved_analysis_id,
            }
            if _is_dev_mode():
                payload["metadata"] = metadata
            return payload
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ 채팅 에러: {e}")
            import traceback
            traceback.print_exc()
            return {"intent": "response", "response": f"에러 발생: {str(e)}", "cards": [], "next_questions": [], "chat_id": "", "session_id": ""}
