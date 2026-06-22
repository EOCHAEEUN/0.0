# Backend 코드 변경 위치 및 외부 리뷰 요청서

작성일: 2026-06-22  
기준: 현재 로컬 작업트리의 `backend/` 코드  
목적: 이 문서를 ChatGPT 등 외부 코드 리뷰 도구에 코드와 함께 전달하여 변경 안전성, 보안, 회귀 위험을 분석받기 위함

> 아래 라인 번호는 2026-06-22 현재 작업트리 기준입니다. 이후 코드가 추가되면 라인 번호가 이동할 수 있습니다.

---

## ChatGPT에 전달할 분석 요청문

아래 문장을 이 문서 및 변경된 코드와 함께 전달하면 됩니다.

```text
이 문서는 FastAPI + Supabase 기반 프로젝트의 backend 변경 내역입니다.

다음 관점에서 코드 리뷰해주세요.

1. 기존 ROI 계산, 정책 추천 점수, 신청서 생성, 안전점검 계산 결과가 변경될 위험
2. HttpOnly 쿠키, refresh token, CSRF Origin 검사, CORS 설정의 보안 적절성
3. 로그인·OTP·분석·신청서·PDF rate limit 구현의 우회 가능성과 운영 환경 문제
4. 요청 크기 제한 ASGI middleware가 정상 요청, streaming, multipart 요청을 깨뜨릴 가능성
5. Pydantic 입력 제한이 기존 프론트 요청이나 DB 데이터를 거부할 가능성
6. service-role Supabase 클라이언트 사용 시 IDOR 및 RLS 우회 위험
7. 비밀번호·이메일 변경 재인증 흐름과 세션 폐기 누락 여부
8. LLM prompt injection 방어가 기존 정책 추천·신청서 결과를 과도하게 변경할 가능성
9. 내부 DB/Supabase 오류가 API 응답, 로그, 브라우저에 노출되는 지점
10. 단일 프로세스 메모리 rate limiter를 다중 worker/다중 서버 환경에서 사용할 때의 문제
11. 타입 오류, FastAPI dependency 순서, middleware 순서, 예외 처리 문제
12. 반드시 수정해야 할 사항을 심각도 순으로 정리

/chat 라우터는 이번 변경 범위에서 제외했으므로 별도 항목으로만 지적하고,
이번 변경 코드와 직접 관련된 문제를 우선 분석해주세요.

계산 로직은 직접 수정하지 않는 것이 목표입니다.
계산식이 변경됐거나 간접적으로 결과가 달라질 수 있는 부분을 명확히 구분해주세요.
```

---

## 전체 변경 파일

### 기존 파일 수정

1. `app/agents/draft.py`
2. `app/agents/policy.py`
3. `app/core/auth.py`
4. `app/core/config.py`
5. `app/main.py`
6. `app/models/auth.py`
7. `app/models/company.py`
8. `app/models/equipment.py`
9. `app/models/user_profile.py`
10. `app/routers/analyze.py`
11. `app/routers/auth.py`
12. `app/routers/draft.py`
13. `app/routers/onboarding.py`
14. `app/routers/reports.py`
15. `app/routers/safety.py`

### 신규 코드·설정 파일

1. `.env.example`
2. `app/core/session.py`
3. `app/core/rate_limit.py`
4. `app/core/request_limits.py`
5. `app/core/llm_security.py`
6. `app/models/validated_types.py`
7. `app/services/policy_response.py`

### 문서 파일

- `CHANGELOG_AUTH_SECURITY_20260622.md`
- 현재 문서 `BACKEND_CODE_DIFF_REVIEW_20260622.md`

---

# 파일별 변경 위치

## 1. `app/agents/draft.py`

현재 파일 길이: 49줄

### 변경 라인

- 5줄: `llm_security` import 추가
- 19줄: 기존 신청서 시스템 프롬프트 앞에 비신뢰 데이터 보안 지시문 추가
- 24~27줄: 정책과 ROI 데이터를 JSON 직렬화해서 프롬프트에 삽입
- 32줄: 기존 `state["user_query"]` 대신 고정된 신청서 생성 명령 전달

### 변경 전 핵심

```python
prompt = APPLICATION_DRAFT_SYSTEM_PROMPT.format(...)
HumanMessage(content=state["user_query"])
```

### 변경 후 핵심

```python
prompt = (
    UNTRUSTED_DATA_INSTRUCTION
    + "\n\n"
    + APPLICATION_DRAFT_SYSTEM_PROMPT.format(...)
)

selected_policy=serialize_untrusted(selected_policy)
roi_result=serialize_untrusted(roi_result)
HumanMessage(content="Generate the application draft from the supplied data.")
```

### 검토 포인트

- 신청서 생성 결과의 필수 JSON 필드가 기존과 동일한지
- 정책·ROI 데이터가 문자열로 직렬화되면서 LLM 해석 품질이 변하지 않는지
- 기존 사용자 질의를 제거한 것이 신청서 내용에 필요한 정보를 잃게 하지 않는지

### 계산 로직 영향

- ROI 계산 공식 변경 없음
- LLM 생성 결과는 달라질 가능성 있음

---

## 2. `app/agents/policy.py`

현재 파일 길이: 630줄

### 변경 라인

- 11줄: `UNTRUSTED_DATA_INSTRUCTION` import
- 410줄: 정책 LLM 재평가 프롬프트 앞에 비신뢰 데이터 보안 지시문 추가

### 변경 후 핵심

```python
prompt = (
    UNTRUSTED_DATA_INSTRUCTION
    + "\n\n"
    + POLICY_HYBRID_PROMPT.format(...)
)
```

### 검토 포인트

- 동일한 후보 입력에서 `llm_score`, `reason`, 최종 순위가 과도하게 변하지 않는지
- 보안 지시문이 JSON 출력 형식 지시보다 우선되어 출력이 깨지지 않는지

### 계산 로직 영향

- 벡터 검색, 후보 병합, ROI 재정렬 공식 변경 없음
- LLM 평가 점수에는 간접 영향 가능

---

## 3. `app/core/auth.py`

현재 파일 길이: 80줄

### 변경 라인

- 3~8줄: `Request`, 설정, 요청별 Supabase 클라이언트, 쿠키 이름 import
- 28~34줄: 허용 프론트 Origin 목록 생성
- 36~46줄: 쿠키 인증 상태 변경 요청의 Origin 검사
- 48~80줄: Bearer 또는 HttpOnly access cookie로 사용자 인증
- 66줄: 공유 DB 클라이언트 대신 요청별 `create_service_client().auth.get_user(token)` 사용

### 변경 후 인증 우선순위

```text
Authorization Bearer token
→ 없으면 factofit_access 쿠키
→ 둘 다 없으면 401
```

### CSRF 검사

```python
if request.method.upper() not in {"GET", "HEAD", "OPTIONS"}:
    Origin이 없거나 허용 목록에 없으면 403
```

### 검토 포인트

- Bearer token이 있으면 Origin 검사를 생략하는 것이 적절한지
- 프록시 또는 모바일 클라이언트에서 Origin 없는 요청이 차단되는 문제
- `create_service_client()`를 요청마다 생성하는 비용
- GET API가 실제로 상태를 변경하는 경우가 없는지

### 계산 로직 영향

- 없음

---

## 4. `app/core/config.py`

현재 파일 길이: 67줄

### 변경 라인

- 20~34줄: 쿠키, 요청 크기, rate limit, Origin 설정 추가
- 47~53줄: `SameSite` 값 검증
- 55~65줄: 운영 Origin이 HTTPS면 Secure cookie를 자동 활성화하는 `cookie_secure`

### 추가 설정

```python
auth_cookie_secure
auth_cookie_samesite
auth_access_cookie_max_age
auth_refresh_cookie_max_age
max_request_body_bytes
auth_login_attempts_per_minute
auth_email_code_requests_per_minute
auth_email_code_verifications_per_minute
auth_refresh_requests_per_minute
expensive_api_requests_per_minute
frontend_origins
```

### 검토 포인트

- 운영 환경에서 `AUTH_COOKIE_SECURE`가 잘못 false로 설정될 가능성
- `SameSite=None`일 때 Secure 강제 검증이 없는 점
- 환경변수 값이 0 또는 음수일 때 검증이 없는 점

---

## 5. `app/main.py`

현재 파일 길이: 57줄

### 변경 라인

- 4~5줄: 설정과 요청 크기 미들웨어 import
- 13~16줄: 최대 요청 크기 미들웨어 등록
- 18~30줄: CORS 설정을 환경변수 기반으로 변경하고 method/header 축소
- 41~57줄: 응답 보안 헤더 미들웨어 추가

### 추가 보안 헤더

```text
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy
Content-Security-Policy
Cache-Control: no-store  # auth API
Strict-Transport-Security  # secure cookie 운영 환경
```

### 검토 포인트

- 미들웨어 등록 순서가 CORS·413 응답·보안 헤더에 미치는 영향
- API용 CSP가 Swagger `/docs` 화면을 깨뜨리는지
- 향후 파일 업로드 API에 1MB 제한이 너무 작은지

---

## 6. `app/models/auth.py`

현재 파일 길이: 57줄

### 변경 라인

- 6~7줄: 이메일·전화번호 정규식
- 10~11줄: 공통 `extra="forbid"`, 문자열 공백 제거
- 14~24줄: 가입 회사 정보 길이·수치 상한
- 27~29줄: 동의 모델
- 32~38줄: 회원가입 입력 길이·형식
- 41~43줄: 로그인 입력 제한
- 46~47줄: 이메일 코드 발송 입력 제한
- 50~52줄: 인증 코드 길이·문자 제한

### 검토 포인트

- 한국 전화번호, 국제 전화번호가 정규식에 정상 통과하는지
- 실제 사용하는 이메일 형식을 과도하게 거부하지 않는지
- `extra="forbid"`가 기존 프론트의 추가 필드를 422로 만들지 않는지

---

## 7. `app/models/company.py`

현재 파일 길이: 64줄

### 변경 라인

- 8~9줄: 공통 회사 입력 모델 설정
- 12~21줄: 온보딩 회사 입력 길이·개수·수치 상한
- 24~40줄: 회사 수정 입력 제한
- 43~52줄: DB 조회용 `CompanyContext`는 추가 필드를 무시하도록 예외 처리
- 54~64줄: 기존 3개년 평균매출 계산 메서드 유지

### 수치 상한

```text
employee_count <= 10,000,000
매출·자산 <= 10^15
established_year: 1800~2200
```

### 검토 포인트

- DB에 기존 제한보다 큰 값이 존재하는지
- `industry_code` 최소 1개 조건이 모든 기존 요청과 맞는지
- `CompanyContext` 상속으로 선택 필드 검증이 예상대로 동작하는지

### 계산 로직 영향

- `estimated_avg_revenue_3y_manwon()` 공식 변경 없음

---

## 8. `app/models/equipment.py`

현재 파일 길이: 29줄

### 변경 라인

- 7~8줄: `EquipmentInput` 추가 필드 거부 및 공백 제거
- 10~25줄: 설비 문자열 길이와 숫자 상한
- 28~29줄: 기존 `EquipmentCreateRequest` 유지

### 주요 제한

```text
설비명 <= 120자
카테고리 <= 50자
공정 <= 120자
사용연수 <= 200년
비용·투자금 <= 10^12
생산량·용량 <= 10^15
불량률 0~100
```

### 검토 포인트

- 실제 ROI 테스트 데이터가 상한을 넘지 않는지
- `extra="forbid"`가 분석 과정에서 생성한 추가 필드를 차단하지 않는지

### 계산 로직 영향

- ROI 공식 변경 없음
- ROI 함수에 전달되기 전 입력 허용 범위만 변경

---

## 9. `app/models/user_profile.py`

현재 파일 길이: 35줄

### 변경 라인

- 5~7줄: Pydantic 검증 도구 및 공통 정규식 import
- 22~35줄: 프로필 수정 입력 검증
- 28~30줄: `current_password` 추가
- 31줄: 새 비밀번호 8~128자

### 검토 포인트

- 프론트가 `current_password` snake_case로 보내는지
- 이메일만 변경하는 경우와 비밀번호만 변경하는 경우 모두 현재 비밀번호가 요구되는지
- `manager_name`, `manager_phone` DB 컬럼 존재 여부

---

## 10. `app/models/validated_types.py` — 신규

현재 파일 길이: 24줄

### 전체 파일

- 6~14줄: 표준 UUID 문자열 검증 타입
- 16~24줄: 정책 ID 허용 문자 및 길이 검증 타입

### 정책 ID 허용 문자

```regex
^[0-9A-Za-z._:-]+$
```

### 검토 포인트

- 실제 DB의 정책 ID에 한글, 공백, `/`, 괄호가 들어가는지
- 들어간다면 정상 정책 ID가 422로 거부될 수 있음

---

## 11. `app/routers/analyze.py`

현재 파일 길이: 281줄

### 변경 라인

- 4~10줄: `Request`, 설정, rate limiter import
- 20줄: 정책 화면 응답 매핑 서비스 import
- 75~97줄: `/analyze`의 UUID 검증과 사용자별 rate limit
- 208~210줄: 정책 결과를 프론트 응답 구조로 변환
- 272~279줄: 변환된 정책 배열을 API 응답으로 반환

### 유지된 계산 구간

- 28~73줄: 화면 표시 점수 보정 함수는 기존 유지
- 147줄 부근: `calculate_roi(equipment)` 호출 유지
- 정책 후보 검색, 병합, ROI 재정렬, LLM 재평가 순서 유지
- ROI 및 정책 DB 저장 로직 유지

### 검토 포인트

- 기존 회사·설비 ID가 전부 UUID인지
- rate limit 10회/분이 개발·운영 사용 흐름에 적절한지
- `policy_response.py` 매핑이 기존 프론트 필드를 누락하지 않는지

---

## 12. `app/services/policy_response.py` — 신규

현재 파일 길이: 195줄

### 전체 파일 역할

- 4~35줄: 중첩·평면 정책 값 선택 헬퍼
- 37~177줄: 정책을 프론트 화면용 필드로 정규화
- 179~183줄: raw candidate 정규화
- 185~195줄: matched/raw 목록 일괄 변환

### 주요 변환 필드

```text
id / policy_id
title / policy_title
agency / organization
deadline / deadline_note
max_amount / max_amount_manwon
summary / support_content
category / sub_category
match_score / final_score / hybrid_score
scenario_match / scenario_label
source_url
```

### 검토 포인트

- 금액 단위가 모두 만원인지
- 빈 값 fallback 순서가 적절한지
- 점수 값을 재계산하지 않고 그대로 전달하는지
- 정책 상세 모달에서 사용하는 필드가 모두 포함됐는지

### 계산 로직 영향

- 순위·점수 계산 없음
- 응답 매핑만 수행

---

## 13. `app/routers/auth.py`

현재 파일 길이: 357줄

### 공통 헬퍼

- 23~33줄: 토큰을 제외한 세션 응답 생성
- 36~46줄: Supabase 세션을 HttpOnly 쿠키로 저장
- 49~60줄: 인증 POST 요청 Origin 검사
- 63~81줄: 현재 사용자 프로필·회사 정보 조회

### 이메일 인증 발송

- 88~129줄
- Origin 검사
- IP+이메일 rate limit
- 이메일 전체 rate limit
- 내부 Supabase 오류 응답 제거

### 이메일 코드 검증

- 131~168줄
- Origin 검사
- 분당 인증 코드 검증 제한
- 검증 성공 시 쿠키 발급

### 회원가입 완료

- 170~243줄
- 분당 요청 제한
- Auth 사용자 비밀번호·metadata 업데이트
- `user_profile` upsert
- 로그인 후 쿠키 발급
- 내부 오류 숨김

### 로그인

- 246~287줄
- Origin 검사
- IP+이메일 기준 분당 5회
- 이메일 전체 기준 분당 10회
- access/refresh token을 JSON에 반환하지 않고 쿠키로만 저장

### refresh

- 289~318줄
- refresh cookie를 Supabase에 전달
- 회전된 access/refresh 쿠키 재발급
- 실패 시 쿠키 삭제

### logout

- 321~335줄
- Supabase 세션 종료 시도
- 인증 쿠키 삭제

### session/me

- 338~357줄
- 로그인 상태와 사용자 컨텍스트 반환

### 검토 포인트

- logout이 실제로 global Supabase 세션을 폐기하는지
- 회원가입 완료 API의 Origin 검사가 `get_current_user` dependency에만 의존하는 구조가 충분한지
- rate limit이 다중 worker에서 공유되지 않는 점
- 내부 로그에 이메일·토큰·비밀번호가 남지 않는지
- refresh token rotation 재사용 감지 정책과 맞는지

---

## 14. `app/core/session.py` — 신규

현재 파일 길이: 54줄

### 변경 라인

- 6~7줄: access/refresh cookie 이름
- 10~39줄: 쿠키 발급
- 42~54줄: 쿠키 삭제

### 쿠키 Path

```text
access cookie: /api
refresh cookie: /api/auth
```

### 검토 포인트

- refresh cookie가 `/api/auth/refresh`, `/api/auth/logout`에 정상 전송되는지
- 운영 HTTPS에서 Secure가 항상 적용되는지
- `__Host-` prefix를 사용할 필요가 있는지

---

## 15. `app/core/rate_limit.py` — 신규

현재 파일 길이: 68줄

### 변경 라인

- 10~13줄: 메모리 bucket 및 lock
- 16~27줄: IP·식별자 기반 key 생성
- 30~68줄: sliding-window 형태 요청 횟수 제한

### 동작

- 초과 시 429
- `Retry-After` 헤더 반환
- 이메일 원문 대신 SHA-256 일부를 key로 사용
- 최대 bucket 10,000개

### 검토 포인트

- 다중 worker/다중 서버에서는 제한이 공유되지 않음
- 서버 재시작 시 제한 초기화
- 프록시 환경에서 `request.client.host`가 실제 사용자 IP인지
- 운영에서는 Redis 기반으로 교체해야 하는지

---

## 16. `app/core/request_limits.py` — 신규

현재 파일 길이: 63줄

### 전체 파일 역할

- Content-Length 사전 검사
- 실제 ASGI body chunk 누적 크기 검사
- 최대 크기 초과 시 413
- 정상 요청 body를 저장한 뒤 하위 앱에 재전달

### 검토 포인트

- 모든 요청 body를 메모리에 저장하는 점
- multipart/file upload와 streaming 요청 호환성
- 클라이언트 disconnect 처리
- 1MB 기본값의 적절성

---

## 17. `app/core/llm_security.py` — 신규

현재 파일 길이: 16줄

### 변경 라인

- 5~11줄: 비신뢰 데이터 시스템 지시문
- 14~16줄: 입력을 JSON으로 직렬화하고 최대 20,000자로 자름

### 검토 포인트

- 데이터가 20,000자를 넘을 때 중요한 정책 근거가 잘릴 가능성
- 문자열 자르기가 JSON 중간에서 끝나 유효하지 않은 JSON 조각이 될 가능성
- 지시문이 정책·신청서 출력 품질에 미치는 영향

---

## 18. `app/routers/draft.py`

현재 파일 길이: 236줄

### 변경 라인

- 4~15줄: Request, rate limit, 검증 타입 import
- 22~25줄: request body의 회사·설비 UUID 및 정책 ID 검증
- 64~76줄: 사용자별 분당 생성 제한

### 유지된 로직

- 44~61줄: 시나리오 선택 로직 유지
- 회사·설비 소유권 검사 유지
- ROI 결과 및 TOP 5 정책 조회 유지
- 신청서 결과 DB 저장 유지

### 계산 로직 영향

- 시나리오 선택·지원금·ROI 값 계산 변경 없음

---

## 19. `app/routers/onboarding.py`

현재 파일 길이: 454줄

### 회사 등록

- 18~63줄
- 기존 저장 로직 유지
- 56줄에서 서버 로그 기록
- 응답의 상세 DB 오류 제거

### 내 정보 조회

- 66~115줄
- 기존 사용자 ID 기반 조회 유지
- 상세 예외 응답 제거

### 프로필·계정 변경

- 117~175줄
- 이메일 또는 비밀번호 변경 시 현재 비밀번호 재인증
- 담당자명·담당자 연락처 업데이트 추가

### 회사 수정

- 177~241줄
- 179~187줄 UUID path 검증
- 소유권 필터 유지
- 내부 오류 숨김

### 설비 등록

- 243~315줄
- 245~253줄 UUID path 검증
- 회사 소유권 확인 유지
- 설비 카테고리 정규화 유지

### 설비 수정

- 317~394줄
- 319~327줄 UUID path 검증
- 설비→회사→사용자 소유권 확인 유지

### 설비 삭제

- 396~454줄
- 398~406줄 UUID path 검증
- 설비→회사→사용자 소유권 확인 유지

### 검토 포인트

- 비밀번호 변경 후 기존 refresh session을 모두 폐기해야 하는지
- 이메일 변경 확인 메일 흐름이 필요한지
- DB에 `manager_name`, `manager_phone` 컬럼이 실제 존재하는지
- API 응답 status code가 없는 데이터와 서버 오류를 정확히 구분하는지

---

## 20. `app/routers/reports.py`

현재 파일 길이: 72줄

### 변경 라인

- 4~12줄: Request, rate limit, ID 타입 import
- 23~27줄: 보고서 요청 ID 검증
- 30~42줄: 사용자별 분당 PDF 생성 제한
- 51~55줄: 내부 데이터 조회 오류를 일반 404 메시지로 변경

### 계산 로직 영향

- `services/application_report.py` 변경 없음
- PDF 계산·표시 로직 변경 없음

---

## 21. `app/routers/safety.py`

현재 파일 길이: 83줄

### 변경 라인

- 14줄: logging import
- 26줄: logger 생성
- 76~81줄: 내부 예외는 로그에 기록하고 응답에서는 제거

### 계산 로직 영향

- `services/equipment_safety.py` 변경 없음
- `tools/safety_calc.py` 변경 없음

---

## 22. `.env.example` — 신규

현재 파일 길이: 18줄

### 설정 위치

- 1~3줄: API 및 Supabase key 이름
- 6~9줄: 쿠키 설정
- 10줄: 요청 body 최대 크기
- 11~15줄: API rate limit
- 16줄: 허용 프론트 Origin

### 주의

- 실제 secret 값은 없음
- 운영 환경은 `AUTH_COOKIE_SECURE=true`
- 운영 Origin만 정확히 지정해야 함

---

# 변경하지 않은 계산 관련 파일

다음 중요 계산 파일은 현재 Git diff 기준 변경되지 않았습니다.

```text
app/tools/roi_calc.py
app/tools/query_builder.py
app/tools/safety_calc.py
app/services/application_report.py
app/services/equipment_safety.py
app/agents/capex.py
```

`app/routers/chat.py`도 이번 변경에서 수정하지 않았습니다.

---

# 이미 수행한 검증

```text
백엔드 compileall 성공
프론트 production build 성공
로그인 6번째 실패 요청 429 확인
Retry-After 헤더 확인
내부 DB 오류 문구 응답 미노출 확인
1MB 초과 요청 413 확인
잘못된 ID와 injection 형태 ID 422 확인
악성 Origin 요청 403 확인
인증 응답 Cache-Control: no-store 확인
```

---

# ChatGPT가 특히 집중해서 볼 파일

우선순위 1:

```text
app/routers/auth.py
app/core/auth.py
app/core/session.py
app/core/rate_limit.py
app/core/request_limits.py
```

우선순위 2:

```text
app/models/company.py
app/models/equipment.py
app/models/auth.py
app/models/user_profile.py
app/routers/onboarding.py
```

우선순위 3:

```text
app/agents/draft.py
app/agents/policy.py
app/core/llm_security.py
app/routers/analyze.py
app/services/policy_response.py
```

---

# 실제 diff 확인 명령

ChatGPT에 repository 전체를 제공할 수 있는 환경이라면 다음 결과도 함께 전달하는 것이 가장 정확합니다.

```bash
git diff -- backend
git status --short -- backend
```

파일별 확인 예시:

```bash
git diff -- backend/app/routers/auth.py
git diff -- backend/app/routers/analyze.py
git diff -- backend/app/models/equipment.py
```

