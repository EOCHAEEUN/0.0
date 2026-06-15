from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from app.state import FactofitState
from app.prompts.capex import CAPEX_SYSTEM_PROMPT
from app.tools.roi_calc_tool import calculate_equipment_roi
from app.core.llm import llm

import json


def normalize_equipment_category(*values) -> str:
    """
    ROI 계산기가 지원하는 설비 카테고리로 정규화합니다.
    category, name 등 여러 값을 받아 합쳐서 판단합니다.

    주의:
    - industry_code(C21, C24 등), company_type(제조업, 제조 등)은 ROI category가 아닙니다.
    - ROI category는 반드시 press/cnc/injection 중 하나여야 합니다.
    - industry_code, company_type은 판단에 사용하지 않습니다.
    """
    text = " ".join(str(v or "") for v in values).strip().lower()

    if "프레스" in text or "press" in text:
        return "press"

    if any(k in text for k in ("cnc", "공작기계", "머시닝", "가공기", "가공설비")):
        return "cnc"

    if any(k in text for k in ("사출", "injection", "사출성형")):
        return "injection"

    # TODO: MVP 시연용 임시 fallback — 추후 설비명 확장 시 제거
    if any(k in text for k in ("제조설비", "제조 장비", "기계설비")):
        return "cnc"

    return "unsupported"


def capex_advisor_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])

    # equipment가 없으면 user_query에서 설비 정보를 추출합니다.
    if not equipment:
        extract_prompt = """
아래 텍스트에서 설비 정보를 추출해서 JSON으로만 반환하세요. 설명 금지.
주의: 금액은 반드시 만원 단위로 변환하세요. (예: 4800만원 -> 4800)
{{
  "equipment_name": "설비명",
  "age_years": 숫자,
  "energy_cost_annual": 숫자 (만원 단위),
  "industry_code": "코드",
  "region": "지역"
}}
텍스트: {user_query}
""".format(user_query=state["user_query"])

        extract_response = llm.invoke([SystemMessage(content=extract_prompt)])

        try:
            content = extract_response.content.strip()

            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            data = json.loads(content.strip())

            category = normalize_equipment_category(
                data.get("equipment_category", ""),
                data.get("equipment_name", ""),
            )

            from app.models.equipment import EquipmentInput
            from app.models.company import CompanyContext

            state["equipment"] = EquipmentInput(
                name=data.get("equipment_name", ""),
                category=category,
                age_years=int(data.get("age_years", 0)),
                energy_cost_annual=int(data.get("energy_cost_annual", 0)),
            )

            if not company:
                state["company_info"] = CompanyContext(
                    company_name="",
                    industry_code=[data.get("industry_code", "")]
                    if data.get("industry_code")
                    else [],
                    region=data.get("region", ""),
                )

            equipment = state["equipment"]
            company = state["company_info"]

        except Exception as e:
            print(f"정보 추출 실패: {e}")
            state["final_response"] = (
                "설비 정보를 이해하지 못했어요. "
                "설비 종류, 연식, 에너지 비용을 다시 알려주세요."
            )
            return state

    # equipment가 이미 state에 있어도 category를 다시 정규화합니다.
    # Supabase 값 또는 LLM 추출값이 섞여 들어와도 ROI 계산기에는 press/cnc/injection만 넘기기 위함입니다.
    if equipment:
        normalized_category = normalize_equipment_category(
            getattr(equipment, "category", ""),
            getattr(equipment, "name", ""),
        )
        equipment.category = normalized_category
        state["equipment"] = equipment

    # 지원하지 않는 카테고리는 ROI 계산기로 보내지 않고 여기서 종료합니다.
    supported = ["press", "cnc", "injection"]
    if not equipment or equipment.category not in supported:
        state["final_response"] = (
            "현재 ROI 계산은 프레스, CNC, 사출성형기 설비만 지원합니다. "
            "설비명을 프레스/CNC/사출기 중 하나로 입력해주세요."
        )
        return state

    # matched_policies가 없으면 ChromaDB에서 직접 검색합니다.
    if not matched_policies and company:
        from app.agents.policy import match_policies

        company_context = {
            "industry_code": company.industry_code or [],
            "region": company.region or "",
            "company_type": company.company_type if company.company_type else "",
        }

        equipment_name = equipment.name if equipment else ""
        policy_query = (
            f"{equipment_name} 지원사업"
            if equipment_name
            else "제조설비 지원사업"
        )

        matched_policies = match_policies(company_context, policy_query)
        state["matched_policies"] = matched_policies

    # LLM에 ROI 계산 Tool을 바인딩합니다.
    llm_with_tools = llm.bind_tools([calculate_equipment_roi])

    if matched_policies:
        policy_summary = [
            {
                "title": p.get("metadata", {}).get("title", ""),
                "max_amount": p.get("metadata", {}).get("max_amount", 0),
            }
            for p in matched_policies[:3]
        ]
        matched_policies_text = str(policy_summary)
    else:
        matched_policies_text = "매칭된 지원사업 없음"

    prompt = CAPEX_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code)
        if company and company.industry_code
        else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.name if equipment else "정보 없음",
        age_years=equipment.age_years if equipment else 0,
        energy_cost=equipment.energy_cost_annual if equipment else 0,
        defect_rate=equipment.defect_rate
        if equipment and equipment.defect_rate
        else "정보 없음",
        roi_result="Tool을 호출해서 계산하세요.",
        matched_policies=matched_policies_text,
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"]),
    ]

    response = llm_with_tools.invoke(messages)
    messages.append(response)

    if response.tool_calls:
        for tool_call in response.tool_calls:
            # 중요:
            # LLM이 만든 tool_call["args"]는 신뢰하지 않습니다.
            # LLM이 industry_code(C21)나 company_type(제조업)을 equipment.category로 잘못 넣을 수 있기 때문입니다.
            # 따라서 서버에서 검증/정규화한 state["equipment"]만 ROI 계산기에 전달합니다.
            if hasattr(state["equipment"], "model_dump"):
                equipment_data = state["equipment"].model_dump()
            else:
                equipment_data = state["equipment"].dict()

            safe_tool_args = {"equipment": equipment_data}

            print("=== safe ROI tool args ===")
            print(safe_tool_args)

            tool_result = calculate_equipment_roi.invoke(safe_tool_args)

            messages.append(
                ToolMessage(
                    content=json.dumps(tool_result, ensure_ascii=False),
                    tool_call_id=tool_call["id"],
                )
            )

            state["roi_result"] = tool_result

        final_response = llm.invoke(messages)
        state["final_response"] = final_response.content

        if matched_policies:
            title = matched_policies[0]["metadata"].get("title", "")
            amount = matched_policies[0]["metadata"].get("max_amount", 0)

            if title and amount:
                state["final_response"] += (
                    f"\n\n💡 매칭 지원사업: [{title}] "
                    f"최대 {amount}만원 활용 가능"
                )

    else:
        state["final_response"] = response.content

    return state