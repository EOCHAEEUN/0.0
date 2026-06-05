from typing import TypedDict, Optional
from app.models.company import CompanyContext
from app.models.equipment import RoiInput
from app.models.matched_policy import MatchedPolicy
from app.models.roi_output import RoiOutput


class FactofitState(TypedDict):
    user_query: str                           # 사용자 원본 입력
    intent: str                               # "roi" / "policy" / "draft" / "info_missing" / "general"
    is_safe: bool                             # guard_node 통과 여부
    company_info: Optional[CompanyContext]    # 기업 프로필 (DB에서 로드)
    equipment: Optional[RoiInput]             # 설비 + ROI 입력값
    matched_policies: list[MatchedPolicy]     # policy_matching 결과
    roi_result: Optional[RoiOutput]           # capex_advisor 계산 결과
    draft_result: Optional[str]               # application_draft 초안서 결과
    final_response: str                       # response_node 최종 응답