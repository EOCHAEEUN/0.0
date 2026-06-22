# Backend 인증·보안 변경 정리

작성일: 2026-06-22

## 범위

- 수정 파일: 15개
- 신규 파일: 7개
- `/chat` 라우터는 요청에 따라 수정하지 않음
- ROI 계산 공식, 안전점수 계산 공식, 정책 검색·랭킹 공식은 수정하지 않음

## 계산 로직 영향 요약

| 구분 | 영향 |
|---|---|
| `app/tools/roi_calc.py` | 변경 없음 |
| `app/tools/query_builder.py` | 변경 없음 |
| `app/tools/safety_calc.py` | 변경 없음 |
| 정책 후보 검색·병합·ROI 재정렬 공식 | 변경 없음 |
| 정책 최종 화면 점수 보정 공식 | 변경 없음 |
| `analyze.py` 응답 형태 | 화면 호환용 매핑 함수로 분리 |
| 신청서 LLM 출력 | 프롬프트 인젝션 방어 문구 추가로 표현이 달라질 가능성 있음 |
| 정책 LLM 재평가 | 비신뢰 데이터 지시문만 추가, 점수 혼합 공식은 변경 없음 |
| 입력 허용 범위 | 비정상적으로 큰 숫자와 긴 문자열은 422로 거부 |

---

## 수정 파일

### `app/agents/draft.py`

변경 목적: 신청서 생성 프롬프트 인젝션 방어.

- 회사·설비·정책·ROI 값을 LLM이 따라야 할 명령이 아닌 분석 데이터로 취급하도록 시스템 지시 추가
- 정책과 ROI 객체를 JSON 문자열로 직렬화한 뒤 프롬프트에 삽입
- 기존 사용자 질의 문자열 대신 고정된 신청서 생성 요청을 `HumanMessage`로 전달

계산 영향:

- ROI 값이나 지원금 계산은 변경하지 않음
- LLM이 만드는 신청서 문장의 표현과 JSON 응답 안정성에는 영향이 있을 수 있음

### `app/agents/policy.py`

변경 목적: 정책 후보 데이터에 포함될 수 있는 프롬프트 인젝션 방어.

- LLM 최종 재평가 프롬프트 앞에 비신뢰 데이터 처리 지시문 추가

계산 영향:

- 후보 검색, 벡터 거리, ROI 재정렬, 하이브리드 점수 계산은 변경하지 않음
- LLM 평가 결과는 보안 지시문 영향으로 일부 달라질 가능성이 있음

### `app/core/auth.py`

변경 목적: HttpOnly 쿠키 인증 및 CSRF 방어.

- 기존 Bearer 토큰 인증 유지
- `factofit_access` HttpOnly 쿠키 인증 추가
- 쿠키 인증을 사용하는 변경 요청은 `Origin`을 검사
- 허용되지 않거나 Origin이 없는 변경 요청은 403
- 인증 사용자 조회 시 요청별 Supabase 클라이언트 사용

계산 영향: 없음.

### `app/core/config.py`

변경 목적: 인증·쿠키·요청 제한 설정을 환경변수로 관리.

추가 설정:

- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAMESITE`
- `AUTH_ACCESS_COOKIE_MAX_AGE`
- `AUTH_REFRESH_COOKIE_MAX_AGE`
- `MAX_REQUEST_BODY_BYTES`
- 인증 API별 분당 요청 제한
- 분석·신청서·PDF 분당 요청 제한
- `FRONTEND_ORIGINS`

계산 영향: 없음.

### `app/main.py`

변경 목적: 전역 HTTP 보안 설정.

- 요청 본문 최대 크기 미들웨어 등록
- CORS origin을 환경변수로 관리
- 허용 method/header를 필요한 범위로 축소
- 다음 보안 헤더 추가:
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Content-Security-Policy`
  - 운영 HTTPS 환경의 HSTS
- 인증 API 응답에 `Cache-Control: no-store`

계산 영향: 없음.

### `app/models/auth.py`

변경 목적: 인증 입력값 검증 강화.

- 이메일, 비밀번호, 이름, 전화번호 길이 제한
- 이메일·전화번호·인증 코드 형식 검증
- 알 수 없는 추가 JSON 필드 거부
- 문자열 앞뒤 공백 자동 제거
- 매출·직원 수 상한값 추가

계산 영향:

- 인증 계산 없음
- 기존에 허용되던 비정상적으로 긴 입력은 422로 거부

### `app/models/company.py`

변경 목적: 회사 입력값 검증 및 대량·비정상 값 차단.

- 회사명, 업종명, 지역, 사업장 유형 등 길이 제한
- 업종코드·주요 목적 배열 개수 제한
- 직원 수, 매출, 자산 값 상한 추가
- 알 수 없는 추가 필드 거부
- `CompanyContext`는 DB 조회 결과 호환을 위해 추가 필드 무시 유지

계산 영향:

- 3개년 평균매출 계산 메서드는 변경하지 않음
- 비정상적으로 큰 숫자는 계산 전에 422로 차단

### `app/models/equipment.py`

변경 목적: 설비 입력값 검증 및 계산 오버플로·비정상 입력 방지.

- 설비명, 카테고리, 공정 길이 제한
- 사용연수 최대 200년
- 비용·생산량·투자금 등 수치 상한 추가
- 알 수 없는 추가 필드 거부

계산 영향:

- ROI 공식은 변경하지 않음
- 계산 함수에 전달되기 전 입력 허용 범위만 제한

### `app/models/user_profile.py`

변경 목적: 프로필·계정 변경 입력 검증.

- 이름, 전화번호, 이메일 길이·형식 제한
- 현재 비밀번호 필드 추가
- 새 비밀번호 8~128자 제한
- 담당자 정보 길이 제한
- 알 수 없는 추가 필드 거부

계산 영향: 없음.

### `app/routers/analyze.py`

변경 목적: 프론트 정책 응답 호환, ID 검증, 비용성 API 제한.

- 회사·설비 ID를 UUID 형식으로 검증
- 사용자별 분당 분석 요청 제한
- 정책 응답 매핑을 `services/policy_response.py`로 분리
- `matched_policies`, `policies`, `raw_candidates`를 같은 화면 응답 규칙으로 정규화

계산 영향:

- `calculate_roi()` 호출과 ROI 계산 공식은 변경하지 않음
- 정책 후보 검색·병합·재정렬·점수 보정 코드는 변경하지 않음
- DB에 저장하는 `roi_output`, `matched_policy` 구조는 변경하지 않음
- API로 반환되는 정책 필드 이름과 fallback 값만 정규화

### `app/routers/auth.py`

변경 목적: 쿠키 세션 인증과 무차별 인증 방어.

- access/refresh token을 응답 JSON에서 제거
- HttpOnly access/refresh 쿠키 발급
- 추가 API:
  - `GET /api/auth/session`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- refresh token 회전 및 쿠키 갱신
- 로그인, 이메일 코드 발송·검증, refresh에 rate limit 적용
- IP+계정 및 계정 전체 기준 로그인 제한
- 내부 Supabase/DB 예외 내용을 응답에서 제거
- 인증 관련 POST 요청의 Origin 검사

계산 영향: 없음.

### `app/routers/draft.py`

변경 목적: 신청서 생성 요청 검증과 비용 남용 방지.

- 회사·설비 ID UUID 검증
- 정책 ID 허용 문자와 길이 검증
- 사용자별 분당 요청 제한

계산 영향:

- 신청서 시나리오 선택 로직은 변경하지 않음
- ROI 결과·TOP 5 정책 조회 및 저장 로직은 변경하지 않음

### `app/routers/onboarding.py`

변경 목적: 계정 변경 보호, ID 검증, 오류 은닉.

- 회사·설비 path ID UUID 검증
- 이메일 또는 비밀번호 변경 시 현재 비밀번호 재인증
- 담당자명·담당자 연락처 업데이트 반영
- DB/Supabase 내부 오류 문자열을 응답에서 제거
- 상세 오류는 서버 로그에만 기록

계산 영향:

- 설비 카테고리 정규화 로직은 변경하지 않음
- 회사·설비 저장 데이터의 계산이나 변환 공식은 변경하지 않음

### `app/routers/reports.py`

변경 목적: PDF 생성 요청 검증과 비용 남용 방지.

- 회사·설비 UUID 검증
- 정책 ID 형식 검증
- 사용자별 분당 PDF 생성 제한
- 보고서 데이터 조회 실패 시 내부 상세 메시지 숨김

계산 영향:

- PDF 내부 ROI·지원금·회수기간 계산 및 매핑 로직은 변경하지 않음

### `app/routers/safety.py`

변경 목적: 내부 예외 노출 방지.

- 상세 예외는 서버 로그에 기록
- 사용자 응답에서는 DB 오류 내용 제거

계산 영향:

- 안전점수와 점검 우선순위 계산 로직 변경 없음

---

## 신규 파일

### `.env.example`

운영·개발 환경변수 예시.

- Supabase 및 AI 키 자리
- 쿠키 보안 설정
- 요청 크기 제한
- API별 rate limit
- 허용 프론트 Origin

### `app/core/session.py`

HttpOnly access/refresh 쿠키 생성 및 삭제 함수.

### `app/core/rate_limit.py`

단일 백엔드 프로세스용 메모리 rate limiter.

- IP+식별자 기반 제한
- 계정 전체 기반 제한 지원
- `Retry-After` 헤더 반환
- 메모리 버킷 최대 개수 제한

주의:

- 서버 여러 대 운영 시 Redis 기반으로 교체 필요

### `app/core/request_limits.py`

요청 본문 최대 크기 제한 ASGI 미들웨어.

- 기본 1MB 초과 시 413 반환
- `Content-Length` 유무와 관계없이 실제 수신 크기 검사

### `app/core/llm_security.py`

LLM에 전달되는 회사·설비·정책·ROI 데이터를 비신뢰 데이터로 구분하는 지시문과 JSON 직렬화 함수.

### `app/models/validated_types.py`

공통 ID 검증 타입.

- UUID 문자열
- 정책 ID 허용 문자·길이

### `app/services/policy_response.py`

`analyze.py`에서 분리한 프론트 정책 응답 매핑.

- 정책 ID·제목·기관·마감일·지원금·설명·카테고리 정규화
- 중첩 `metadata`와 평면 필드를 모두 지원
- 화면이 사용하는 필드 구조로 통일

계산 영향:

- 정책 순위와 점수는 새로 계산하지 않음
- 기존 점수와 원본 값을 화면 응답 구조로 변환만 수행

---

## 변경하지 않은 중요 영역

- `app/tools/roi_calc.py`
- `app/tools/query_builder.py`
- `app/tools/safety_calc.py`
- `app/services/application_report.py`
- `app/services/equipment_safety.py`
- `app/agents/capex.py`
- `app/routers/chat.py`
- DB 마이그레이션

## 검증 결과

- 백엔드 전체 `compileall` 성공
- 프론트 production build 성공
- 로그인 6번째 시도 429 확인
- 내부 DB 예외 응답 미노출 확인
- 1MB 초과 요청 413 확인
- 잘못된 ID 및 주입 형태 ID 422 확인
- 악성 Origin 요청 403 확인
- 인증 응답 `Cache-Control: no-store` 확인

## 리뷰 우선순위

1. `app/models/equipment.py`: 실제 운영에서 허용할 수치 상한 확인
2. `app/models/company.py`: 매출·자산·직원 수 상한 확인
3. `app/agents/draft.py`: 신청서 LLM 결과 회귀 테스트
4. `app/agents/policy.py`: 정책 LLM 점수 회귀 테스트
5. `app/services/policy_response.py`: 프론트 정책 상세 필드 확인
6. `app/routers/auth.py`: 쿠키·refresh·logout 통합 테스트

