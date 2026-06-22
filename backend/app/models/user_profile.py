from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class UserProfileCreate(BaseModel):
    user_id: UUID
    email: str
    name: str
    phone: str

class UserProfileContext(UserProfileCreate):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    new_password: Optional[str] = None
    manager_name: Optional[str] = None      # 담당자명 추가
    manager_phone: Optional[str] = None     # 담당자 연락처 추가