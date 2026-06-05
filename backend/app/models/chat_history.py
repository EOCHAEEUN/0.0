from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ChatHistory(BaseModel):
    company_id: str
    intent: str                          # "investment_advice" / "subsidy_search" / "application_help"
    user_query: str
    roi_result: Optional[dict] = None    # capex_advisor 결과
    matched_policies: Optional[list] = None  # policy_matching 결과
    final_response: str
    created_at: datetime
