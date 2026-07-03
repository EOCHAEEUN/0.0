# 05_Phase5_Regression_QA_Ultra
## Cursor에 그대로 붙여넣기

# FactoFit Design QA Phase 5 — Regression QA
## 코드 수정 금지 / 검증 전용

현재 단계는 Phase 5입니다. Phase 4 Stage별 구현이 끝난 뒤 최종 Regression QA만 수행하세요.

절대 코드를 수정하지 마세요. 절대 CSS/TSX를 수정하지 마세요. 검증 중 발견된 문제를 즉시 고치지 마세요. 문제는 Regression Issue Report로만 작성하세요.

## 1. 검증 목적
로그인 전 페이지, API, 상태관리, 라우팅, localStorage, 문구, UX 흐름, 신규 디자인, 신규 hex/radius/breakpoint 변경 없음. Visual consistency 향상. 기능 regression 없음.

## 2. 검증 페이지
Dashboard, ROI, Support Projects, Equipment, MyPage, Application Draft, AI Advisor, Safety, Company 또는 기타 로그인 후 workspace page.

## 3. Viewport 기준
Desktop 1440x900, Laptop 1366x768, Mobile 390px, 필요 시 Tablet 768/820px.

## 4. Visual Regression Checklist
각 페이지마다 H1/subtitle/Hero/first card 위치, page padding, max-width, button height/radius/color, card radius/shadow/border, form height/focus, badge size/tone, icon alignment, section spacing, vertical rhythm, responsive layout, hover/active/disabled/loading, drawer/modal/accordion, sidebar collapse, mobile scroll를 확인하세요.

## 5. Protected Exception Validation
AI Advisor dark/gold/100vh, chat bubble, ROI hero, KPI DM Mono, chart colors, Draft dark badge, Workspace highlight blue, page-specific breakpoint, Support Policy Drawer 수치 추정 없음, Equipment drawer, Legacy CTA, Equipment emphasis CTA 보존 확인.

## 6. Functional Smoke Test
Sidebar, Dashboard CTA, ROI tabs/CTA, Support filter/card/detail/drawer, Equipment form/drawer/list, MyPage input/select/validation/save, Application Draft 상태별 화면, AI Advisor session/composer/message, Safety CTA, Drawer/Modal/Accordion, keyboard tab focus, disabled 상태.

## 7. Git Diff Audit
로그인 전 파일/API/state/routing/localStorage 변경 없음, TSX 구조 변경 없음, 신규 component 없음, 신규 hex/px/radius/breakpoint 없음, high-risk 파일 stage별 분리 확인.

## 8. Build / Typecheck
npm run build, baseline 대비 신규 오류 없음, 기존 baseline 오류와 신규 오류 구분, 디자인 QA와 무관한 TS 오류 임의 수정 없음.

## 9. 출력 형식
1. Executive Summary
2. Pages Tested
3. Viewports Tested
4. Visual Regression Result Table
5. Functional Smoke Test Result
6. Protected Exception Validation
7. Git Diff Audit
8. Build Result
9. Remaining Issues
10. Must Fix Before Final
11. Can Defer
12. Final Decision: PASS / PASS WITH MINOR ISSUES / HOLD / FAIL

## 10. Final Instruction
현재 단계에서는 절대 코드를 수정하지 마세요. 출력은 오직 Regression QA Report만 작성하세요. 문제가 발견되면 수정하지 말고 별도 hotfix 후보로 분리하세요.
