from langchain_core.messages import SystemMessage, HumanMessage
import json

from app.state import FactofitState
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.tools.vector_search import search_policies
from app.core.llm import llm
from app.tools.query_builder import _get_impact_keywords
from datetime import date


UNKNOWN_DEADLINE_VALUES = {"", "none", "null", "nan", "마감일 미정", "상시"}


def _normalize_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _parse_deadline(value) -> date | None:
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
    decorated = {**policy, "metadata": dict(policy.get("metadata", {}))}
    deadline = _parse_deadline(decorated["metadata"].get("deadline"))

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


def _equipment_name(equipment) -> str:
    if not equipment:
        return "정보 없음"
    if hasattr(equipment, "equipment") and hasattr(equipment.equipment, "name"):
        return equipment.equipment.name
    if hasattr(equipment, "name"):
        return equipment.name
    return "정보 있음"


def match_policies(company_context: dict, query: str) -> list[dict]:
    company_codes = _normalize_list(company_context.get("industry_code"))
    region = company_context.get("region", "")
    region_short = region.split()[0] if region else ""
    company_type_values = _normalize_list(
        company_context.get("company_type")
    )

    policy_query = query
    results = search_policies(policy_query, n_results=20, where=None)

    filtered = []
    for p in results:
        meta = p.get("metadata", {})
        policy_codes = _normalize_list(meta.get("industry_code"))
        code_match = (
            not company_codes
            or not policy_codes
            or "C" in policy_codes
            or any(code in policy_codes for code in company_codes)
        )

        meta_region = meta.get("region", "")
        region_match = (
            not region
            or not meta_region
            or region_short in meta_region
            or "서울" in meta_region
            or "전국" in meta_region
        )

        eligible_types = _normalize_list(meta.get("eligible_company_types", []))
        type_match = (
            not eligible_types
            or not company_type_values
            or any(company_type in eligible_types for company_type in company_type_values)
        )

        # 직원수 필터 (일단 주석처리)
        # employee_count = company_context.get("employee_count")
        # employee_min = meta.get("employee_min")
        # employee_max = meta.get("employee_max")
        # employee_match = (
        #     not employee_count
        #     or (employee_min is None or employee_count >= employee_min)
        #     and (employee_max is None or employee_count <= employee_max)
        # )

        # 매출 필터 (일단 주석처리)
        # annual_revenue = company_context.get("annual_revenue")
        # revenue_min = meta.get("revenue_min_manwon")
        # revenue_max = meta.get("revenue_max_manwon")
        # revenue_match = (
        #     not annual_revenue
        #     or (revenue_min is None or annual_revenue >= revenue_min)
        #     and (revenue_max is None or annual_revenue <= revenue_max)
        # )

        if code_match and region_match and type_match:
            filtered.append(p)

    return filtered[:10]


def policy_matching_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")

    company_context = {
        "industry_code": company.industry_code if company else None,
        "region": company.region if company else None,
        "company_type": company.company_type if company else None,
        "employee_count": company.employee_count if company else None,
        "annual_revenue": company.annual_revenue if company else None,
    }
    retrieved = match_policies(company_context, state["user_query"])

    decorated_policies = [_decorate_policy_deadline(p) for p in retrieved]
    valid_policies = [
        p for p in decorated_policies
        if p.get("d_day") is None or p["d_day"] >= 0
    ]
    sorted_policies = sorted(valid_policies, key=_sort_policy_deadline)

    state["matched_policies"] = sorted_policies

    prompt = POLICY_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company else "정보 없음",
        region=company.region if company else "정보 없음",
        company_type=company.company_type if company else "정보 없음",
        employee_count=company.employee_count if company else "정보 없음",
        annual_revenue=company.annual_revenue or "정보 없음" if company else "정보 없음",
        equipment_info=_equipment_name(equipment),
        retrieved_policies=sorted_policies if sorted_policies else "검색된 공고 없음",
    )

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ])

    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        
        response_text = result.get("response", "")
        # LLM이 선택한 공고 + reason + llm_score 저장
        matched_ids_info = result.get("matched_policies", [])
        reason_map = {
            item.get("id"): item
            for item in matched_ids_info
            if item.get("id")
        }
        selected_ids = set(reason_map)
        selected_policies = (
            [p for p in sorted_policies if p["id"] in selected_ids]
            if selected_ids
            else sorted_policies[:5]
        )

        state["matched_policies"] = [
            {
                **p,
                "eligible": True,
                "reason": reason_map.get(p["id"], {}).get("reason", "업종/지역/기업규모 기반 매칭"),
                "llm_score": reason_map.get(p["id"], {}).get("score", "●●●○○")
            }
            for p in selected_policies
        ]

        prefix = ""
        if state.get("unsupported_equipment"):
            prefix = "현재 해당 설비의 ROI 계산은 지원하지 않지만, 관련 지원사업을 찾아드릴게요!\n\n"
        state["final_response"] = prefix + response_text

    except Exception as e:
        state["matched_policies"] = [
            {
                **p,
                "eligible": True,
                "reason": "업종/지역/기업규모 기반 매칭",
                "llm_score": "●●●○○",
            }
            for p in sorted_policies[:5]
        ]
        state["final_response"] = response.content

    return state


# ────────────────────────────────────────────────────────────────
# A/B 후보 병합 & ROI 기반 재정렬
# ────────────────────────────────────────────────────────────────

def _policy_key(policy: dict) -> str | None:
    """정책 중복 제거 기준 키."""
    metadata = policy.get("metadata", {})
    return (
        policy.get("id")
        or metadata.get("policy_id")
        or metadata.get("title")
    )


def merge_policy_candidates(
    a_candidates: list[dict],
    b_candidates: list[dict],
) -> list[dict]:
    """
    A안/B안 검색 결과를 병합합니다.
    - policy_id(또는 title) 기준 중복 제거
    - 중복 시 distance는 min값 채택
    - scenario_match 태그 부착 (["a"], ["b"], ["a","b"])
    """
    merged: dict[str, dict] = {}

    for scenario, candidates in [("a", a_candidates), ("b", b_candidates)]:
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
    """
    ROI breakdown에서 가장 큰 개선 목적에 해당하는 키워드를 반환합니다.
    scenario: 'a' 또는 'b'
    """
    scenario_key = "scenario_a" if scenario == "a" else "scenario_b"
    breakdown = roi_result.get(scenario_key, {}).get("breakdown", {})
    return _get_impact_keywords(breakdown)


def rerank_policies_with_roi(
    policies: list[dict],
    roi_result: dict,
) -> list[dict]:
    """
    ROI 결과 기반으로 정책 후보를 재정렬합니다.

    final_score 구성:
      base_score   = 1 - distance
      + scenario_bonus  A 또는 B query에 걸리면 +0.1
      + common_bonus    A+B 둘 다 걸리면 +0.05
      + impact_bonus    ROI 목적 키워드와 정책 텍스트 일치 시 +0.1
      + amount_bonus    max_amount >= 5000만원 이상이면 +0.05

    NOTE: scenario_match, scenario_label, final_score는 응답 전용.
          DB matched_policy 테이블에는 기존 컬럼만 저장.
    """
    ranked = []

    for policy in policies:
        metadata = policy.get("metadata", {})
        scenario_match = policy.get("scenario_match", [])

        base_score = 1 - policy.get("distance", 1)
        scenario_bonus = 0.1 if scenario_match else 0
        common_bonus = 0.05 if set(scenario_match) == {"a", "b"} else 0

        # 정책 텍스트에서 ROI 목적 키워드 검색
        text = " ".join([
            str(metadata.get("title", "")),
            str(metadata.get("policy_category", "")),
            str(metadata.get("service_category", "")),
            str(policy.get("content", "")),
        ])
        # 시나리오별 ROI breakdown 기반 목적 키워드로 정책 텍스트 검사
        impact_keywords: list[str] = []
        for scenario in scenario_match:
            impact_keywords += _get_roi_impact_keywords(roi_result, scenario)

        impact_bonus = 0.1 if any(kw in text for kw in impact_keywords) else 0

        # 지원금 규모 보너스
        amount_bonus = 0
        try:
            max_amount = float(metadata.get("max_amount") or 0)
            if max_amount >= 5000:
                amount_bonus = 0.05
        except (TypeError, ValueError):
            pass

        final_score = base_score + scenario_bonus + common_bonus + impact_bonus + amount_bonus

        # 시나리오 라벨
        if set(scenario_match) == {"a", "b"}:
            scenario_label = "A/B 공통 적합"
        elif scenario_match == ["a"]:
            scenario_label = "A안 전체교체 적합"
        elif scenario_match == ["b"]:
            scenario_label = "B안 부분개선 적합"
        else:
            scenario_label = ""

        ranked.append({
            **policy,
            "scenario_match": scenario_match,
            "scenario_label": scenario_label,
            "final_score": round(final_score, 3),
            "match_score": round(final_score, 3),
        })

    return sorted(ranked, key=lambda p: p.get("final_score", 0), reverse=True)


def evaluate_and_rerank_with_llm(
    top_policies: list[dict],
    company_context: dict,
    equipment_name: str,
    roi_result: dict
) -> list[dict]:
    """
    알고리즘이 1차 선별한 TOP 10 공고를 LLM에게 넘겨서
    최종 별점(llm_score)과 추천 이유(reason)를 받아오고,
    알고리즘 점수(60%) + LLM 점수(40%)로 하이브리드 최종 랭킹을 산출합니다.
    """
    if not top_policies:
        return []

    from app.prompts.policy_hybrid import POLICY_HYBRID_PROMPT

    # LLM에게 제공할 정책 목록 요약
    policies_summary = []
    for p in top_policies:
        meta = p.get("metadata", {})
        policies_summary.append(
            f"- ID: {p.get('id')} | 제목: {meta.get('title')} | "
            f"지원금: {meta.get('max_amount', '정보없음')} | "
            f"매칭 시나리오: {p.get('scenario_label')}"
        )

    # 타겟 시나리오 요약
    scenario_a = roi_result.get("scenario_a", {}).get("breakdown", {})
    scenario_b = roi_result.get("scenario_b", {}).get("breakdown", {})
    a_impact = ", ".join(_get_impact_keywords(scenario_a))
    b_impact = ", ".join(_get_impact_keywords(scenario_b))
    roi_scenarios = f"A안(전체교체/대규모) 타겟: {a_impact} / B안(부분개선/소규모) 타겟: {b_impact}"

    prompt = POLICY_HYBRID_PROMPT.format(
        industry_code=", ".join(company_context.get("industry_code", [])) or "정보 없음",
        region=company_context.get("region") or "정보 없음",
        company_type=company_context.get("company_type") or "정보 없음",
        equipment_info=equipment_name or "제조 설비",
        roi_scenarios=roi_scenarios,
        retrieved_policies="\n".join(policies_summary)
    )

    try:
        response = llm.invoke([SystemMessage(content=prompt)])
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        import json as _json
        result = _json.loads(content.strip())
        llm_evals = result.get("matched_policies", [])

        eval_map = {
            item.get("id"): item
            for item in llm_evals
            if item.get("id")
        }
    except Exception as e:
        print(f"하이브리드 LLM 평가 실패: {e}")
        eval_map = {}

    hybrid_ranked = []
    for p in top_policies:
        pid = p.get("id")
        evaluation = eval_map.get(pid, {})

        llm_score_num = evaluation.get("score_num", 3)
        llm_score_str = evaluation.get("score", "●●●○○")
        reason = evaluation.get("reason", f"알고리즘 기반 {p.get('scenario_label', '')} 추천 공고입니다.")

        algo_score = p.get("final_score", 0.5)

        # 하이브리드 점수: 알고리즘 60% + LLM(5점 만점 → 1.0 스케일) 40%
        normalized_llm_score = llm_score_num / 5.0
        hybrid_score = (algo_score * 0.6) + (normalized_llm_score * 0.4)

        hybrid_ranked.append({
            **p,
            "llm_score": llm_score_str,
            "reason": reason,
            "hybrid_score": round(hybrid_score, 3),
        })

    return sorted(hybrid_ranked, key=lambda x: x.get("hybrid_score", 0), reverse=True)
