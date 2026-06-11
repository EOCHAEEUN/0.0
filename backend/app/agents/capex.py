from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from app.state import FactofitState
from app.prompts.capex import CAPEX_SYSTEM_PROMPT
from app.tools.roi_calc_tool import calculate_equipment_roi
from app.core.llm import llm
import json


def capex_advisor_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")
    matched_policies = state.get("matched_policies", [])

    # equipment가 없으면 user_query에서 추출
    if not equipment:
        extract_prompt = """
아래 텍스트에서 설비 정보를 추출해서 JSON으로만 반환하세요. 설명 금지.
주의: 금액은 반드시 만원 단위로 변환하세요. (예: 4800만원 → 4800)
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

            name = data.get("equipment_name", "").lower()
            if "프레스" in name or "press" in name:
                category = "press"
            elif "cnc" in name:
                category = "cnc"
            elif "사출" in name or "injection" in name:
                category = "injection"
            else:
                category = "unsupported"

            from app.models.roi_input import RoiInput
            from app.models.equipment import EquipmentInput
            from app.models.company import CompanyContext

            state["equipment"] = RoiInput(
                equipment=EquipmentInput(
                    name=data.get("equipment_name", ""),
                    category=category,
                    age_years=int(data.get("age_years", 0)),
                    energy_cost_annual=int(data.get("energy_cost_annual", 0))
                )
            )
            if not company:
                state["company_info"] = CompanyContext(
                    company_name="",
                    industry_code=data.get("industry_code", ""),
                    employee_count=0,
                    region=data.get("region", "")
                )
            equipment = state["equipment"]
            company = state["company_info"]
        except Exception as e:
            print(f"정보 추출 실패: {e}")
            state["final_response"] = "설비 정보를 이해하지 못했어요. 설비 종류, 연식, 에너지 비용을 다시 알려주세요!"
            return state

    # 지원하지 않는 카테고리 체크
    supported = ["press", "cnc", "injection"]
    if not equipment or equipment.equipment.category not in supported:
        state["final_response"] = "죄송해요, 현재 ROI 계산은 프레스(press), CNC, 사출성형기(injection) 설비만 지원하고 있어요. 추후 더 많은 설비 유형을 지원할 예정입니다!"
        return state
    
    # matched_policies 없으면 ChromaDB에서 직접 검색
    if not matched_policies and company:
        from app.agents.policy import match_policies
        company_context = {
            "industry_code": company.industry_code or "",
            "region": company.region or ""
        }

        industry_code_str = ", ".join(company.industry_code) if company and company.industry_code else ""
        policy_query = f"{industry_code_str} {company.region if company else ''} 설비 지원사업"
        matched_policies = match_policies(company_context, policy_query)
        state["matched_policies"] = matched_policies

    # LLM에 Tool 바인딩
    llm_with_tools = llm.bind_tools([calculate_equipment_roi])

    if matched_policies :
        policy_summary = [{"title": p.get("metadata", {}).get("title", ""), "max_amount": p.get("metadata", {}).get("max_amount", 0)} for p in matched_policies[:3]]
        matched_policies_text = str(policy_summary)
    else:
        matched_policies_text = "매칭된 지원사업 없음"

    # 프롬프트 구성
    prompt = CAPEX_SYSTEM_PROMPT.format(
        industry_code=", ".join(company.industry_code) if company and company.industry_code else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.equipment.name if equipment else "정보 없음",
        age_years=equipment.equipment.age_years if equipment else 0,
        energy_cost=equipment.equipment.energy_cost_annual if equipment else 0,
        defect_rate=equipment.equipment.defect_rate if equipment and equipment.equipment.defect_rate else "정보 없음",
        roi_result="Tool을 호출해서 계산하세요.",
        matched_policies=matched_policies_text
    )

    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=state["user_query"])
    ]

    # 1차 호출 - LLM이 tool 호출 결정
    response = llm_with_tools.invoke(messages)
    messages.append(response)

    # Tool 호출이 있으면 실행
    if response.tool_calls:
        for tool_call in response.tool_calls:
            tool_result = calculate_equipment_roi.invoke(tool_call["args"])
            messages.append(
                ToolMessage(
                    content=json.dumps(tool_result, ensure_ascii=False),
                    tool_call_id=tool_call["id"]
                )
            )
            state["roi_result"] = tool_result

        # 2차 호출 - tool 결과 보고 최종 응답 생성
        final_response = llm.invoke(messages)
        state["final_response"] = final_response.content

        if matched_policies:
            title = matched_policies[0]["metadata"].get("title", "")
            amount = matched_policies[0]["metadata"].get("max_amount", 0)
            if title and amount:
                state["final_response"] += f"\n\n📋 매칭 지원사업: [{title}] 최대 {amount}만원 활용 가능"

    else:
        state["final_response"] = response.content

    return state
