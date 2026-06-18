# FactoFit API Contract v3 Local

작성 기준: 2026-06-18 로컬 코드 기준  
원본: `factofit_api_spec_v2.md`  
목적: 회원가입/마이페이지 최종 흐름 + ROI 기반 정책추천 + raw 후보 목록 + draft 분리 구조 반영

<!-- 변경 주석 규칙
- 추가: 이번 로컬 수정으로 새로 생긴 API/응답/필드
- 변경: v2 대비 의미나 처리 방식이 달라진 부분
- 삭제/분리: 기존 흐름에서 빠지거나 별도 API로 분리된 부분
- 주의: 코드에는 있으나 연결/정리 확인이 필요한 부분
-->

## 0. Core Flow

```txt
이메일 인증코드 발송
-> 이메일 인증
-> signup: user_profile만 저장
-> onboarding: company 저장/upsert
-> mypage: company/equipment 상세 저장
-> analyze: ROI 계산 + 정책 추천 + 결과 저장
-> draft: 사용자가 정책/시나리오 선택 후 신청서 초안 생성
```

<!-- 변경 -->
`/api/analyze`는 더 이상 신청서 초안까지 생성하지 않는다.  
ROI 계산과 정책 추천만 담당한다.

<!-- 추가 -->
신청서 초안은 `/api/draft`로 분리한다.

## 1. Common

Base URL:

```txt
/api
```

Authenticated requests:

```txt
Authorization: Bearer {access_token}
Content-Type: application/json
```

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "message": "error message",
  "error": "detail"
}
```

금액 단위는 별도 표기가 없으면 `만원`이다.

## 2. Auth

### POST `/api/auth/send-email-code`

이메일 인증코드 발송.

Request:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "message": "Verification email sent."
  }
}
```

### POST `/api/auth/verify-email-code`

이메일 인증코드 검증 및 Supabase session 발급.

Request:

```json
{
  "email": "user@example.com",
  "token": "123456"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1780000000,
    "user": {
      "id": "auth-user-uuid",
      "email": "user@example.com"
    }
  }
}
```

### POST `/api/auth/signup`

회원 기본정보 저장.  
`company`는 저장하지 않고 `user_profile`만 upsert한다.

<!-- 변경 -->
`company` 기본정보는 `/api/auth/signup`이 아니라 `/api/onboarding`에서 저장한다.

Header:

```txt
Authorization: Bearer {access_token}
```

Request:

```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "name": "홍길동",
  "phone": "01000000000",
  "business_registration_no": "1234567890",
  "agreements": {
    "service_terms": true,
    "privacy_policy": true
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1780000000,
    "user": {
      "id": "auth-user-uuid",
      "email": "user@example.com"
    },
    "user_profile": {
      "user_id": "auth-user-uuid",
      "email": "user@example.com",
      "name": "홍길동",
      "phone": "01000000000"
    }
  }
}
```

### POST `/api/auth/login`

로그인 및 기본 사용자/회사 정보 반환.

Request:

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1780000000,
    "user": {
      "id": "auth-user-uuid",
      "email": "user@example.com"
    },
    "user_profile": {},
    "company": {},
    "company_id": "company-uuid"
  }
}
```

### POST `/api/auth/refresh`

<!-- 추가 -->
access token 만료 시 refresh token으로 새 session을 발급한다.

Request:

```json
{
  "refresh_token": "refresh-token"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1780000000,
    "user": {
      "id": "auth-user-uuid",
      "email": "user@example.com"
    }
  }
}
```

## 3. Onboarding / My Page

### POST `/api/onboarding`

company 기본정보 또는 상세정보 저장.  
`current_user.id` 기준으로 `company.user_id`를 고정하고 `user_id` conflict 기준 upsert한다.

<!-- 변경 -->
중복 company row를 만들지 않고 `user_id` 기준 1개 row를 유지한다.

Header:

```txt
Authorization: Bearer {access_token}
```

Request:

```json
{
  "company_name": "팩토핏정밀",
  "industry_name": "금속가공",
  "industry_code": ["C24", "C25"],
  "business_registration_no": "1234567890",
  "region": "서울특별시",
  "company_type": "중소기업",
  "primary_purpose": ["지원사업 추천", "ROI 분석"],
  "employee_count": null,
  "annual_revenue": 95000,
  "revenue_2y_ago_manwon": 90000,
  "revenue_3y_ago_manwon": 87000,
  "total_assets_manwon": 500000,
  "is_disclosure_group_member": false,
  "established_year": 2024,
  "workplace_type": "공장"
}
```

<!-- 변경 -->
`company_size`는 사용하지 않고 `company_type`으로 통일한다.

Response:

```json
{
  "success": true,
  "data": {
    "company_id": "company-uuid",
    "company": {}
  }
}
```

### GET `/api/onboarding/me`

마이페이지 초기 데이터 조회.

Response:

```json
{
  "success": true,
  "data": {
    "user_profile": {},
    "company": {},
    "equipments": []
  }
}
```

<!-- 변경 -->
`company`는 배열이 아니라 단일 객체로 반환한다.

### PATCH `/api/user-profile/me`

사용자 기본정보 수정.

Request:

```json
{
  "name": "홍길동",
  "phone": "01012345678"
}
```

### PATCH `/api/onboarding/company/{company_id}`

company 상세정보 수정.  
`company.user_id = current_user.id`인 경우에만 수정한다.

## 4. Equipment

### POST `/api/onboarding/{company_id}/equipment`

설비 추가.  
`company_id`가 현재 사용자의 회사인지 검증한다.

Request:

```json
{
  "name": "프레스 1호기",
  "category": "press",
  "process": "프레스공정",
  "age_years": 10,
  "energy_cost_annual": 4500,
  "defect_rate": 3.0,
  "maintenance_cost_annual": 1200,
  "current_capacity_value": 1600,
  "production_qty": 50000,
  "contribution_margin_won": 5000,
  "scenario_a_investment_manwon": 22000,
  "scenario_b_investment_manwon": 4994
}
```

### PATCH `/api/equipment/{equipment_id}`

설비 수정.  
`equipment.company_id`가 현재 사용자의 company인지 검증한다.

### DELETE `/api/equipment/{equipment_id}`

<!-- 추가 -->
설비 삭제.  
화면에 삭제 기능이 있고 RLS에도 DELETE 권한이 추가된 구조와 맞춘다.

Response:

```json
{
  "success": true,
  "message": "equipment deleted"
}
```

<!-- 삭제/분리 -->
독립 라우터 `backend/app/routers/equipment.py`는 삭제되었고, 현재 구조는 `onboarding.py` 안의 equipment API를 사용한다.

## 5. Analyze: ROI + Policy Recommendation

### POST `/api/analyze`

<!-- 변경 -->
ROI 계산, 정책 후보 조회, 정책 추천, 결과 저장을 담당한다.  
신청서 초안 생성은 담당하지 않는다.

Query:

```txt
/api/analyze?company_id={company_id}&equipment_id={equipment_id}
```

Header:

```txt
Authorization: Bearer {access_token}
```

Processing:

```txt
1. current_user 기준 company 조회
2. company_id/equipment_id 기준 equipment 조회
3. calculate_roi(equipment) 직접 실행
4. policy DB에서 업종/지역/기업유형 기준 raw_candidates 조회
5. ROI 결과 기반 A/B 정책 쿼리 생성
6. raw_candidates 안에서 A/B 각각 후보 10개 선별
7. A/B 후보 병합 및 ROI 기반 rerank
8. 상위 10개를 LLM에 전달하여 reason/llm_score/hybrid_score 생성
9. roi_output 저장
10. matched_policy 저장
11. roi_result + matched_policies + raw_candidates 반환
```

Response:

```json
{
  "success": true,
  "data": {
    "roi_result": {
      "scenario_a": {},
      "scenario_b": {},
      "recommended": "A"
    },
    "matched_policies": [
      {
        "id": "policy-id",
        "content": "정책 본문",
        "metadata": {
          "title": "정책명",
          "organization": "기관명",
          "max_amount": 50000,
          "deadline": "2026-06-30"
        },
        "scenario_match": ["a", "b"],
        "scenario_label": "A/B 공통 적합",
        "final_score": 0.83,
        "hybrid_score": 0.78,
        "llm_score": "●●●●○",
        "reason": "추천 이유"
      }
    ],
    "policies": [],
    "raw_candidates": [
      {
        "policy_id": "policy-id",
        "title": "정책명",
        "organization": "기관명",
        "url": "https://...",
        "deadline": "2026-06-30",
        "max_amount": 50000,
        "industry_code": ["C25"],
        "region": "전국"
      }
    ],
    "total_candidates": 38,
    "response": "ROI 계산 및 정책 추천이 완료되었습니다."
  }
}
```

<!-- 추가 -->
`raw_candidates`는 LLM 평가 전 1차 필터 후보 목록이다.  
화면 아래 리스트에서 사용하며 점수/순위/reason을 표시하지 않는다.

<!-- 추가 -->
`matched_policies`는 LLM 평가까지 끝난 최종 추천 목록이다.  
화면 위쪽 추천 카드/순위 영역에서 사용한다.

<!-- 주의 -->
프론트 점수 표시는 `hybrid_score -> final_score -> match_score -> llm_score` 우선순위로 계산해야 백엔드 정렬과 화면 점수가 맞다.

## 6. Policies

### GET `/api/policies?company_id={company_id}&limit=10`

기존 정책 추천 조회/생성 라우터.

<!-- 주의 -->
현재 `/api/analyze` 기반 정책 추천이 주 흐름이다.  
`/api/policies`는 legacy/fallback 성격이 강하고, 기존 프롬프트에 최대 5개 출력 제한이 남아 있을 수 있다.

Response:

```json
{
  "success": true,
  "data": {
    "policies": [],
    "total": 0
  }
}
```

## 7. Draft

### POST `/api/draft`

<!-- 추가 -->
신청서 초안 생성 API.  
분석 완료 후 저장된 `roi_output`, `matched_policy`를 조회해서 선택한 시나리오 기준으로 초안을 생성한다.

<!-- 주의 -->
현재 `backend/app/routers/draft.py` 파일은 있으나 `main.py`에 include되어 있는지 별도 확인 필요하다.  
실제 API로 쓰려면 `app.include_router(draft.router, prefix="/api", tags=["draft"])` 연결이 필요하다.

Header:

```txt
Authorization: Bearer {access_token}
```

Request:

```json
{
  "company_id": "company-uuid",
  "equipment_id": "equipment-uuid",
  "scenario": "a"
}
```

`scenario`:

```txt
a = 전체교체
b = 부분개선
c = 공통
```

Processing:

```txt
1. current_user 기준 company 조회
2. equipment 조회
3. roi_output 조회
4. 선택 scenario의 ROI 결과 추출
5. matched_policy 조회
6. application_draft_node 실행
7. draft_result 저장
```

Response:

```json
{
  "success": true,
  "data": {
    "scenario": "a",
    "draft_result": {}
  }
}
```

## 8. Deprecated / Removed API Notes

| 항목 | 상태 | 사유 |
|---|---|---|
| `/api/analyze` 안의 draft 생성 | 삭제/분리 | analyze가 너무 무거워지고 draft FK 오류가 발생하여 `/api/draft`로 분리 |
| `routers/equipment.py` | 삭제 | equipment API는 onboarding 라우터 구조로 통일 |
| `company_size` | 삭제 | `company_type`으로 통일 |
| `roi_input` 테이블/API | 사용 안 함 | ROI 입력은 equipment/company 저장값 기반으로 계산 |

