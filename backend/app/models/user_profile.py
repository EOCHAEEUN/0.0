from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.auth import EMAIL_PATTERN, PHONE_PATTERN


class UserProfileCreate(BaseModel):
    user_id: UUID
    email: str
    name: str
    phone: str


class UserProfileContext(UserProfileCreate):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, pattern=PHONE_PATTERN, max_length=30)
    email: Optional[str] = Field(default=None, pattern=EMAIL_PATTERN, max_length=255)
    current_password: Optional[str] = Field(
        default=None, min_length=1, max_length=128
    )
    new_password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    manager_name: Optional[str] = Field(default=None, max_length=100)
    manager_phone: Optional[str] = Field(
        default=None, pattern=PHONE_PATTERN, max_length=30
    )
