# DashboardPage split guide

## 목적

`DashboardPage.tsx`에 섞여 있던 타입, 하드코딩 데이터, 스타일 유틸, 화면 컴포넌트를 분리했습니다.

최종 API/스키마 기준으로 대시보드는 아래 흐름을 읽는 화면입니다.

1. `GET /api/onboarding/me` → `user_profile + company + equipments`
2. `localStorage.factofit_analysis_result` 또는 추후 결과 조회 API → `roi_output + matched_policy + draft_result`
3. 화면 표시 → KPI, 기업정보, 설비현황, 추천 근거, 서비스 바로가기

## 적용 위치

```txt
frontend/src/pages/DashboardPage.tsx
frontend/src/features/dashboard/DashboardFeature.tsx
frontend/src/features/dashboard/dashboard.parts.ts
frontend/src/features/dashboard/dashboard.contract.ts
frontend/src/features/dashboard/dashboard.api.ts
```

## 파일 설명

- `pages/DashboardPage.tsx`: 라우팅용 얇은 wrapper
- `features/dashboard/DashboardFeature.tsx`: 기존 대시보드 화면 JSX와 상태 관리
- `features/dashboard/dashboard.parts.ts`: 화면 타입, fallback 데이터, tone/style 유틸
- `features/dashboard/dashboard.contract.ts`: 최종 API/스키마 응답 타입 기준
- `features/dashboard/dashboard.api.ts`: `/api/onboarding/me`, `factofit_analysis_result` 접근 함수

이번 1차 쪼개기는 화면 깨짐을 막기 위해 기존 UX/UI와 하드코딩 fallback은 유지했습니다. 다음 단계에서 `dashboard.api.ts`와 `dashboard.contract.ts`를 `DashboardFeature.tsx`에 연결하면 됩니다.
