from typing import Optional

from pydantic import BaseModel, Field

class SignupAgreements(BaseModel):
    service_terms: bool = False
    privacy_policy: bool = False


class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str
    phone: Optional[str] = None
    business_registration_no: Optional[str] = None
    agreements: SignupAgreements


class LoginRequest(BaseModel):
    email: str
    password: str


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
