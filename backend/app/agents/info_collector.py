from langchain_core.messages import SystemMessage, HumanMessage
from app.state import FactofitState
from app.prompts.info_collector import INFO_COLLECTOR_SYSTEM_PROMPT
from app.models.equipment import EquipmentInput
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

    company = state.get("company_info")
    equipment = state.get("equipment")

    # 시스템 제공 정보 텍스트 만들기
    company_context = "없음"
    if company or equipment:
        lines = []
        if company:
            if company.industry_code:
                lines.append(f"업종코드: {company.industry_code}")
            if company.region:
                lines.append(f"지역: {company.region}")
        if equipment:
            eq = equipment.equipment
            if eq.name:
                lines.append(f"설비종류: {eq.name}")
            if eq.age_years:
                lines.append(f"설비연식: {eq.age_years}년")
            if eq.energy_cost_annual:
                lines.append(f"에너지비용: {eq.energy_cost_annual}만원")
            if eq.defect_rate:
                lines.append(f"불량률: {eq.defect_rate}%")
        company_context = "\n".join(lines)

    # 프롬프트 구성
    prompt = INFO_COLLECTOR_SYSTEM_PROMPT.format(
        chat_history=history_text if history_text else "없음",
        user_message=state["user_query"],
        company_context=company_context
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
            print("=== complete data ===")
            print(data)

            # company_info가 이미 있으면 설비 정보만 수집
            if state.get("company_info"):
                data["industry_code"] = state["company_info"].industry_code
                data["region"] = state["company_info"].region
            # equipment 있으면 설비 정보 덮어쓰기
            if state.get("equipment"):
                eq = state["equipment"].equipment
                data["equipment_name"] = eq.name
                data["age_years"] = eq.age_years
                data["energy_cost_annual"] = eq.energy_cost_annual
                data["defect_rate"] = eq.defect_rate
                data["current_capacity_value"] = eq.current_capacity_value

            name = data.get("equipment_name", "").lower()
            if "프레스" in name or "press" in name:
                category = "press"
            elif "cnc" in name:
                category = "cnc"
            elif "사출" in name or "injection" in name:
                category = "injection"
            else:
                category = "unsupported"

            # 연식 없으면 업종 평균으로 추정
            if category != "unsupported" and not data.get("age_years"):
                from app.tools.roi_calc import BENCHMARKS
                bench = BENCHMARKS.get(category, {})
                data["age_years"] = bench.get("avg_replacement_cycle_yr", 10)

            # 에너지비용 없으면 업종 평균으로 추정
            if category != "unsupported" and not data.get("energy_cost_annual"):
                from app.tools.roi_calc import BENCHMARKS
                bench = BENCHMARKS.get(category, {})
                data["energy_cost_annual"] = bench.get("avg_energy_cost_manwon", 3000)

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
                return state
            # defect_rate에서 % 제거
            defect_rate = data.get("defect_rate")
            if isinstance(defect_rate, str):
                defect_rate = float(defect_rate.replace("%", "").strip())
            elif defect_rate is not None:
                defect_rate = float(defect_rate)
            else:
                defect_rate = None

            state["equipment"] = EquipmentInput(
                name=data.get("equipment_name", ""),
                category=category,
                age_years=int(data.get("age_years", 0)),
                energy_cost_annual=int(data.get("energy_cost_annual", 0)),
                defect_rate=defect_rate,
                maintenance_cost_annual=int(data["maintenance_cost_annual"]) if data.get("maintenance_cost_annual") else None,
                scenario_a_investment_manwon=int(data["scenario_a_investment_manwon"]) if data.get("scenario_a_investment_manwon") else None,
                scenario_b_investment_manwon=int(data["scenario_b_investment_manwon"]) if data.get("scenario_b_investment_manwon") else None
            )

            state["company_info"] = CompanyContext(
                company_name="",
                industry_code=data.get("industry_code", ""),
                employee_count=int(data.get("employee_count", 0)),
                region=data.get("region", ""),
                annual_revenue=data.get("annual_revenue"),
                company_id=state["company_info"].company_id if state.get("company_info") else None
            )

            state["intent"] = "roi"
            state["final_response"] = ""

        else:
            # 정보 부족하면 다음 질문
            state["final_response"] = result.get("question", "정보를 알려주세요.")

    except json.JSONDecodeError:
        state["final_response"] = "죄송해요, 다시 한번 말씀해 주시겠어요?"

    return state
