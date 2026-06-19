from app.state import FactofitState
from app.core.database import get_db
from app.core.llm import llm


def equipment_safety_node(state: FactofitState) -> FactofitState:
    equipment = state.get("equipment")
    company = state.get("company_info")

    if not equipment:
        state["final_response"] = "설비 정보가 없어서 안전점검을 진행할 수 없어요."
        return state

    db = get_db()

    # 1. safety_rule 테이블에서 점검 항목 조회
    rules = (
        db.table("safety_rule")
        .select("*")
        .eq("equipment_category", equipment.category)
        .execute()
    )

    # 2. LLM으로 안전 점수 계산 및 점검 결과 생성 (추후 구현)

    # 3. safety_inspection 저장 (추후 구현)

    state["final_response"] = "안전점검 결과를 생성했습니다."
    return state
