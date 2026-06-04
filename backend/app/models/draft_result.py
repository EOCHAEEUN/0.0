from pydantic import BaseModel
from datetime import datetime

class DraftResult(BaseModel):
    company_id: str
    policy_id: str           # 어떤 공고 기반으로 작성했는지
    draft_content: str       # 초안서 본문 (마크다운)
    created_at: datetime
