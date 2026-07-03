# FactoFit LoginPage split by API/schema contract

## 기준

로그인 페이지는 최종 API/스키마 흐름에서 `auth` 도메인에 해당합니다.

- 로그인은 `loginWithPassword(email, password)` 호출
- 인증 성공 후 `saveAuthSession(session)` 저장
- 회원가입은 별도 `SignupModal`에서 처리
- `/auth/signup`은 `user_profile`까지만 저장하고, 회사 정보는 이후 `/api/onboarding`에서 저장하는 흐름과 분리

즉, LoginPage는 `company`, `equipment`, `roi_output`, `matched_policy`, `draft_result`를 직접 다루지 않습니다.

## 적용 위치

```txt
frontend/src/pages/LoginPage.tsx
frontend/src/features/auth/login/LoginFeature.tsx
frontend/src/features/auth/login/login.contract.ts
frontend/src/features/auth/login/login.api.ts
frontend/src/features/auth/login/login.parts.ts
frontend/src/features/auth/login/hooks/useLoginForm.ts
frontend/src/features/auth/login/components/LoginHeroSection.tsx
frontend/src/features/auth/login/components/LoginFormPanel.tsx
frontend/src/features/auth/login/components/LoginDialogs.tsx
```

## 파일 역할

### pages/LoginPage.tsx
라우팅용 입구 파일입니다.

### LoginFeature.tsx
로그인 화면의 전체 배치와 모달 렌더링을 담당합니다.

### login.contract.ts
로그인 화면에서 쓰는 타입을 모았습니다.

### login.api.ts
기존 `services/auth`의 `loginWithPassword`, `saveAuthSession`을 감싸는 auth API 레이어입니다.

### login.parts.ts
로그인 화면의 카드 데이터, 예비 진단 데이터, 공통 인라인 스타일 상수입니다.

### hooks/useLoginForm.ts
이메일, 비밀번호, 로그인 상태, 모달 상태, 로그인 실행 로직을 관리합니다.

### components/LoginHeroSection.tsx
좌측 브랜드/서비스 설명 영역입니다.

### components/LoginFormPanel.tsx
우측 로그인 입력 카드입니다.

### components/LoginDialogs.tsx
로그인 후 예비 진단 모달과 SSO 모달입니다.

## 확인

```bash
cd frontend
npm run build
```

## 커밋

```bash
git add src/pages/LoginPage.tsx
git add src/features/auth/login
git commit -m "feat: 로그인 페이지 구조 분리"
git push origin feat/임평우-frontend
```
