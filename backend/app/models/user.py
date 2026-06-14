from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    user_id: str                           # Auth에서 발급된 사용자 ID
    name: str                              # 이름 (필수)
    phone: str                             # 연락처 (필수)


class UserContext(UserCreate):
    created_at: Optional[datetime] = None  # 서버에서 관리하는 시간
    updated_at: Optional[datetime] = None  # 서버에서 관리하는 시간