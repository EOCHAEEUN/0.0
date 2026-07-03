# 02_Phase2_Design_Token_Specification_Ultra
## Cursor에 그대로 붙여넣기

# FactoFit Design QA Phase 2 — Design Token Specification Prompt
## Phase 1 QA Report 기반 / 로그인 이후 서비스 화면 전용 / 코드 수정 금지

당신은 Senior Design System Architect + Senior Frontend UI Systems Engineer + Design Token Auditor 역할을 수행합니다.

현재 단계는 Phase 2입니다. 목적은 Phase 1 Design QA Report를 기반으로 FactoFit 로그인 이후 서비스 화면 전용 Design Token 기준표를 작성하는 것입니다.

아직 코드를 수정하지 마세요. 파일을 변경하지 마세요. 리팩터링하지 마세요. 새로운 디자인을 제안하지 마세요. CSS/TSX 수정 예시 코드를 작성하지 마세요.

## 1. 입력 기준
반드시 Phase 1 Design QA Report를 먼저 읽고 요약하세요. 다음 3가지를 먼저 출력하세요.
1. Phase 1에서 확인된 실제 불일치 요약
2. Phase 1에서 확인된 UI Inventory 요약
3. Phase 1에서 제안된 Recommended Token Candidates 요약
그 다음 공식 Design Token 기준표를 작성하세요. Phase 1에 근거가 없는 기준은 만들지 마세요.

## 2. 작업 범위
대상: 로그인 이후 서비스 화면, Workspace Layout, Sidebar, Dashboard, ROI, Support Projects, Equipment, MyPage, Company, Safety, Application Draft, 로그인 후 AI Advisor, 로그인 후 공통 Button/Card/Form/Badge/Drawer/Modal.

제외: Landing/Intro, Login/Signup, SignupModal/SignupForm, Email Verification, Password Reset, Welcome/Setup, 비로그인 AI Advisor, 인증 전 접근 화면, 로그인 전 컴포넌트/CSS.

## 3. 절대 금지
UX 흐름, 화면 구조, 정보 구조, 메뉴 구조, 카드 순서, 버튼 위치, 문구, 기능 로직, API, 상태관리, 라우팅, localStorage, 백엔드 연동, 데이터 필드명, 로그인 전 페이지 기준값을 변경 대상으로 삼지 마세요.

## 4. 기준 설정 원칙
현재 프로젝트에서 가장 많이 쓰이고 안정적인 값을 기준으로 삼으세요. 새로운 색상/폰트/radius/spacing/breakpoint를 임의로 만들지 마세요. 값이 여러 개일 경우 FactoFit 톤앤매너에 맞고 로그인 이후 화면에서 많이 사용된 값을 기준 후보로 제안하세요. 8pt Grid를 우선 기준으로 하되 기존 화면을 크게 바꾸지 않는 범위에서만 정규화 기준을 제안하세요. AI Advisor, KPI, Chart, Dark Hero, Draft Dark Badge 등 예외는 일반 토큰으로 강제 통합하지 마세요.

## 5. 정의할 Token 항목
다음 18개 항목을 모두 정의하세요.

1) Token Source Summary: 기준값 출처, 많이 쓰인 값, 제거할 값, 예외값.
2) Page Scaffold Token: max-width, padding, sidebar gap, H1/subtitle/Hero/first-card gap, desktop/tablet/mobile, sidebar width/collapse, full/wide/form-heavy page.
3) Typography Scale: body/label/numeric font, H1/H2/H3/section/card/body/caption/tiny/number/button/badge, size/weight/line-height/letter-spacing. KPI와 Hero는 별도.
4) Color Token: navy/blue/hover/bg/workspace/card/surface/border/text/status/focus/chart/highlight. 신규 hex 금지.
5) Spacing Token: 4/8/12/16/20/24/32/40/48/64 및 10/14/18/22/26/28/30 예외 처리.
6) Radius Token: small/control/card/section/highlight/large/modal/pill/input/button/hero.
7) Border Token: default/strong/selected/focus/tinted/divider/table/input/card.
8) Shadow/Elevation Token: none/card/elevated/deep/modal/drawer/hover.
9) Button Standard: workspace primary/secondary/outline/ghost/compact/icon/global legacy/equipment emphasis/disabled/loading.
10) Card/Surface Standard: default/section/form-analysis/priority/nested/large/empty/modal-drawer.
11) Form Standard: standard/dense/legacy field, input/select/textarea/check/radio/switch/label/helper/error/focus/disabled.
12) Badge/Status Standard: default/recommendation/ROI/D-Day/priority/success/warning/error/info/pending/completed/draft primary/compact/dark/bright.
13) Navigation/Sidebar Standard: width/padding/brand/main/sub/footer nav/active/hover/icon/collapse/mobile.
14) Drawer/Modal Standard: side/wide/mobile bottom drawer, overlay/header/body/footer/close/radius/shadow/z-index/responsive. Support Policy Drawer 수치 추정 금지.
15) Icon/Emoji/Illustration Standard: sizes, nav/button/card/status/hero/emoji/Engi/stroke/gap/optical alignment.
16) Interaction/Motion Standard: hover/active/focus/selected/disabled/loading/expanded/collapsed/error/empty/transition/accordion/modal/tooltip/skeleton.
17) Responsive/PWA Standard: desktop/laptop/tablet/mobile/PWA, breakpoint, mobile padding, 1열 전환, button full-width, sidebar collapse, scroll.
18) Special Exceptions — Do Not Normalize: AI Advisor dark/gold/full workspace, chat bubble, dark hero, KPI, chart, page hero, ROI hero, draft dark badges, workspace highlight blue, page-specific collapse, Support Policy Drawer, legacy CTA, equipment CTA, tinted nested panel.

## 6. Token Integrity Rules
토큰 밖 임의값, text-[31px], rounded-[19px], p-[23px], 중복 hex/shadow/border, hard-coded value, !important, 공통 컴포넌트 우선 적용, 예외 whitelist 기준을 정의하세요.

## 7. 출력 형식
Markdown으로 작성하세요.
1. Executive Summary
2. Phase 1 Evidence Summary
3. Official Design Token Table: Token Category, Name, Value, Usage, Current Variants, Reason, Priority, Exception, 주의사항
4. Component Standard Table: Component, Variant, Size, Padding, Radius, Border, Shadow, Typography, Color, State, Usage, Exceptions
5. Page Scaffold Standard
6. Responsive Standard
7. Special Exceptions — Do Not Normalize
8. Token Integrity Rules
9. Safe Application Strategy: 중앙 token alias → Workspace Button → Form → Card → Badge → Scaffold → High-risk → Regression QA

## 8. Final Instruction
현재 단계에서는 절대 코드를 수정하지 마세요. 출력은 Design Token Specification / Handoff만 작성하세요. 실제 수정 계획은 Phase 3, 구현은 Phase 4에서 진행합니다.
