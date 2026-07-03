from __future__ import annotations

from datetime import date
from typing import Any, Optional
import json
import re

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.capex import (
    analyze_roi_followup,
    compare_roi_results,
    compare_scenarios,
    format_roi_result,
    show_roi_detail,
)
from app.core.database import get_db
from app.core.llm import llm
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.state import FactofitState
from app.tools.query_builder import _get_impact_keywords
from app.tools.roi_calc_tool import calculate_equipment_roi
from app.tools.vector_search import search_policies


UNKNOWN_DEADLINE_VALUES = {"", "none", "null", "nan", "마감일 미정", "상시"}
POLICY_REASON_CHECK_SENTENCE = (
    "세부 지원한도와 제출서류, 마감일, 자격조건은 공고 원문 확인이 필요합니다."
)


# ============================================================================
# 공통 유틸리티
# ============================================================================

def _normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _parse_deadline(value: Any) -> Optional[date]:
    if value is None:
        return None

    normalized = str(value).strip()
    if normalized.lower() in UNKNOWN_DEADLINE_VALUES:
        return None

    try:
        return date.fromisoformat(normalized[:10])
    except ValueError:
        return None


def _decorate_policy_deadline(policy: dict) -> dict:
    metadata = policy.get("metadata", {})
    metadata = dict(metadata) if isinstance(metadata, dict) else {}
    decorated = {**policy, "metadata": metadata}
    deadline = _parse_deadline(
        decorated.get("deadline") or metadata.get("deadline")
    )

    if deadline is None:
        decorated["deadline_date"] = None
        decorated["d_day"] = None
        decorated["urgency_label"] = "마감일 미정"
        decorated["metadata"]["deadline_display"] = "마감일 미정"
        decorated["metadata"]["d_day"] = None
        decorated["metadata"]["urgency_label"] = "마감일 미정"
        return decorated

    d_day = (deadline - date.today()).days
    urgency_label = "🚨 긴급" if d_day <= 30 else "⚠️ 임박" if d_day <= 60 else ""

    decorated["deadline_date"] = deadline.isoformat()
    decorated["d_day"] = d_day
    decorated["urgency_label"] = urgency_label
    decorated["metadata"]["deadline_display"] = deadline.isoformat()
    decorated["metadata"]["d_day"] = d_day
    decorated["metadata"]["urgency_label"] = urgency_label
    return decorated


def _sort_policy_deadline(policy: dict) -> int:
    d_day = policy.get("d_day")
    return d_day if isinstance(d_day, int) else 999999


def _equipment_name(equipment: Any) -> str:
    if not equipment:
        return "정보 없음"
    if hasattr(equipment, "equipment") and hasattr(equipment.equipment, "name"):
        return equipment.equipment.name
    if hasattr(equipment, "name"):
        return equipment.name
    return "정보 있음"


def _policy_field(policy: dict, key: str, default: Any = None) -> Any:
    """최상위 필드 우선, 없으면 metadata에서 조회한다."""
    if policy.get(key) is not None:
        return policy.get(key)

    metadata = policy.get("metadata")
    if isinstance(metadata, dict) and metadata.get(key) is not None:
        return metadata.get(key)

    return default


def _policy_key(policy: dict) -> Optional[str]:
    return (
        policy.get("id")
        or _policy_field(policy, "policy_id")
        or _policy_field(policy, "title")
    )


# ============================================================================
# 기존 정책 매칭 노드 - LangGraph 구조는 변경하지 않음
# ============================================================================

def match_policies(company_context: dict, query: str) -> list[dict]:
    company_codes = _normalize_list(company_context.get("industry_code"))
    region = company_context.get("region", "")
    region_short = region.split()[0] if region else ""
    company_type_values = _normalize_list(company_context.get("company_type"))

    results = search_policies(query, n_results=20, where=None)
    filtered: list[dict] = []

    for policy in results:
        metadata = policy.get("metadata", {})
        metadata = metadata if isinstance(metadata, dict) else {}

        policy_codes = _normalize_list(
            metadata.get("industry_code") or metadata.get("industry_codes")
        )
        code_match = (
            not company_codes
            or not policy_codes
            or "C" in policy_codes
            or any(code in policy_codes for code in company_codes)
        )

        policy_region = str(metadata.get("region") or "")
        region_match = (
            not region
            or not policy_region
            or region_short in policy_region
            or "전국" in policy_region
        )

        eligible_types = _normalize_list(
            metadata.get("eligible_company_types", [])
        )
        type_match = (
            not eligible_types
            or not company_type_values
            or any(company_type in eligible_types for company_type in company_type_values)
        )

        if code_match and region_match and type_match:
            filtered.append(policy)

    return filtered[:10]


def policy_matching_node(state: FactofitState) -> FactofitState:
    """
    기존 LangGraph에서 호출하는 정책 매칭 노드.
    함수 시그니처와 state 구조는 유지한다.
    """
    equipment = state.get("equipment")
    company = state.get("company_info")

    company_context = {
        "industry_code": company.industry_code if company else None,
        "region": company.region if company else None,
        "company_type": company.company_type if company else None,
        "employee_count": company.employee_count if company else None,
        "annual_revenue": company.annual_revenue if company else None,
    }
    retrieved = match_policies(company_context, state.get("user_query", ""))

    decorated = [_decorate_policy_deadline(policy) for policy in retrieved]
    valid = [
        policy
        for policy in decorated
        if policy.get("d_day") is None or policy["d_day"] >= 0
    ]
    sorted_policies = sorted(valid, key=_sort_policy_deadline)
    state["matched_policies"] = sorted_policies

    prompt = POLICY_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company else "정보 없음",
        region=company.region if company else "정보 없음",
        company_type=company.company_type if company else "정보 없음",
        employee_count=company.employee_count if company else "정보 없음",
        annual_revenue=(company.annual_revenue or "정보 없음") if company else "정보 없음",
        equipment_info=_equipment_name(equipment),
        retrieved_policies=sorted_policies if sorted_policies else "검색된 공고 없음",
    )

    response = llm.invoke(
        [
            SystemMessage(content=prompt),
            HumanMessage(content=state.get("user_query", "")),
        ]
    )

    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```", 2)[1]
            if content.startswith("json"):
                content = content[4:]

        result = json.loads(content.strip())
        response_text = result.get("response", "")
        matched_ids_info = result.get("matched_policies", [])

        reason_map = {
            item.get("id"): item
            for item in matched_ids_info
            if isinstance(item, dict) and item.get("id")
        }
        selected_ids = set(reason_map)
        selected_policies = (
            [
                policy
                for policy in sorted_policies
                if policy.get("id") in selected_ids
            ]
            if selected_ids
            else sorted_policies[:5]
        )

        state["matched_policies"] = [
            {
                **policy,
                "eligible": True,
                "reason": reason_map.get(policy.get("id"), {}).get(
                    "reason",
                    "업종/지역/기업규모 기반 매칭",
                ),
                "llm_score": reason_map.get(policy.get("id"), {}).get(
                    "score",
                    "●●●○○",
                ),
            }
            for policy in selected_policies
        ]

        prefix = ""
        if state.get("unsupported_equipment"):
            prefix = (
                "현재 해당 설비의 ROI 계산은 지원하지 않지만, "
                "관련 지원사업을 찾아드릴게요!\n\n"
            )
        state["final_response"] = prefix + response_text
    except Exception:
        state["matched_policies"] = [
            {
                **policy,
                "eligible": True,
                "reason": "업종/지역/기업규모 기반 매칭",
                "llm_score": "●●●○○",
            }
            for policy in sorted_policies[:5]
        ]
        state["final_response"] = response.content

    return state


# ============================================================================
# A/B 정책 후보 생성 및 ROI 기반 재정렬
# ============================================================================

def merge_policy_candidates(
    a_candidates: list[dict],
    b_candidates: list[dict],
) -> list[dict]:
    """
    A/B 검색 결과를 policy_id/title 기준으로 병합한다.
    공통 후보는 scenario_match=["a", "b"]가 된다.
    """
    merged: dict[str, dict] = {}

    for scenario, candidates in (("a", a_candidates), ("b", b_candidates)):
        for policy in candidates:
            key = _policy_key(policy)
            if not key:
                continue

            if key not in merged:
                merged[key] = {**policy, "scenario_match": [scenario]}
                continue

            existing = merged[key]
            if scenario not in existing["scenario_match"]:
                existing["scenario_match"].append(scenario)
            existing["distance"] = min(
                existing.get("distance", 1),
                policy.get("distance", 1),
            )

    return list(merged.values())


def _get_roi_impact_keywords(roi_result: dict, scenario: str) -> list[str]:
    if scenario == "c":
        return (
            _get_impact_keywords(
                roi_result.get("scenario_a", {}).get("breakdown", {})
            )
            + _get_impact_keywords(
                roi_result.get("scenario_b", {}).get("breakdown", {})
            )
        )

    scenario_key = "scenario_a" if scenario == "a" else "scenario_b"
    breakdown = roi_result.get(scenario_key, {}).get("breakdown", {})
    return _get_impact_keywords(breakdown)


def _normalize_scenario_match_for_response(
    scenario_match: list[str],
) -> list[str]:
    return ["c"] if set(scenario_match) == {"a", "b"} else scenario_match


def _first_policy_text(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value is not None and not isinstance(value, (dict, list)):
            return str(value).strip()
    return ""


def _shorten_policy_reason(reason: str) -> str:
    cleaned = " ".join(str(reason or "").split())
    if not cleaned:
        return ""

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?。])\s+", cleaned)
        if sentence.strip()
    ]
    return cleaned if len(sentences) <= 2 else " ".join(sentences[:2])


def _policy_support_focus(policy: dict) -> str:
    metadata = policy.get("metadata", {})
    metadata = metadata if isinstance(metadata, dict) else {}
    text = " ".join(
        str(value or "")
        for value in (
            metadata.get("service_category"),
            metadata.get("policy_category"),
            metadata.get("title"),
            policy.get("content"),
        )
    )

    if any(keyword in text for keyword in ("스마트공장", "자동화", "DX", "AI")):
        return "스마트공장·자동화 지원"
    if any(keyword in text for keyword in ("에너지", "효율", "절감")):
        return "에너지효율 개선 지원"
    if any(keyword in text for keyword in ("안전", "위험", "노후")):
        return "노후·안전 개선 지원"
    if any(keyword in text for keyword in ("컨설팅", "진단")):
        return "컨설팅·진단 지원"
    if any(keyword in text for keyword in ("인증", "시험", "평가")):
        return "인증·평가 지원"
    return "설비·공정 개선 지원"


def _default_policy_reason(
    policy: dict,
    company_context: dict,
    equipment_name: str,
) -> str:
    industry_codes = company_context.get("industry_code") or []
    industry_text = (
        industry_codes
        if isinstance(industry_codes, str)
        else ", ".join(str(code) for code in industry_codes if code)
    )
    region = company_context.get("region") or "대상 지역"
    company_type = company_context.get("company_type") or "기업 조건"
    scenario_label = policy.get("scenario_label") or "투자 목적"

    return (
        f"{industry_text or '해당 업종'} 및 {region} 지역, {company_type} 조건과 "
        f"부합하며, {equipment_name or '해당 설비'}의 {scenario_label} 목적과 "
        f"{_policy_support_focus(policy)} 방향이 유사합니다. "
        f"{POLICY_REASON_CHECK_SENTENCE}"
    )


def _standardize_policy_reason(
    policy: dict,
    company_context: dict,
    equipment_name: str,
    llm_reason: Optional[str],
) -> str:
    reason = _first_policy_text(llm_reason)
    if not reason:
        return _default_policy_reason(policy, company_context, equipment_name)

    if "확인" not in reason and "원문" not in reason:
        reason = f"{reason.rstrip('.')} {POLICY_REASON_CHECK_SENTENCE}"
    return _shorten_policy_reason(reason)


def rerank_policies_with_roi(
    policies: list[dict],
    roi_result: dict,
) -> list[dict]:
    """
    1차 후보를 A/B 시나리오 및 개선 목적 기준으로 재정렬한다.
    지원금 최종 계산은 resolve_scenario_policy_support에서 별도로 한다.
    """
    ranked: list[dict] = []

    for policy in policies:
        metadata = policy.get("metadata", {})
        metadata = metadata if isinstance(metadata, dict) else {}

        scenario_match = policy.get("scenario_match", [])
        display_match = _normalize_scenario_match_for_response(scenario_match)

        base_score = 1 - float(policy.get("distance", 1) or 1)
        scenario_bonus = 0.1 if scenario_match else 0
        common_bonus = 0.05 if set(scenario_match) == {"a", "b"} else 0

        text = " ".join(
            str(value or "")
            for value in (
                metadata.get("title"),
                metadata.get("policy_category"),
                metadata.get("service_category"),
                policy.get("content"),
            )
        )
        impact_keywords: list[str] = []
        for scenario in scenario_match:
            impact_keywords.extend(_get_roi_impact_keywords(roi_result, scenario))
        impact_bonus = 0.1 if any(keyword in text for keyword in impact_keywords) else 0

        amount_bonus = 0
        try:
            if float(metadata.get("max_amount") or 0) >= 5000:
                amount_bonus = 0.05
        except (TypeError, ValueError):
            pass

        if display_match == ["c"]:
            scenario_label = "C안 공통 적합"
        elif display_match == ["a"]:
            scenario_label = "A안 전체교체 적합"
        elif display_match == ["b"]:
            scenario_label = "B안 부분개선 적합"
        else:
            scenario_label = ""

        final_score = base_score + scenario_bonus + common_bonus + impact_bonus + amount_bonus
        ranked.append(
            {
                **policy,
                "scenario_match": display_match,
                "scenario_label": scenario_label,
                "final_score": round(final_score, 3),
                "match_score": round(final_score, 3),
            }
        )

    return sorted(ranked, key=lambda policy: policy.get("final_score", 0), reverse=True)


# ============================================================================
# 정책별 실제 적용 지원금 산정 - ROI 연동용
# ============================================================================

def _support_parse_number(value: Any) -> Optional[float]:
    """금액 문자열을 내부 단위(만원) 숫자로 정규화한다."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip().replace(",", "").replace(" ", "")
    if not text or text.lower() in {"none", "null", "nan", "-"}:
        return None

    match = re.search(r"(\d+(?:\.\d+)?)억", text)
    if match:
        return float(match.group(1)) * 10000

    match = re.search(r"(\d+(?:\.\d+)?)천만", text)
    if match:
        return float(match.group(1)) * 1000

    match = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else None


def _support_parse_rate(value: Any) -> Optional[float]:
    """55, '55%', 0.55를 모두 0~1 비율로 변환한다."""
    number = _support_parse_number(value)
    if number is None or number < 0:
        return None
    if number <= 1:
        return number
    if number <= 100:
        return number / 100
    return None


def _support_value(policy: dict, *keys: str) -> Any:
    for key in keys:
        value = _policy_field(policy, key)
        if value is not None:
            return value
    return None


def _support_scenario_tags(policy: dict) -> set[str]:
    raw = _support_value(policy, "scenario_match")
    if raw is None:
        return set()
    if isinstance(raw, list):
        return {str(value).strip().lower() for value in raw if str(value).strip()}
    return {item.strip().lower() for item in str(raw).split(",") if item.strip()}


def _support_matches_scenario(policy: dict, scenario: str) -> bool:
    tags = _support_scenario_tags(policy)
    # 태그가 없는 일반 설비정책은 후보로 두되 A/B 전용 정책보다 우선순위가 낮아진다.
    return not tags or scenario in tags or "c" in tags


def _support_policy_score(policy: dict) -> float:
    for key in ("hybrid_score", "final_score", "match_score"):
        try:
            return float(_support_value(policy, key))
        except (TypeError, ValueError):
            continue
    return 0.0


def _estimate_policy_support(policy: dict, investment_manwon: float) -> dict:
    """
    해당 정책의 실제 적용 지원금 1건을 계산한다.
    지원율이 없으면 max_amount를 실제 수혜액으로 사용하지 않는다.
    """
    support_rate = _support_parse_rate(
        _support_value(
            policy,
            "support_rate",
            "support_ratio",
            "subsidy_rate",
            "funding_rate",
            "government_support_rate",
        )
    )
    max_amount = _support_parse_number(
        _support_value(
            policy,
            "max_amount_manwon",
            "max_amount",
            "support_limit",
            "support_amount",
            "subsidy_amount",
        )
    )
    eligible_cost_ratio = _support_parse_rate(
        _support_value(
            policy,
            "eligible_cost_ratio",
            "eligible_investment_ratio",
            "eligible_ratio",
        )
    )

    eligible_investment = investment_manwon * (
        eligible_cost_ratio if eligible_cost_ratio is not None else 1.0
    )

    if support_rate is None:
        return {
            "status": "terms_missing",
            "support_rate": None,
            "max_amount_manwon": max_amount,
            "eligible_investment_manwon": round(eligible_investment, 1),
            "applied_support_manwon": 0,
            "message": (
                "정책 지원율이 구조화되어 있지 않아 추천에는 포함하되 "
                "ROI 지원금에는 반영하지 않았습니다."
            ),
        }

    support_by_rate = eligible_investment * support_rate
    caps = [investment_manwon, eligible_investment, support_by_rate]
    if max_amount is not None:
        caps.append(max_amount)

    applied_support = max(0, min(caps))
    return {
        "status": "applied" if max_amount is not None else "estimated",
        "support_rate": support_rate,
        "max_amount_manwon": max_amount,
        "eligible_investment_manwon": round(eligible_investment, 1),
        "applied_support_manwon": int(round(applied_support)),
        "message": (
            "투자금 × 지원율, 정책 상한, 인정 투자비 한도를 반영했습니다."
            if max_amount is not None
            else "지원율 기준 추정치입니다. 정책 최대 지원금은 공고 원문 확인이 필요합니다."
        ),
    }


def resolve_scenario_policy_support(
    scenario: str,
    investment_manwon: Any,
    policies: list[dict],
    company_context: Optional[dict] = None,
) -> dict:
    """
    A 또는 B 시나리오에 ROI 재무값으로 반영할 정책 단 1건을 고른다.

    여러 정책의 최대 지원금을 합산하지 않는다.
    """
    scenario = str(scenario or "").lower()
    investment = _support_parse_number(investment_manwon) or 0

    if scenario not in {"a", "b"}:
        return {
            "status": "invalid_scenario",
            "applied_support_manwon": 0,
            "message": "지원금 산정 시나리오가 올바르지 않습니다.",
        }

    if investment <= 0:
        return {
            "scenario": scenario,
            "status": "invalid_investment",
            "applied_support_manwon": 0,
            "message": "투자금이 없어 정책 지원금을 산정할 수 없습니다.",
        }

    candidates = [
        policy
        for policy in (policies or [])
        if policy.get("eligible", True) is not False
        and _support_matches_scenario(policy, scenario)
    ]
    if not candidates:
        return {
            "scenario": scenario,
            "status": "no_policy",
            "applied_support_manwon": 0,
            "message": "해당 시나리오에 재무 반영 가능한 정책 후보가 없습니다.",
        }

    evaluated: list[dict] = []
    for policy in candidates:
        finance = _estimate_policy_support(policy, investment)
        evaluated.append(
            {
                "policy": policy,
                "finance": finance,
                "score": _support_policy_score(policy),
                "scenario_specific": int(scenario in _support_scenario_tags(policy)),
            }
        )

    finance_ready = [
        item
        for item in evaluated
        if item["finance"]["status"] in {"applied", "estimated"}
    ]

    if finance_ready:
        finance_ready.sort(
            key=lambda item: (
                item["score"],
                item["finance"]["applied_support_manwon"],
                item["scenario_specific"],
            ),
            reverse=True,
        )
        selected = finance_ready[0]
    else:
        evaluated.sort(key=lambda item: (item["score"], item["scenario_specific"]), reverse=True)
        selected = evaluated[0]

    policy = selected["policy"]
    finance = selected["finance"]
    return {
        "scenario": scenario,
        "status": finance["status"],
        "policy_id": _support_value(policy, "policy_id", "id", "matched_policy_id"),
        "policy_title": str(_support_value(policy, "title", "policy_title", "name") or ""),
        "policy_match_score": selected["score"],
        "support_rate": finance.get("support_rate"),
        "max_amount_manwon": finance.get("max_amount_manwon"),
        "eligible_investment_manwon": finance.get("eligible_investment_manwon"),
        "applied_support_manwon": finance.get("applied_support_manwon", 0),
        "calculation_basis": finance.get("message", ""),
        "message": finance.get("message", ""),
    }


# ============================================================================
# LLM 하이브리드 재정렬
# ============================================================================

def evaluate_and_rerank_with_llm(
    top_policies: list[dict],
    company_context: dict,
    equipment_name: str,
    roi_result: dict,
) -> list[dict]:
    if not top_policies:
        return []

    from app.prompts.policy_hybrid import POLICY_HYBRID_PROMPT

    summaries: list[str] = []
    for policy in top_policies:
        metadata = policy.get("metadata", {})
        metadata = metadata if isinstance(metadata, dict) else {}
        summaries.append(
            f"- ID: {policy.get('id')} | 제목: {metadata.get('title')} | "
            f"지원금: {metadata.get('max_amount', '정보없음')} | "
            f"분류: {metadata.get('service_category') or metadata.get('policy_category') or '정보없음'} | "
            f"지역: {metadata.get('region', '정보없음')} | "
            f"매칭 시나리오: {policy.get('scenario_label')}"
        )

    scenario_a = roi_result.get("scenario_a", {}).get("breakdown", {})
    scenario_b = roi_result.get("scenario_b", {}).get("breakdown", {})
    roi_scenarios = (
        f"A안(전체교체/대규모) 타겟: {', '.join(_get_impact_keywords(scenario_a))} / "
        f"B안(부분개선/소규모) 타겟: {', '.join(_get_impact_keywords(scenario_b))}"
    )

    prompt = POLICY_HYBRID_PROMPT.format(
        industry_code=", ".join(company_context.get("industry_code", [])) or "정보 없음",
        region=company_context.get("region") or "정보 없음",
        company_type=company_context.get("company_type") or "정보 없음",
        equipment_info=equipment_name or "제조 설비",
        roi_scenarios=roi_scenarios,
        retrieved_policies="\n".join(summaries),
    )

    try:
        response = llm.invoke([SystemMessage(content=prompt)])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```", 2)[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        evaluations = result.get("matched_policies", [])
        eval_map = {
            item.get("id"): item
            for item in evaluations
            if isinstance(item, dict) and item.get("id")
        }
    except Exception as exc:
        print(f"하이브리드 LLM 평가 실패: {exc}")
        eval_map = {}

    hybrid_ranked: list[dict] = []
    for policy in top_policies:
        evaluation = eval_map.get(policy.get("id"), {})
        llm_score_num = evaluation.get("score_num", 3)
        llm_score_str = evaluation.get("score", "●●●○○")
        reason = _standardize_policy_reason(
            policy,
            company_context,
            equipment_name,
            evaluation.get("reason"),
        )

        try:
            normalized_llm = float(llm_score_num) / 5.0
        except (TypeError, ValueError):
            normalized_llm = 0.6
        try:
            algorithm_score = float(policy.get("final_score", 0.5))
        except (TypeError, ValueError):
            algorithm_score = 0.5

        hybrid_ranked.append(
            {
                **policy,
                "llm_score": llm_score_str,
                "reason": reason,
                "hybrid_score": round(
                    algorithm_score * 0.6 + normalized_llm * 0.4,
                    3,
                ),
            }
        )

    return sorted(
        hybrid_ranked,
        key=lambda policy: policy.get("hybrid_score", 0),
        reverse=True,
    )


# ============================================================================
# DB 기반 1차 후보 및 A/B 키워드 정렬
# ============================================================================

def get_policy_raw_candidates(company_context: dict) -> list[dict]:
    db = get_db()
    company_codes = _normalize_list(company_context.get("industry_code"))
    region = company_context.get("region") or ""
    region_short = region.split()[0] if region else ""
    company_types = _normalize_list(company_context.get("company_type"))

    result = db.table("policy").select("*").execute()
    rows = result.data or []
    candidates: list[dict] = []

    for policy in rows:
        codes = _normalize_list(_policy_field(policy, "industry_codes"))
        policy_region = str(_policy_field(policy, "region", "") or "")
        eligible_types = _normalize_list(
            _policy_field(policy, "eligible_company_types", [])
        )

        code_match = (
            not company_codes
            or not codes
            or "C" in codes
            or any(code in codes for code in company_codes)
        )
        region_match = (
            not region
            or not policy_region
            or "전국" in policy_region
            or region_short in policy_region
        )
        type_match = (
            not eligible_types
            or not company_types
            or any(company_type in eligible_types for company_type in company_types)
        )

        if code_match and region_match and type_match:
            candidates.append(policy)

    return candidates


def format_raw_policy_candidate(policy: dict) -> dict:
    return {
        "policy_id": _policy_field(policy, "policy_id") or _policy_field(policy, "id"),
        "title": _policy_field(policy, "title", ""),
        "organization": _policy_field(policy, "organization", ""),
        "url": _policy_field(policy, "url", ""),
        "deadline": _policy_field(policy, "deadline", ""),
        "max_amount": _policy_field(policy, "max_amount"),
        "industry_code": _policy_field(policy, "industry_codes"),
        "region": _policy_field(policy, "region"),
    }


def _policy_text_for_ranking(policy: dict) -> str:
    return " ".join(
        str(value or "")
        for value in (
            _policy_field(policy, "title", ""),
            _policy_field(policy, "content", ""),
            _policy_field(policy, "eligibility_text", ""),
            _policy_field(policy, "eligibility_evidence", ""),
            _policy_field(policy, "organization", ""),
            _policy_field(policy, "industry_code", ""),
        )
    )


def rank_candidates_by_query(
    candidates: list[dict],
    query: str,
    limit: int = 10,
) -> list[dict]:
    tokens = [token.strip() for token in str(query or "").split() if token.strip()]
    ranked: list[dict] = []

    for policy in candidates:
        text = _policy_text_for_ranking(policy)
        keyword_score = sum(1 for token in tokens if token in text)
        policy_id = _policy_field(policy, "policy_id") or _policy_field(policy, "id")
        title = _policy_field(policy, "title", "")
        content = _policy_field(policy, "content", "") or text

        # 원본 DB 행 전체를 metadata에 둬야 support_rate 등 새 필드도 유지된다.
        metadata = {
            **policy,
            "title": title,
            "organization": _policy_field(policy, "organization", ""),
            "url": _policy_field(policy, "url", ""),
            "deadline": _policy_field(policy, "deadline", ""),
            "max_amount": _policy_field(policy, "max_amount"),
            "industry_code": _policy_field(policy, "industry_codes"),
            "region": _policy_field(policy, "region"),
            "eligible_company_types": _policy_field(policy, "eligible_company_types", []),
        }

        ranked.append(
            {
                "id": policy_id,
                "content": content,
                "metadata": metadata,
                "distance": 1 - min(keyword_score / 10, 0.99),
                "keyword_score": keyword_score,
                "eligible": True,
            }
        )

    return sorted(
        ranked,
        key=lambda item: item.get("keyword_score", 0),
        reverse=True,
    )[:limit]


# ============================================================================
# 채팅용 정책 기능 - 기존 호출 호환 유지
# ============================================================================

def ask_policy_intent(user_query: str) -> dict:
    return {
        "type": "intent_confirmation",
        "message": (
            "등록한 설비에 관한 정책 정보를 원하시나요? "
            "아니면 일반 정책을 알고 싶으신가요?"
        ),
        "options": [
            {"id": "equipment", "label": "등록한 설비 관련"},
            {"id": "general", "label": "일반 정책"},
        ],
    }


def get_user_equipment_list(company_id: str) -> list[dict]:
    db = get_db()
    try:
        result = (
            db.table("equipment")
            .select("*")
            .eq("company_id", company_id)
            .execute()
        )
        return [
            {
                "equipment_id": equipment.get("id") or equipment.get("equipment_id"),
                "name": equipment.get("name", ""),
                "category": equipment.get("category", ""),
            }
            for equipment in (result.data or [])
        ]
    except Exception as exc:
        print(f"Error fetching equipment list: {exc}")
        return []


def get_equipment_policies(company_id: str, equipment_id: str) -> list[dict]:
    db = get_db()
    result = (
        db.table("matched_policy")
        .select("*")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .execute()
    )
    return sorted(
        result.data or [],
        key=lambda policy: policy.get("match_score", 0),
        reverse=True,
    )[:5]


def search_general_policies(
    user_query: str,
    company_industry_code: Optional[str] = None,
    region: Optional[str] = None,
    n_results: int = 5,
) -> list[dict]:
    where = None
    if company_industry_code or region:
        where = {}
        if company_industry_code:
            where["industry_code"] = {"$contains": company_industry_code}
        if region:
            where["region"] = {"$contains": region}
    return search_policies(user_query, n_results=n_results, where=where)


def analyze_followup_query(user_query: str, matched_policies: list) -> dict:
    policy_list = [
        {"index": index, "title": policy.get("title", "")}
        for index, policy in enumerate(matched_policies)
    ]
    prompt = f"""
사용자: "{user_query}"
정책 목록: {json.dumps(policy_list, ensure_ascii=False)}

의도와 정책 번호를 JSON으로 반환하세요.
{{"intent": "sort/more/filter/compare/detail/general", "policy_index": 0}}
"""
    response = llm.invoke([SystemMessage(content=prompt)])
    return json.loads(response.content)


def _load_latest_roi_result(company_id: str, equipment_id: str) -> dict:
    db = get_db()
    result = (
        db.table("roi_output")
        .select("roi_data")
        .eq("company_id", company_id)
        .eq("equipment_id", equipment_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return {}
    row = result.data[0] if isinstance(result.data[0], dict) else {}
    roi_data = row.get("roi_data")
    return roi_data if isinstance(roi_data, dict) else {}


def policy_chat_node(state: FactofitState) -> FactofitState:
    policy_intent_choice = state.get("policy_intent_choice")
    selected_equipment = state.get("selected_equipment_for_policy")
    matched_policies = state.get("matched_policies", [])
    roi_result = state.get("roi_result")
    equipment = state.get("equipment")
    company_info = state.get("company_info")
    company_id = company_info.company_id if company_info else None
    user_query = state.get("user_query", "")
    equipment_id = (
        state.get("selected_equipment_id")
        or state.get("equipment_id")
        or selected_equipment
    )

    if not policy_intent_choice:
        result = ask_policy_intent(user_query)
        state["final_response"] = result["message"]
        state["options"] = result["options"]
        state["intent"] = "response"
        return state

    if policy_intent_choice == "equipment" and not selected_equipment:
        equipments = get_user_equipment_list(company_id)
        state["final_response"] = "어떤 설비의 정책 정보를 원하시나요?"
        state["options"] = [
            {"id": item.get("equipment_id"), "label": item.get("name")}
            for item in equipments
            if item.get("equipment_id")
        ]
        state["intent"] = "response"
        return state

    if policy_intent_choice == "equipment" and equipment_id and not matched_policies:
        if not roi_result:
            roi_result = _load_latest_roi_result(company_id, equipment_id)
            if roi_result:
                state["roi_result"] = roi_result

        if roi_result:
            followup = analyze_roi_followup(user_query, roi_result)
            followup_intent = followup.get("intent")

            if followup_intent == "detail":
                state["final_response"] = show_roi_detail(roi_result, user_query)
                state["intent"] = "response"
                return state
            if followup_intent == "compare":
                state["final_response"] = compare_scenarios(roi_result)
                state["intent"] = "response"
                return state
            if followup_intent == "simulate":
                new_investment = followup.get("new_investment")
                if not equipment or new_investment is None:
                    state["final_response"] = (
                        "시뮬레이션하려면 투자금(만원 단위)과 설비 정보가 필요합니다."
                    )
                    state["intent"] = "response"
                    return state
                if hasattr(equipment, "model_copy"):
                    simulation_equipment = equipment.model_copy(
                        update={"scenario_a_investment_manwon": int(new_investment)}
                    )
                else:
                    data = equipment.dict()
                    data["scenario_a_investment_manwon"] = int(new_investment)
                    simulation_equipment = type(equipment)(**data)
                equipment_data = (
                    simulation_equipment.model_dump()
                    if hasattr(simulation_equipment, "model_dump")
                    else simulation_equipment.dict()
                )
                simulated = calculate_equipment_roi.invoke({"equipment": equipment_data})
                state["final_response"] = compare_roi_results(roi_result, simulated)
                state["intent"] = "response"
                return state

            state["final_response"] = (
                f"{format_roi_result(roi_result)}\n\n"
                "정책 추천을 보려면 '정책 추천'이라고 말씀해 주세요."
            )
            state["intent"] = "response"
            return state

        state["matched_policies"] = get_equipment_policies(company_id, equipment_id)
        state["final_response"] = (
            "선택하신 설비의 적합한 정책들입니다. 더 궁금한 점이 있으신가요?"
        )
        state["intent"] = "response"
        return state

    if policy_intent_choice == "general" and not matched_policies:
        region = company_info.region if company_info else None
        industry_code = (
            company_info.industry_code[0]
            if company_info and company_info.industry_code
            else None
        )
        state["matched_policies"] = search_general_policies(
            user_query,
            industry_code,
            region,
            n_results=5,
        )
        state["final_response"] = "찾은 정책들입니다. 더 궁금한 점이 있으신가요?"
        state["intent"] = "response"
        return state

    if matched_policies:
        followup = analyze_followup_query(user_query, matched_policies)
        intent = followup.get("intent")

        if intent == "general":
            state["intent"] = "general"
            return state

        if intent == "sort":
            criteria = followup.get("criteria", "match_score")
            order = followup.get("order", "desc")
            state["matched_policies"] = sorted(
                matched_policies,
                key=lambda policy: policy.get(criteria, 0),
                reverse=(order == "desc"),
            )
            state["final_response"] = f"{criteria} 기준으로 정렬했습니다."
            state["intent"] = "policy"
            return state

        if intent == "more":
            state["final_response"] = "모든 정책을 보여드립니다."
            state["intent"] = "policy"
            return state

        if intent == "filter":
            criteria = followup.get("criteria")
            filter_value = followup.get("filter_value")
            if criteria == "region":
                filtered = [
                    policy
                    for policy in matched_policies
                    if filter_value in str(
                        policy.get("metadata", {}).get("region", "")
                    )
                ]
            elif criteria == "eligible_company_types":
                filtered = [
                    policy
                    for policy in matched_policies
                    if filter_value in str(
                        policy.get("metadata", {}).get(
                            "eligible_company_types",
                            "",
                        )
                    )
                ]
            else:
                filtered = matched_policies

            state["matched_policies"] = filtered
            state["final_response"] = f"{filter_value} 관련 정책들만 필터링했습니다."
            state["intent"] = "policy"
            return state

        if intent == "compare":
            indexes = followup.get("policy_indices", [0, 1])
            if len(indexes) >= 2:
                policy_a = matched_policies[indexes[0]]
                policy_b = matched_policies[indexes[1]]
                state["final_response"] = (
                    f"【정책 A】{policy_a.get('title')}\n"
                    f"지원금: {policy_a.get('metadata', {}).get('max_amount')}\n"
                    f"마감: {policy_a.get('metadata', {}).get('deadline')}\n\n"
                    f"【정책 B】{policy_b.get('title')}\n"
                    f"지원금: {policy_b.get('metadata', {}).get('max_amount')}\n"
                    f"마감: {policy_b.get('metadata', {}).get('deadline')}"
                )
                state["intent"] = "policy"
            return state

        if intent == "detail":
            policy_index = followup.get("policy_index", 0)
            if 0 <= policy_index < len(matched_policies):
                selected_policy = matched_policies[policy_index]
                if "신청" in user_query:
                    if not state.get("equipment"):
                        state["final_response"] = (
                            "초안서 작성에는 설비 정보가 필요합니다. 등록된 설비로 진행해주세요."
                        )
                        return state
                    state["intent"] = "draft"
                    state["selected_policy"] = selected_policy
                else:
                    state["final_response"] = (
                        f"정책명: {selected_policy.get('title')}\n"
                        f"상세 정보: {selected_policy}"
                    )
                    state["intent"] = "policy"
            return state

    return state
