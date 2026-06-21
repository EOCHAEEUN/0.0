# FactoFit MainPage CSS Split

이 패키지는 `frontend/src/pages/MainPage.css`에 들어있던 긴 CSS를 **메인 페이지 도메인/섹션 기준**으로 분리한 버전입니다.

## 적용 위치

```txt
frontend/src/pages/MainPage.css

frontend/src/features/main/styles/
  00-main-foundation.css
  01-header-hero-why.css
  02-business-dashboard-sections.css
  03-footer-dialog-base.css
  04-responsive-base.css
  05-support-dialog-accordion.css
  06-business-photo-upgrade.css
  07-sustainability-image-upgrade.css
  08-hero-why-video-readability.css
  09-why-dialog-premium.css
  10-services-dialog-premium.css
  11-dashboard-dialog-premium.css
  12-services-dialog-final-fixes.css
  13-hero-arrow-final-fixes.css
```

## 중요

`src/pages/MainPage.css`는 이제 import 전용 입구 파일입니다.

```css
@import "../features/main/styles/00-main-foundation.css";
@import "../features/main/styles/01-header-hero-why.css";
@import "../features/main/styles/02-business-dashboard-sections.css";
@import "../features/main/styles/03-footer-dialog-base.css";
@import "../features/main/styles/04-responsive-base.css";
@import "../features/main/styles/05-support-dialog-accordion.css";
@import "../features/main/styles/06-business-photo-upgrade.css";
@import "../features/main/styles/07-sustainability-image-upgrade.css";
@import "../features/main/styles/08-hero-why-video-readability.css";
@import "../features/main/styles/09-why-dialog-premium.css";
@import "../features/main/styles/10-services-dialog-premium.css";
@import "../features/main/styles/11-dashboard-dialog-premium.css";
@import "../features/main/styles/12-services-dialog-final-fixes.css";
@import "../features/main/styles/13-hero-arrow-final-fixes.css";
```

`MainPage.tsx`에서 기존처럼 아래 import를 유지하면 됩니다.

```tsx
import "./MainPage.css"
```

## 분리 기준

- 공개 랜딩 페이지 영역은 API 직접 호출 없음
- auth / onboarding / analyze / draft API는 로그인 이후 페이지에서 처리
- 메인 페이지는 서비스 소개, 다이얼로그 오픈, 로그인 이동, 뉴스레터 UI만 담당
- CSS는 화면 섹션과 다이얼로그 종류 기준으로 분리
- 원본 CSS 순서를 그대로 유지해서 화면 변경 위험을 줄임

## 확인

```bash
cd frontend
npm run build
```

## 커밋

```bash
git add src/pages/MainPage.css
git add src/features/main/styles
git commit -m "feat: 메인 페이지 CSS 구조 분리"
git push origin feat/임평우-frontend
```
