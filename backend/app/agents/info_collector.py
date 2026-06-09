from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.info_collector import INFO_COLLECTOR_SYSTEM_PROMPT
from app.models.equipment import EquipmentInput
from app.models.roi_input import RoiInput
from app.models.company import CompanyContext
from app.core.llm import llm
import json


def info_collector_node(state: FactofitState) -> FactofitState:    
    # chat_history를 텍스트로 변환
    history_text = ""
    for msg in state.get("chat_history", []):
        role = "사용자" if msg["role"] == "user" else "AI"
        history_text += f"{role}: {msg['content']}\n"

    history_text += f"사용자: {state['user_query']}\n"

    print("=== history_text ===")
    print(history_text)  # 추가

    # 프롬프트 구성
    prompt = INFO_COLLECTOR_SYSTEM_PROMPT.format(
        chat_history=history_text if history_text else "없음",
        user_message=state["user_query"]
    )

    response = llm.invoke([SystemMessage(content=prompt)])
    print("=== LLM 응답 ===")
    print(response.content)

    try:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        result = json.loads(content.strip())
        status = result.get("status")

        if status == "complete":
            # 정보 다 모였으면 State에 저장
            data = result.get("data", {})

            name = data.get("equipment_name", "").lower()
            if "프레스" in name or "press" in name:
                category = "press"
            elif "cnc" in name:
                category = "cnc"
            elif "사출" in name or "injection" in name:
                category = "injection"
            else:
                category = "unsupported"

            if category == "unsupported":
                state["unsupported_equipment"] = True
                # company_info 저장
                state["company_info"] = CompanyContext(
                    company_name="",
                    industry_code=data.get("industry_code", ""),
                    employee_count=int(data.get("employee_count")or 0),
                    region=data.get("region", "")
                )
                # policy로 넘기되 user_query를 지원사업 검색으로 변경
                state["intent"] = "policy"
                state["final_response"] = ""
                state["user_query"] = f"{data.get('industry_code', '')} {data.get('region', '')} 제조기업 지원사업"
                # 안내 메시지는 matched_policies 결과랑 같이 보여줌
                # prompts/policy.py에서 처리
                print("=== user_query ===")
                print(state["user_query"])    
                return state
            
            state["equipment"] = RoiInput(
                equipment=EquipmentInput(
                    name=data.get("equipment_name", ""),
                    category=category,
                    age_years=int(data.get("age_years", 0)),
                    energy_cost_annual=int(data.get("energy_cost_annual", 0)),
                    new_energy_cost_annual=int(data["new_energy_cost_annual"]) if data.get("new_energy_cost_annual") else None,
                    new_investment_manwon=int(data["new_investment_manwon"]) if data.get("new_investment_manwon") else None,
                    defect_rate=float(data["defect_rate"]) if data.get("defect_rate") else None,
                    maintenance_cost_annual=int(data["maintenance_cost_annual"]) if data.get("maintenance_cost_annual") else None
                )
            )

            state["company_info"] = CompanyContext(
                company_name="",
                industry_code=data.get("industry_code", ""),
                employee_count=int(data.get("employee_count", 0)),
                region=data.get("region", ""),
                annual_revenue=data.get("annual_revenue")
            )

            # router로 돌아가도록 intent 비우고 final_response 비움
            state["intent"] = ""
            state["final_response"] = ""

        else:
            # 정보 부족하면 다음 질문
            state["final_response"] = result.get("question", "정보를 알려주세요.")

    except json.JSONDecodeError:
        state["final_response"] = "죄송해요, 다시 한번 말씀해 주시겠어요?"

    return state
