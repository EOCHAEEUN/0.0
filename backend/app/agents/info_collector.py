from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.info_collector import INFO_COLLECTOR_SYSTEM_PROMPT
from app.models.equipment import EquipmentInput, RoiInput
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
            elif "컴프레셔" in name or "compressor" in name:
                category = "compressor"
            else:
                category = "default"

            state["equipment"] = RoiInput(
                equipment=EquipmentInput(
                    name=data.get("equipment_name", ""),
                    category=category,
                    age_years=int(data.get("age_years", 0)),
                    energy_cost_annual=int(data.get("energy_cost_annual", 0)),
                    new_energy_cost_annual=int(data["new_energy_cost_annual"]) if data.get("new_energy_cost_annual") else None,
                    new_investment_manwon=int(data["new_investment_manwon"]) if data.get("new_investment_manwon") else None
                )
            )

            state["company_info"] = CompanyContext(
                company_name="",
                industry_code=data.get("industry_code", ""),
                employee_count=0,
                region=data.get("region", "")
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
