from typing import Any, TypedDict, Optional
from app.models.company import CompanyContext
from app.models.matched_policy import MatchedPolicy
from app.models.equipment import EquipmentInput

class FactofitState(TypedDict, total=False):
    user_query: str                           # 사용자 원본 입력
    intent: str                               # "roi" / "policy" / "draft" / "info_missing" / "general"
    is_safe: bool                             # guard_node 통과 여부
    company_info: Optional[CompanyContext]    # 기업 프로필 (DB에서 로드)
    equipment: Optional[EquipmentInput]       # 설비 + ROI 입력값
    equipment_id: Optional[str]
    equipments: Optional[list[dict]]
    selected_equipment_id: Optional[str]
    policy_intent_choice: Optional[str]  # "equipment" / "general"
    selected_equipment_for_policy: Optional[str]  # policy용 설비 선택
    matched_policies: list[MatchedPolicy]    # policy_matching 결과
    selected_policy: Optional[dict]
    roi_result: Optional[dict]          # capex_advisor 계산 결과
    draft_result: Optional[dict[str, Any]]   # application_draft result JSON
    draft_context: Optional[dict[str, Any]]  # draft-only runtime context
    chat_history: list[dict]                 # 이전 대화 이력 [{"role": "user/assistant", "content": "..."}]
    final_response: str                       # response_node 최종 응답
    unsupported_equipment: bool
    chat_id: Optional[str]
    safety_dashboard: Optional[dict]
    options: Optional[list[dict]]
    additional_text_for_draft: str  # 계획서 초안에 추가할 사용자 문장
    refined_text_for_draft: str     # 가공된 사용자 문장