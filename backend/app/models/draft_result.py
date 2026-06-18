from pydantic import BaseModel
from datetime import datetime

class DraftResult(BaseModel):
    company_id: str
    equipment_id: str
    policy_id: str           # 어떤 공고 기반으로 작성했는지
    scenario: str            # "a" (전체교체) 또는 "b" (부분교체) 또는 c(공통)
    draft_content: dict     
    created_at: datetime
