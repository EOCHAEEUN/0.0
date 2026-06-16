from typing import Optional
from pydantic import BaseModel, Field

class SignupCompanyInput(BaseModel):
    company_name: str
    industry_name: Optional[str] = None
    industry_code: list[str] = Field(default_factory=list)
    industries: list[dict] = Field(default_factory=list)
    region: str
    company_type: Optional[str] = None
    main_purpose: Optional[str] = None
    max_employee_count: Optional[int] = Field(default=None, ge=0)
    min_revenue_manwon: Optional[int] = Field(default=None, ge=0)
    max_revenue_manwon: Optional[int] = Field(default=None, ge=0)

class SignupAgreements(BaseModel):
    service_terms: bool = False
    privacy_policy: bool = False


class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str
    phone: Optional[str] = None
    business_registration_no: Optional[str] = None
    company: SignupCompanyInput
    agreements: SignupAgreements


class LoginRequest(BaseModel):
    email: str
    password: str

class EmailCodeRequest(BaseModel):
    email: str


class VerifyEmailCodeRequest(BaseModel):
    email: str
    token: str = Field(min_length=4)

class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
