from langchain_core.messages import SystemMessage, HumanMessage
import json

from app.state import FactofitState
from app.prompts.policy import POLICY_SYSTEM_PROMPT
from app.tools.vector_search import search_policies
from app.core.llm import llm
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
    company_type_values = _normalize_list(company_context.get("company_type"))

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
