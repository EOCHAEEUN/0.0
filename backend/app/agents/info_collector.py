# app/agents/info_collector.py
from app.state import FactofitState


def info_collector_node(state: FactofitState) -> FactofitState:
    """
    설비가 여러 개일 때 어떤 설비인지 선택을 요청합니다.
    흐름:
    1. equipments 목록에서 설비 이름 목록 생성
    2. "어떤 설비에 대해 알아볼까요?" 응답
    3. 프론트에서 equipment_selection 카드로 버튼 렌더링
    4. 사용자가 버튼 클릭 → selected_equipment_id와 함께 재요청
    """
    equipments = state.get("equipments", [])

    if not equipments:
        state["final_response"] = (
            "등록된 설비가 없어요. "
            "마이페이지에서 설비를 먼저 등록해주세요."
        )
        return state

    equipment_list = "\n".join([
        f"• {eq.get('name', '알 수 없음')}"
        for eq in equipments
    ])

    state["final_response"] = (
        f"등록된 설비가 여러 대 있어요. "
        f"어떤 설비에 대해 알아볼까요?\n\n{equipment_list}"
    )

    return state
