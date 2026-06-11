from datetime import date
from typing import Optional
from pydantic import BaseModel


class PolicyAnnouncement(BaseModel):
    policy_id: str
    title: str
    organization: str

    # 분류 (기업마당 원본)
    policy_category: Optional[str] = None          # 기업마당 대분류
    policy_subcategory: Optional[str] = None       # 기업마당 중분류

    # 분류 (우리 서비스용)
    service_category: Optional[str] = None         # 우리 서비스 분류 (스마트공장, 설비/자동화 등)
    service_subcategory: Optional[str] = None      # 우리 서비스 세부분류

    # 지원 정보
    max_amount: Optional[int] = None               # 만원
    max_amount_note: Optional[str] = None          # 금액이 불명확한 경우 설명
    max_amount_source: Optional[str] = None        # 추출 출처 (summary/detail_page/attachment_pdf 등)
    max_amount_evidence: Optional[str] = None      # 추출 근거 (발췌 텍스트)
    amount_extraction_status: Optional[str] = None # extracted/not_found/attachment_error 등

    deadline: Optional[date] = None
    deadline_note: Optional[str] = None            # 마감일이 불명확한 경우 설명

    # 대상 조건
    industry_codes: list[str]
    region: Optional[str] = None
    max_employee_count: Optional[int] = None       # 예: 300 (중소기업 기준)
    min_revenue: Optional[int] = None              # 만원
    max_revenue: Optional[int] = None              # 만원

    # 기타
    # Eligibility conditions
    employee_min: Optional[int] = None
    employee_max: Optional[int] = None
    revenue_min_manwon: Optional[int] = None
    revenue_max_manwon: Optional[int] = None
    company_age_min: Optional[int] = None
    company_age_max: Optional[int] = None
    eligible_company_types: Optional[list[str]] = None
    eligibility_text: Optional[str] = None
    eligibility_extraction_status: Optional[str] = None
    eligibility_evidence: Optional[str] = None

    url: str
    summary: Optional[str] = None
    
    # 데이터 소스 및 보존
    source_name: Optional[str] = None              # 수집처 (bizinfo 등)
    source_id: Optional[str] = None                # 원본 공고ID
    raw_text: Optional[str] = None                 # RAG/검증용 원본 텍스트
    raw_json: Optional[dict] = None                # RAG/검증용 원본 JSON
    hashtags: Optional[list[str]] = None           # 태그 리스트
    
    # 점수 및 선택 정보
    relevance_score: Optional[int] = None          # 제조업 관련성 점수
    is_selected: Optional[bool] = None             # 사용자 선택 여부
    selected_reason: Optional[str] = None          # 선택 이유
