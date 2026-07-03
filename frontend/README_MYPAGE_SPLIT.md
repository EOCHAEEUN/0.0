# FactoFit MyPage Split

## 기준

이번 쪼개기는 `factofit_api_spec_v3_local.md` / `factofit_schema_spec_v4_local.md` 기준으로,
마이페이지가 다루는 도메인을 `user_profile`, `company`, `equipment`, `analyze` 흐름으로 분리했습니다.

## 적용 경로

```txt
frontend/src/pages/MyPage.tsx
frontend/src/features/mypage/MyPageFeature.tsx
frontend/src/features/mypage/myPage.parts.tsx
```

## 구조

```txt
src/pages/
  MyPage.tsx
    - 라우팅용 얇은 wrapper
    - 실제 화면 로직은 feature로 위임

src/features/mypage/
  MyPageFeature.tsx
    - 기존 MyPage 화면 상태와 JSX
    - 저장하기 / 분석하기 흐름 유지
    - AppHeader 포함

  myPage.parts.tsx
    - API payload 타입
    - API 호출 함수
    - localStorage/auth 유틸
    - number/format 변환 유틸
    - Field, SelectField, AccordionPanel 등 화면 부품
    - MyPage에서 쓰는 상수
```

## API/스키마 매핑

```txt
PATCH /api/user-profile/me
  -> UserProfilePayload
  -> user_profile.name, user_profile.phone

POST /api/onboarding
  -> CompanyOnboardingPayload
  -> company 단일 row 저장/upsert

POST /api/onboarding/{company_id}/equipment
  -> EquipmentPayload
  -> equipment 저장

GET /api/onboarding/me
  -> 마이페이지 초기 조회

POST /api/analyze?company_id=...&equipment_id=...
  -> ROI 계산 + 정책 추천
  -> localStorage.factofit_analysis_result 저장
```

## 주의

- `company_size`는 사용하지 않고 `company_type`을 사용합니다.
- `roi_input`은 사용하지 않습니다. ROI 입력은 `company + equipment` 저장값 기준입니다.
- `/api/analyze`는 draft를 생성하지 않습니다. draft는 `/api/draft` 흐름입니다.
- 이번 파일은 기존 UI를 최대한 유지하는 1차 안전 쪼개기입니다.
