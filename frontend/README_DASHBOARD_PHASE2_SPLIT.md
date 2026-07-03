# FactoFit Dashboard 2차 쪼개기

## 기준

최신 API/스키마 기준의 대시보드 데이터 흐름은 다음과 같습니다.

1. `GET /api/onboarding/me`
   - `user_profile`
   - `company`
   - `equipments`
2. `localStorage.factofit_analysis_result`
   - `roi_output.roi_data`
   - `matched_policies`
   - `draft_result`
3. Dashboard 화면용 ViewModel 변환
   - KPI
   - 기업정보 요약
   - 설비현황 요약
   - 지원사업 매칭 플로우
   - 추천 근거
   - D-DAY 목록

## 적용 위치

```txt
frontend/src/pages/DashboardPage.tsx
frontend/src/features/dashboard/DashboardFeature.tsx
frontend/src/features/dashboard/dashboard.parts.ts
frontend/src/features/dashboard/dashboard.contract.ts
frontend/src/features/dashboard/dashboard.api.ts
frontend/src/features/dashboard/hooks/useDashboardData.ts
frontend/src/features/dashboard/hooks/useDashboardPanels.ts
frontend/src/features/dashboard/mappers/dashboardMapper.ts
frontend/src/features/dashboard/components/DashboardHeroSection.tsx
frontend/src/features/dashboard/components/PolicyMatchingSection.tsx
frontend/src/features/dashboard/components/ServiceShortcutSection.tsx
```

## 2차에서 바뀐 점

### 1. 상태 관리 분리

`useDashboardPanels.ts`로 패널/hover/더보기 상태를 분리했습니다.

### 2. API 데이터 로딩 분리

`useDashboardData.ts`에서 `/api/onboarding/me`와 `localStorage.factofit_analysis_result`를 읽습니다.

### 3. 스키마 → 화면 데이터 매핑 분리

`dashboardMapper.ts`에서 `company`, `equipment`, `roi_output`, `matched_policy`, `draft_result`를 Dashboard 화면용 데이터로 변환합니다.

### 4. 화면 블록 분리

- `DashboardHeroSection.tsx`: 상단 네이비 요약 + KPI
- `PolicyMatchingSection.tsx`: 지원사업 매칭 현황 + 추천요약 + 추천근거 + D-DAY
- `ServiceShortcutSection.tsx`: 서비스 바로가기

## 확인

```bash
cd frontend
npm run build
```

## 커밋

```bash
git add src/pages/DashboardPage.tsx
git add src/features/dashboard

git commit -m "feat: 대시보드 2차 구조 분리"
git push origin feat/임평우-frontend
```
