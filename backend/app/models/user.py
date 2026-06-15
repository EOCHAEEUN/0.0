from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UserProfileCreate(BaseModel):
    user_id: UUID
    name: str
    phone: str


class UserProfileContext(UserProfileCreate):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
