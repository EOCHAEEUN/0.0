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

    # 지원하지 않는 카테고리 체크
    supported = ["press", "cnc", "injection"]
    if not equipment or equipment.equipment.category not in supported:
        state["final_response"] = "죄송해요, 현재 ROI 계산은 프레스(press), CNC, 사출성형기(injection) 설비만 지원하고 있어요. 추후 더 많은 설비 유형을 지원할 예정입니다!"
        return state
    
    # LLM에 Tool 바인딩
    llm_with_tools = llm.bind_tools([calculate_equipment_roi])

    # 프롬프트 구성
    prompt = CAPEX_SYSTEM_PROMPT.format(
        industry_code=company.industry_code if company else "정보 없음",
        region=company.region if company else "정보 없음",
        equipment_name=equipment.equipment.name if equipment else "정보 없음",
        age_years=equipment.equipment.age_years if equipment else 0,
        energy_cost=equipment.equipment.energy_cost_annual if equipment else 0,
        defect_rate=equipment.equipment.defect_rate if equipment and equipment.equipment.defect_rate else "정보 없음",
        roi_result="Tool을 호출해서 계산하세요.",
        matched_policies=matched_policies if matched_policies else "매칭된 지원사업 없음"
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

            # State에 roi_result 저장
            state["roi_result"] = tool_result

        # 2차 호출 - tool 결과 보고 최종 응답 생성
        final_response = llm.invoke(messages)
        state["final_response"] = final_response.content
    else:
        # tool 호출 없으면 그냥 응답 사용
        state["final_response"] = response.content

    return state
