from typing import Any, Optional, TypedDict

from app.models.company import CompanyContext
from app.models.equipment import EquipmentInput
from app.models.matched_policy import MatchedPolicy


class FactofitState(TypedDict, total=False):
    # request/session context
    user_query: str
    message: str
    action: str
    source: str
    chat_id: str
    session_id: str
    user_id: str
    company_id: str
    analysis_id: str
    equipment_id: str
    policy_id: str
    selected_equipment_id: str
    simulation_input: dict[str, Any]

    # legacy runtime context (호환 유지)
    intent: str
    is_safe: bool
    company_info: Optional[CompanyContext]
    equipment: Optional[EquipmentInput]
    equipments: Optional[list[dict[str, Any]]]
    policy_intent_choice: Optional[str]
    selected_equipment_for_policy: Optional[str]
    matched_policies: list[MatchedPolicy]
    selected_policy: Optional[dict[str, Any]]
    roi_result: Optional[dict[str, Any]]
    draft_result: Optional[dict[str, Any]]
    draft_context: Optional[dict[str, Any]]
    unsupported_equipment: bool
    safety_dashboard: Optional[dict[str, Any]]
    options: Optional[list[dict[str, Any]]]
    chat_history: list[dict[str, Any]]

    # graph orchestration
    route: str
    error: str
    answer_source: str
    used_graph: bool
    used_llm: bool
    used_roi_recalculation: bool
    used_policy_matching: bool
    persistence_status: str

    # snapshots
    company_snapshot: dict[str, Any]
    company_equipments: list[dict[str, Any]]
    equipment_snapshot: dict[str, Any]
    roi_output: dict[str, Any]
    roi_snapshot: dict[str, Any]
    policy_snapshot: dict[str, Any]
    draft_snapshot: dict[str, Any]
    safety_snapshot: dict[str, Any]

    # output
    response: str
    final_response: str
    cards: list[dict[str, Any]]
    metadata: dict[str, Any]