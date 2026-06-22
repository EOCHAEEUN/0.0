from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


EMAIL_PATTERN = r"^[^@\s]{1,64}@[^@\s]{1,190}$"
PHONE_PATTERN = r"^[0-9+() .-]{7,30}$"


class AuthInputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SignupCompanyInput(AuthInputModel):
    company_name: str = Field(min_length=1, max_length=120)
    industry_name: Optional[str] = Field(default=None, max_length=120)
    industry_code: list[str] = Field(default_factory=list, max_length=20)
    industries: list[dict] = Field(default_factory=list, max_length=20)
    region: str = Field(min_length=1, max_length=100)
    company_type: Optional[str] = Field(default=None, max_length=50)
    main_purpose: Optional[str] = Field(default=None, max_length=200)
    max_employee_count: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    min_revenue_manwon: Optional[int] = Field(default=None, ge=0, le=10**15)
    max_revenue_manwon: Optional[int] = Field(default=None, ge=0, le=10**15)


class SignupAgreements(AuthInputModel):
    service_terms: bool = False
    privacy_policy: bool = False


class SignupRequest(AuthInputModel):
    email: str = Field(min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=7, max_length=30, pattern=PHONE_PATTERN)
    business_registration_no: Optional[str] = Field(default=None, max_length=20)
    agreements: SignupAgreements


class LoginRequest(AuthInputModel):
    email: str = Field(min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=1, max_length=128)


class EmailCodeRequest(AuthInputModel):
    email: str = Field(min_length=3, max_length=255, pattern=EMAIL_PATTERN)


class VerifyEmailCodeRequest(AuthInputModel):
    email: str = Field(min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    token: str = Field(min_length=4, max_length=12, pattern=r"^[0-9A-Za-z-]+$")


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
