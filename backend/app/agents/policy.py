from langchain_core.messages import SystemMessage, HumanMessage
import json
import re

from app.state import FactofitState
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.tools.vector_search import search_policies
from app.core.llm import llm
from app.tools.query_builder import _get_impact_keywords
from datetime import date
from app.core.database import get_db
from app.agents.capex import (
    format_roi_result,
    show_roi_detail,
    compare_scenarios,
    compare_roi_results,
    analyze_roi_followup
)
from app.tools.roi_calc_tool import calculate_equipment_roi


UNKNOWN_DEADLINE_VALUES = {"", "none", "null", "nan", "마감일 미정", "상시"}
POLICY_REASON_CHECK_SENTENCE = "세부 지원한도와 제출서류, 마감일, 자격조건은 공고 원문 확인이 필요합니다."


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
    if scenario == "c":
        return (
            _get_impact_keywords(roi_result.get("scenario_a", {}).get("breakdown", {}))
            + _get_impact_keywords(roi_result.get("scenario_b", {}).get("breakdown", {}))
        )

    scenario_key = "scenario_a" if scenario == "a" else "scenario_b"
    breakdown = roi_result.get(scenario_key, {}).get("breakdown", {})
    return _get_impact_keywords(breakdown)


def _normalize_scenario_match_for_response(scenario_match: list[str]) -> list[str]:
    """Return the persisted/display scenario tag. A+B common fit is stored as c."""
    if set(scenario_match) == {"a", "b"}:
        return ["c"]
    return scenario_match


def _first_policy_text(*values) -> str:
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
    if len(sentences) <= 2:
        return cleaned
    return " ".join(sentences[:2])


def _policy_support_focus(policy: dict) -> str:
    metadata = policy.get("metadata", {})
    text = " ".join(
        str(value or "")
        for value in [
            metadata.get("service_category"),
            metadata.get("policy_category"),
            metadata.get("title"),
            policy.get("content"),
        ]
    )

    if any(keyword in text for keyword in ["스마트공장", "자동화", "DX", "AI"]):
        return "스마트공장·자동화 지원"
    if any(keyword in text for keyword in ["에너지", "효율", "절감"]):
        return "에너지효율 개선 지원"
    if any(keyword in text for keyword in ["안전", "위험", "노후"]):
        return "노후·안전 개선 지원"
    if any(keyword in text for keyword in ["컨설팅", "진단"]):
        return "컨설팅·진단 지원"
    if any(keyword in text for keyword in ["인증", "시험", "평가"]):
        return "인증·평가 지원"
    return "설비·공정 개선 지원"


def _default_policy_reason(
    policy: dict,
    company_context: dict,
    equipment_name: str,
) -> str:
    industry_codes = company_context.get("industry_code") or []
    if isinstance(industry_codes, str):
        industry_text = industry_codes
    else:
        industry_text = ", ".join(str(code) for code in industry_codes if code)

    region = company_context.get("region") or "대상 지역"
    company_type = company_context.get("company_type") or "기업 조건"
    scenario_label = policy.get("scenario_label") or "투자 목적"
    support_focus = _policy_support_focus(policy)
    equipment_text = equipment_name or "해당 설비"

    first_sentence = (
        f"{industry_text or '해당 업종'} 및 {region} 지역, {company_type} 조건과 부합하며, "
        f"{equipment_text}의 {scenario_label} 목적과 {support_focus} 방향이 유사합니다."
    )
    return f"{first_sentence} {POLICY_REASON_CHECK_SENTENCE}"


def _standardize_policy_reason(
    policy: dict,
    company_context: dict,
    equipment_name: str,
    llm_reason: str | None,
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
        display_scenario_match = _normalize_scenario_match_for_response(scenario_match)

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
        if display_scenario_match == ["c"]:
            scenario_label = "C안 공통 적합"
        elif display_scenario_match == ["a"]:
            scenario_label = "A안 전체교체 적합"
        elif display_scenario_match == ["b"]:
            scenario_label = "B안 부분개선 적합"
        else:
            scenario_label = ""

        ranked.append({
            **policy,
            "scenario_match": display_scenario_match,
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
            f"분류: {meta.get('service_category') or meta.get('policy_category') or '정보없음'} | "
            f"지역: {meta.get('region', '정보없음')} | "
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
        reason = _standardize_policy_reason(
            p,
            company_context,
            equipment_name,
            evaluation.get("reason"),
        )

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


# -------------------------------------------------------------------
# Raw policy candidates from DB
# -------------------------------------------------------------------




def _policy_field(policy: dict, key: str, default=None):
    """Read a policy value from either a DB row or nested metadata."""
    if key in policy and policy.get(key) is not None:
        return policy.get(key)

    metadata = policy.get("metadata")
    if isinstance(metadata, dict) and metadata.get(key) is not None:
        return metadata.get(key)

    return default


def get_policy_raw_candidates(company_context: dict) -> list[dict]:
    """
    Fetch first-pass policy candidates from the policy DB table.

    Purpose:
    - This is not the AI recommendation result.
    - This is the raw candidate pool filtered by company condition.
    - Example: C24 company -> all C24-compatible policy rows.
    """
    db = get_db()

    company_codes = _normalize_list(company_context.get("industry_code"))
    region = company_context.get("region") or ""
    region_short = region.split()[0] if region else ""
    company_type_values = _normalize_list(company_context.get("company_type"))

    result = db.table("policy").select("*").execute()
    rows = result.data or []

    candidates = []

    for policy in rows:
        policy_codes = _normalize_list(_policy_field(policy, "industry_codes"))
        policy_region = _policy_field(policy, "region", "") or ""
        eligible_types = _normalize_list(_policy_field(policy, "eligible_company_types", []))

        code_match = (
            not company_codes
            or not policy_codes
            or "C" in policy_codes
            or any(code in policy_codes for code in company_codes)
        )

        region_match = (
            not region
            or not policy_region
            or "전국" in policy_region
            or region_short in policy_region
        )

        type_match = (
            not eligible_types
            or not company_type_values
            or any(company_type in eligible_types for company_type in company_type_values)
        )

        if code_match and region_match and type_match:
            candidates.append(policy)

    return candidates


def format_raw_policy_candidate(policy: dict) -> dict:
    """
    Format raw candidates for the frontend list.
    No AI score, no ranking, no reason.
    """
    return {
        "policy_id": (
            _policy_field(policy, "policy_id")
            or _policy_field(policy, "id")
        ),
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
        for value in [
            _policy_field(policy, "title", ""),
            _policy_field(policy, "content", ""),
            _policy_field(policy, "eligibility_text", ""),
            _policy_field(policy, "eligibility_evidence", ""),
            _policy_field(policy, "organization", ""),
            _policy_field(policy, "industry_code", ""),
        ]
    )


def rank_candidates_by_query(
    candidates: list[dict],
    query: str,
    limit: int = 10,
) -> list[dict]:
    """
    Rank raw DB candidates by A/B ROI query keywords.

    This keeps recommendation inside the first-pass candidate pool.
    raw_candidates: DB-filtered company-fit policies
    ranked candidates: ROI A/B keyword-fit policies
    """
    query_tokens = [
        token.strip()
        for token in str(query or "").split()
        if token.strip()
    ]

    ranked = []

    for policy in candidates:
        text = _policy_text_for_ranking(policy)
        keyword_score = sum(1 for token in query_tokens if token in text)

        policy_id = (
            _policy_field(policy, "policy_id")
            or _policy_field(policy, "id")
        )

        title = _policy_field(policy, "title", "")
        content = _policy_field(policy, "content", "") or text

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

        distance = 1 - min(keyword_score / 10, 0.99)

        ranked.append(
            {
                "id": policy_id,
                "content": content,
                "metadata": metadata,
                "distance": distance,
                "keyword_score": keyword_score,
            }
        )

    return sorted(
        ranked,
        key=lambda item: item.get("keyword_score", 0),
        reverse=True,
    )[:limit]

# ────────────────────────────────────────────────────────────────
# FOR CHAT - 상태 2
# ────────────────────────────────────────────────────────────────
def ask_policy_intent(user_query: str) -> dict:
    """
    사용자의 정책 질문 의도를 확인합니다.
    등록한 설비에 관한 정책인지, 일반 정책인지 사용자에게 묻습니다.
    """
    return {
        "type": "intent_confirmation",
        "message": "당신이 등록한 설비에 관한 정책 정보를 원하시나요? 아니면 일반 정책을 알고 싶으신가요?",
        "options": [
            {"id": "equipment", "label": "등록한 설비 관련"},
            {"id": "general", "label": "일반 정책"}
        ]
    }

def get_user_equipment_list(company_id: str) -> list[dict]:
    """
    사용자가 등록한 모든 설비 목록을 반환합니다.
    """
    db = get_db()
    
    try:
        result = db.table("equipment").select("*").eq("company_id", company_id).execute()
        equipments = result.data or []
        
        return [
            {
                "equipment_id": eq.get("id") or eq.get("equipment_id"),
                "name": eq.get("name", ""),
                "category": eq.get("category", ""),
            }
            for eq in equipments
        ]
    except Exception as e:
        print(f"Error fetching equipment list: {e}")
        return []
    
# ────────────────────────────────────────────────────────────────
# FOR CHAT - 상태 3
# ────────────────────────────────────────────────────────────────
def get_equipment_policies(company_id: str, equipment_id: str) -> list[dict]:
    """
    등록한 설비의 matched_policy DB에서 상위 5개 조회
    """
    db = get_db()
    result = db.table("matched_policy").select("*").eq(
        "company_id", company_id
    ).eq(
        "equipment_id", equipment_id
    ).execute()
    
    policies = result.data or []
    sorted_policies = sorted(policies, key=lambda x: x.get("match_score", 0), reverse=True)
    return sorted_policies[:5]

def search_general_policies(
    user_query: str,
    company_industry_code: str = None,
    region: str = None,
    n_results: int = 5
) -> list[dict]:
    """
    일반 정책 검색
    - user_query와 유사도 비교
    - industry_code 필터링 선택
    - region 필터링 선택
    """
    where = None
    if company_industry_code or region:
        where = {}
        if company_industry_code:
            where["industry_code"] = {"$contains": company_industry_code}
        if region:
            where["region"] = {"$contains": region}

    results = search_policies(user_query, n_results=n_results, where=where)
    return results
# ────────────────────────────────────────────────────────────────
# FOR CHAT - 상태 5 보조
# ────────────────────────────────────────────────────────────────
def analyze_followup_query(user_query: str, matched_policies: list) -> dict:
    """
    후속질문 분석 + 정책 인덱스 추출
    intent와 policy_index 반환
    """
    policy_list = [
        {"index": i, "title": p.get("title", "")} 
        for i, p in enumerate(matched_policies)
    ]
    
    prompt = f"""
    사용자: "{user_query}"
    정책 목록: {json.dumps(policy_list, ensure_ascii=False)}
    
    의도 + 정책 번호 추출
    JSON: {"intent": "sort/more/filter/compare/detail/general", "policy_index": 0~4}
    """
    
    response = llm.invoke([SystemMessage(content=prompt)])
    return json.loads(response.content)
    
# ────────────────────────────────────────────────────────────────
# FOR CHAT: Policy Chat Node (Graph 노드)
# ────────────────────────────────────────────────────────────────
def policy_chat_node(state: FactofitState) -> FactofitState:
    """
    Chat에서의 정책 질문 처리 노드
    상태별로 의도확인 → 설비선택 → 정책조회 → 후속질문 처리
    """
    
    policy_intent_choice = state.get("policy_intent_choice")
    selected_equipment = state.get("selected_equipment_for_policy")
    matched_policies = state.get("matched_policies", [])
    company_info = state.get("company_info")
    company_id = company_info.company_id if company_info else None
    user_query = state.get("user_query", "")
    
    # 상태 1: 정책 질문 의도 미확인
    if not policy_intent_choice:
        intent_result = ask_policy_intent(user_query)
        state["final_response"] = intent_result["message"]
        state["options"] = intent_result["options"]
        state["intent"] = "response"
        return state
    
    # 상태 2: equipment 선택 + 설비 미선택
    if policy_intent_choice == "equipment" and not selected_equipment:
        equipments = get_user_equipment_list(company_id)

        state["final_response"] = """
    등록된 장비를 기반으로:

    📊 ROI 비교분석
    → 현재 설비 vs 신규 설비의 수익성 비교

    🔄 투자금 시나리오 비교
    → 예상 투자금 변경에 따른 ROI 실시간 비교

    💼 맞춤 정책 추천
    → ROI 결과에 따른 최적의 정책 5개

    📄 계획서 초안 작성
    → 선택하신 정책으로 계획서 초안 자동 작성

    어떤 설비에 대해 분석해드릴까요?
    """
        
        state["options"] = [
            {
                "id": eq.get("equipment_id"),
                "label": eq.get("name")
            }
            for eq in equipments
        ]
        state["intent"] = "response"
        return state
    
    # 상태 3: equipment + 설비 선택 + 첫 조회
    elif policy_intent_choice == "equipment" and selected_equipment and not matched_policies:
        equipment_id = state.get("equipment_id")
        roi_result = state.get("roi_result")
        
        # ROI 결과가 없으면 DB에서 조회
        if not roi_result:
            db = get_db()
            roi_output = db.table("roi_output").select("*").eq(
                "company_id", company_id
            ).eq(
                "equipment_id", equipment_id
            ).execute()
            
            if roi_output.data:
                roi_result = roi_output.data[0].get("roi_data", {})
                state["roi_result"] = roi_result
        
        # ROI 있으면 표시
        if roi_result:
            roi_text = format_roi_result(roi_result)
            state["final_response"] = roi_text
            state["options"] = [
                {"id": "detail", "label": "상세 설명"},
                {"id": "compare", "label": "비교"},
                {"id": "simulate", "label": "시뮬레이션"},
                {"id": "policy", "label": "정책 추천 보기"},
                {"id": "draft", "label": "계획서 초안 작성"}
            ]
            state["intent"] = "response"
        else:
            # 분석 데이터 없음
            state["final_response"] = "아직 분석 데이터가 없습니다. 분석하기를 진행하고 궁금한 걸 물어보세요."
            state["options"] = [{"id": "analyze", "label": "분석하기"}]
            state["intent"] = "response"
        
        return state
    
        # 상태 3.5: ROI 후속질문 (버튼 클릭)
    elif policy_intent_choice == "equipment" and selected_equipment and roi_result and not matched_policies:
        equipment = state.get("equipment")
        followup_info = analyze_roi_followup(user_query, roi_result)
        intent = followup_info.get("intent")
        
        if intent == "detail":
            state["final_response"] = show_roi_detail(roi_result, user_query)
            state["intent"] = "response"
        
        elif intent == "compare":
            state["final_response"] = compare_scenarios(roi_result)
            state["intent"] = "response"
        
        elif intent == "simulate":
            new_investment = followup_info.get("new_investment")
            equipment.scenario_a_investment_manwon = new_investment
            new_roi = calculate_equipment_roi(equipment)
            state["final_response"] = compare_roi_results(roi_result, new_roi)
            state["intent"] = "response"
        
        elif intent == "policy":
            # 정책 조회!
            policies = get_equipment_policies(company_id, equipment_id)
            state["matched_policies"] = policies
            state["final_response"] = "선택하신 설비의 적합한 정책들입니다."
            state["intent"] = "response"

        elif intent == "draft":
            # 바로 계획서 작성 (정책 선택 필요)
            policies = get_equipment_policies(company_id, equipment_id)
            state["matched_policies"] = policies
            state["final_response"] = "어떤 정책에 대해 계획서 초안을 작성해드릴까요?"
            state["intent"] = "response"
        
        return state
    
    # 상태 4: general + 첫 검색
    elif policy_intent_choice == "general" and not matched_policies:
        region = company_info.region if company_info else None

        industry_code = None
        if company_info and company_info.industry_code:
            if isinstance(company_info.industry_code, list):
                industry_code = company_info.industry_code[0]
            else:
                industry_code = company_info.industry_code

        policies = search_general_policies(
            user_query,
            company_industry_code=industry_code,
            region=region,
            n_results=5
        )

        state["matched_policies"] = policies
        state["final_response"] = "찾은 정책들입니다. 더 궁금한 점이 있으신가요?"
        state["intent"] = "response"
        return state
    
    # 상태 5: 후속질문
    elif matched_policies:
        followup_info = analyze_followup_query(user_query, matched_policies)
        intent = followup_info.get("intent")
        
        if intent == "general":
            state["policy_intent_choice"] = "general"
            state["matched_policies"] = []
            state["intent"] = "response"
            state["final_response"] = "일반 정책 검색으로 전환할게요. 찾고 싶은 정책을 다시 입력해주세요."
            return state
        
        elif intent == "sort":
            criteria = followup_info.get("criteria", "match_score")
            order = followup_info.get("order", "desc")
            sorted_policies = sorted(
                matched_policies,
                key=lambda x: x.get(criteria, 0),
                reverse=(order == "desc")
            )
            state["matched_policies"] = sorted_policies
            state["final_response"] = f"{criteria} 기준으로 정렬했습니다."
            state["intent"] = "policy"
        
        elif intent == "more":
            state["final_response"] = "모든 정책을 보여드립니다."
            state["intent"] = "policy"
        
        elif intent == "filter":
            criteria = followup_info.get("criteria")  # region / eligible_company_types
            filter_value = followup_info.get("filter_value")
            
            if criteria == "region":
                filtered = [p for p in matched_policies if filter_value in p.get("metadata", {}).get("region", "")]
            elif criteria == "eligible_company_types":
                filtered = [p for p in matched_policies if filter_value in str(p.get("metadata", {}).get("eligible_company_types", ""))]
            
            state["matched_policies"] = filtered
            state["final_response"] = f"{filter_value} 관련 정책들만 필터링했습니다."
            state["intent"] = "policy"
        
        elif intent == "compare":
            indices = followup_info.get("policy_indices", [0, 1])  # 비교할 정책 인덱스들
            
            if len(indices) >= 2:
                policy_a = matched_policies[indices[0]]
                policy_b = matched_policies[indices[1]]
                
                comparison = f"""
                【정책 A】{policy_a.get('title')}
                지원금: {policy_a.get('metadata', {}).get('max_amount')}
                마감: {policy_a.get('metadata', {}).get('deadline')}
                
                【정책 B】{policy_b.get('title')}
                지원금: {policy_b.get('metadata', {}).get('max_amount')}
                마감: {policy_b.get('metadata', {}).get('deadline')}
                """
                state["final_response"] = comparison
                state["intent"] = "policy"
            
        elif intent == "detail":
            policy_index = followup_info.get("policy_index", 0)
            if 0 <= policy_index < len(matched_policies):
                selected_policy = matched_policies[policy_index]
                if "신청" in user_query:
                    if not state.get("equipment"):
                        state["final_response"] = "초안서 작성에는 설비 정보가 필요합니다. 등록된 설비로 진행해주세요."
                        return state
                    state["intent"] = "draft"
                    state["selected_policy"] = selected_policy
                else:
                    state["final_response"] = f"정책명: {selected_policy.get('title')}\n상세 정보: {selected_policy}"
                    state["intent"] = "policy"

        return state
    
    return state

