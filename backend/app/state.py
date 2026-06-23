from typing import Any, TypedDict, Optional
from app.models.company import CompanyContext
from app.models.matched_policy import MatchedPolicy
from app.models.equipment import EquipmentInput

class FactofitState(TypedDict):
    user_query: str                           # 사용자 원본 입력
    intent: str                               # "roi" / "policy" / "draft" / "safety" / "info_missing" / "general"
    is_safe: bool                             # guard_node 통과 여부
    company_info: Optional[CompanyContext]    # 기업 프로필 (DB에서 로드)
    equipment: Optional[EquipmentInput]       # 선택된 설비 + ROI 입력값
    equipment_id: Optional[str]              # 선택된 설비 ID
    equipments: Optional[list[dict]]         # 등록된 전체 설비 목록 (여러 설비 선택용)
    selected_equipment_id: Optional[str]     # 사용자가 선택한 설비 ID
    matched_policies: list[MatchedPolicy]    # policy_matching 결과
    roi_result: Optional[dict]               # capex_advisor 계산 결과
    draft_result: Optional[dict[str, Any]]   # application_draft result JSON
    draft_context: Optional[dict[str, Any]]  # draft-only runtime context
    chat_history: list[dict]                 # 이전 대화 이력
    final_response: str                      # response_node 최종 응답
    unsupported_equipment: bool              # 미지원 설비 여부
    chat_id: Optional[str]
    safety_dashboard: Optional[dict]         # get_safety_dashboard 결과 (안전점검 노드용)
