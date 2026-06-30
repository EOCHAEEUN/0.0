from app.state import FactofitState
from app.agents.capex import format_roi_result, normalize_equipment_category
from app.tools.roi_calc_tool import calculate_equipment_roi


def roi_runtime_node(state: FactofitState) -> FactofitState:
    """
    Graph ROI 실행 전용 노드.
    - 새 분석 시작/설비 선택 후 ROI 계산이 필요한 경우에만 사용
    - capex.py의 DB-first 버튼용 책임과 분리
    """
    equipment = state.get("equipment")
    if not equipment:
        state["final_response"] = "설비 정보가 필요합니다."
        state["intent"] = "response"
        return state

    normalized_category = normalize_equipment_category(
        getattr(equipment, "category", ""),
        getattr(equipment, "name", ""),
    )
    equipment.category = normalized_category
    state["equipment"] = equipment

    supported = ["press", "cnc", "injection"]
    if equipment.category not in supported:
        state["final_response"] = (
            "현재 ROI 계산은 프레스, CNC, 사출성형기 설비만 지원합니다. "
            "설비명을 프레스/CNC/사출기 중 하나로 입력해주세요."
        )
        state["intent"] = "response"
        return state

    if hasattr(equipment, "model_dump"):
        equipment_data = equipment.model_dump()
    else:
        equipment_data = equipment.dict()

    tool_result = calculate_equipment_roi.invoke({"equipment": equipment_data})
    state["roi_result"] = tool_result
    state["final_response"] = format_roi_result(tool_result)
    state["intent"] = "roi"
    return state
