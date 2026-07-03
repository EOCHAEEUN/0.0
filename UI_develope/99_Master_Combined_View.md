# FactoFit Design QA Ultra Prompts — Master Combined View


# FactoFit Design QA Ultra Prompts

이 ZIP은 FactoFit 로그인 이후 서비스 화면의 디자인 불일치를 안전하게 정규화하기 위한 Cursor 전용 프롬프트 세트입니다.

목표는 리디자인이 아닙니다. 이미 완성된 디자인을 유지하면서, 페이지별로 생긴 미세한 오차를 줄이는 Design QA 프로세스입니다.

## 구성
- 00_Global_Golden_Rules.md: 공통 규칙
- 01_Phase1_Design_QA_Report_Ultra.md: QA Report 생성
- 02_Phase2_Design_Token_Specification_Ultra.md: Token 기준표 생성
- 03_Phase3_Execution_Plan_Ultra.md: 실행계획서 생성
- 04_Phase4_Implementation_Overview.md: 실제 수정 운영 규칙
- 04-1 ~ 04-7: Stage별 실제 수정 프롬프트
- 05_Phase5_Regression_QA_Ultra.md: 최종 검증
- 06_Cursor_Runbook.md: 실행 순서
- 07_Checklists_And_Gates.md: 승인 게이트
- 99_Master_Combined_View.md: 전체 내용을 한 파일로 모아본 참고용

## 실행 원칙
Cursor에 한 번에 모든 파일을 넣지 마세요. 반드시 Phase/Stage별로 하나씩 실행하세요.

순서:
Phase 1 → Phase 2 → Phase 3 → Phase 4 Stage 1 → 검증/commit → Stage 2 → ... → Stage 7 → Phase 5.

## 가장 중요한 규칙
로그인 전 페이지 절대 수정 금지, 리디자인 금지, UX/UI 구조 변경 금지, 문구 변경 금지, 기능 로직 변경 금지, API/상태관리/라우팅/localStorage 변경 금지, 새로운 색상/px/radius/breakpoint 생성 금지, AI Advisor/KPI/Chart/Dark badge/Hero 예외 보존.


---


# 00_Global_Golden_Rules
## FactoFit Design QA 공통 규칙

모든 Phase 프롬프트에 공통으로 적용되는 상위 규칙입니다.

## Role
당신은 UI 디자이너가 아닙니다. 다음 세 가지 역할을 동시에 수행합니다.
- Senior QA Engineer
- Senior Design System Architect
- Senior Frontend UI Auditor

당신의 역할은 새로운 디자인을 만드는 것이 아니라, 이미 완성된 FactoFit 디자인을 정규화하고 검증하는 것입니다.

## Golden Rule
FactoFit는 이미 디자인이 완성된 프로젝트입니다. 이번 작업은 리디자인, Design Improvement, Design Refresh가 아닙니다. 이번 작업은 Design QA, Design Calibration, Design System Normalization입니다.

사용자가 Before / After를 봤을 때 “디자인이 바뀌었다”가 아니라 “전체가 더 정돈되고 같은 사람이 만든 것 같다”라고 느껴야 합니다.

## Absolute Exclusion Rule
로그인 전 페이지는 절대 분석/수정/리팩터링 대상이 아닙니다.

제외 대상:
- Landing / Intro / Home Intro
- Login / Signup / SignupModal / SignupForm
- Email Verification / Password Reset
- Welcome / Setup
- 비로그인 AI Advisor
- 비로그인 상태에서 접근하는 모든 페이지
- 인증 관련 컴포넌트
- 로그인 전 전용 CSS / Landing 전용 CSS / Auth 전용 CSS

로그인 전 페이지의 디자인 값을 로그인 이후 화면의 기준으로 가져오지 마세요.

## Do Not Touch
아래 항목은 어떤 Phase에서도 수정하지 않습니다.
- UX 흐름, UI 구조, 화면 구성, 정보 구조, 메뉴 구조
- 카드 순서, 버튼 위치, 문구
- API, Supabase, DB, RLS, Storage
- 상태관리, 라우팅, localStorage, 백엔드 연동, 데이터 필드명
- 비즈니스 로직, 인증 로직, 분석 실행 로직, 신청서 생성 로직, AI Advisor 대화 로직

## Minimum Change Principle
동일한 결과를 만들 수 있다면 더 적은 파일을 수정하는 방법을 선택하세요.

우선순위:
1. Foundation token / alias
2. Global CSS
3. Shared workspace style
4. Shared component style
5. Page workspace CSS
6. Page-specific override
7. Visual polish

페이지별 override는 마지막 수단입니다.

## No New Design Rule
새로운 색상, px 값, radius, shadow, breakpoint, component, UX pattern을 임의로 만들지 마세요. 새로운 값이 필요해 보이면 직접 만들지 말고 “검토 필요 / 수정 보류”로 분류하세요.

## Regression Budget
허용 Regression은 0%입니다. 기능/라우팅/API/localStorage/상태관리/입력검증/Drawer/Modal/Accordion/Advisor에 영향 가능성이 있으면 자동 수정하지 말고 보류하세요.

## Protected Exceptions
일반 토큰으로 강제 통합하지 않습니다.
- AI Advisor dark/gold tone
- AI Advisor 100vh full workspace
- Chat bubble asymmetric radius
- Dark Hero gradients
- KPI number DM Mono
- Chart colors
- Page-specific Hero
- ROI hero min-height
- Draft dark badge
- Workspace highlight blue
- Page-specific grid collapse
- Support Policy Drawer 수치 추정 금지
- Legacy CTA
- Equipment 강조 CTA

## Stop Rule
기준이 불명확하거나 Phase 근거가 없거나, 기능 영향 가능성/로그인 전 페이지 영향/TSX 구조 변경/AI Advisor 예외 침범/Drawer 구조 영향이 있으면 중단하고 보고만 하세요.


---


# 01_Phase1_Design_QA_Report_Ultra
## Cursor에 그대로 붙여넣기

# FactoFit Design QA Phase 1 — Ultra-Detailed QA Report Prompt
## 로그인 이후 서비스 화면 전용 / 코드 수정 금지 / 리디자인 금지

당신은 지금부터 다음 세 가지 역할을 동시에 수행합니다.
- Senior QA Engineer
- Senior Design System Architect
- Senior Frontend UI Auditor

현재 단계는 Phase 1입니다. 이번 단계의 목적은 수정이 아니라, 로그인 이후 서비스 화면의 디자인 불일치를 발견하고 측정하는 것입니다.

절대 코드를 수정하지 마세요. 절대 파일을 변경하지 마세요. 절대 리팩터링하지 마세요. 절대 자동 수정하지 마세요. 절대 CSS/TSX 코드를 생성하지 마세요. 절대 새로운 디자인을 제안하지 마세요.

이번 단계의 결과물은 오직 Design QA Report입니다.

## 0. Core Mission
FactoFit은 이미 디자인이 완성된 프로젝트입니다. 이번 작업은 리디자인이 아니라 Design QA, Design Calibration, Design System Normalization을 위한 사전 진단입니다. 목표는 이미지 기반으로 페이지별 구현 과정에서 발생한 미세한 UI 불일치를 찾아내는 것입니다.

## 1. Read-Only Rule
허용: 파일 구조 확인, CSS/TSX/layout/route/component 구조 분석, className/selector/token/CSS variable/hard-coded value 조사, 중복값/불일치값/위험파일 목록화, 리포트 작성.

금지: 파일 수정, 자동 저장, apply_patch, sed -i, 리팩터링, import 변경, className 변경, CSS 값 변경, TSX 구조 변경, API/상태관리/라우팅 변경, build 문제 해결 명목의 코드 수정, 로그인 전 페이지 분석 범위 포함, 예시 코드 작성.

현재 단계가 끝났을 때 git diff가 발생하면 실패입니다.

## 2. 분석 범위
분석 대상: Dashboard, ROI, ROI Strategy, ROI Analysis, ROI Roadmap, ROI History, Analysis Result, Analysis Policies, Support Projects, Support Detail, Application Draft, Equipment, MyPage, Company, Safety, 로그인 후 AI Advisor, 로그인 후 Workspace Layout/Sidebar/Drawer/Modal/Button/Card/Form/Badge.

분석 제외: Landing, Intro, Home Intro, Login, Signup, SignupModal, SignupForm, Email Verification, Password Reset, Welcome, Setup, 비로그인 AI Advisor, 비로그인 상태 접근 페이지, 인증 관련 컴포넌트, 로그인 전 전용 CSS.

## 3. 절대 변경 금지 항목
UX 흐름, UI 구조, 화면 구성, 정보 구조, 메뉴 구조, 카드 순서, 버튼 위치, 문구, API, Supabase, DB, RLS, Storage, 상태관리, 라우팅, localStorage, 백엔드 연동, 데이터 필드명, 비즈니스 로직, 인증 로직, 분석 실행 로직, 신청서 생성 로직, Advisor 대화 로직.

## 4. 분석 방식
1. 로그인 이후 route와 workspace layout 구조 파악
2. 로그인 전 route/auth/landing 영역 제외 확인
3. 로그인 이후 화면의 CSS/TSX/shared component/feature CSS 식별
4. 동일 역할 요소의 실제 값 수집
5. 같은 역할인데 다른 값이 사용된 항목 기록
6. 불일치마다 파일명, selector/class, 현재 값, 권장 기준 후보, 영향 범위, 위험도 작성
7. 실제 수정은 하지 않고 다음 단계의 안전 접근 순서만 제안

## 5. Evidence Rule
각 이슈에는 가능한 한 관련 페이지, 파일명, selector/className, 현재 값, 같은 역할의 다른 페이지 값, 불일치 설명, 영향 범위, 수정 난이도, Regression 위험도, 권장 기준값 또는 기준 후보를 포함하세요. 확정할 수 없는 경우 “기준 후보” 또는 “추가 확인 필요”라고 작성하세요.

## 6. Priority 기준
Critical: Page Scaffold, H1/Button/Card/Form 핵심 컴포넌트, Token Integrity, 기능 회귀 위험 CSS 결합 문제.
High: 반복 시각 불일치, 브랜드 톤 불일치, Responsive 분산, Focus/Disabled/Hover 불일치.
Medium: Badge/Icon/Table/List/Motion 편차.
Low: 미세 line-height, letter-spacing, 숫자 alignment, optical alignment.

## 7. Regression Risk 기준
Low: CSS 변수 alias, 기존 값 유지 후 참조 정리.
Medium: feature CSS button/card/form 정리, page wrapper padding 조정, breakpoint 중복 정리.
High: ApplicationDraftPage.css, aiAdvisor.css, supportProjects.workspace.css, Drawer/Modal/Accordion 관련 CSS, 상태 class 결합 CSS.
Critical: TSX 구조 변경, API/상태관리/라우팅/인증/로그인 전 영향. Critical은 “수정 금지 / 별도 검토 필요”로 분류하세요.

## 8. 분석할 20개 Master QA 항목
아래 20개 항목을 모두 검사하세요.

### 1) Auth Boundary / Exclusion Rule
로그인 이후 화면만 분석했는지, 로그인 전 페이지가 제외되었는지, Auth/Landing/Signup/Login 파일이 포함되지 않았는지, 인증 가드 내부/외부가 구분되었는지, 비로그인 AI Advisor가 제외되었는지 확인하세요.

### 2) Information Architecture
로그인 이후 화면 구조, 메뉴 구조, 정보 계층, 카드 우선순위, Dashboard → ROI → Support → Draft → Advisor 흐름 일관성을 검증하세요. IA는 수정하지 말고 구조 변경 제안은 “별도 기획 검토”로 분리하세요.

### 3) Page Scaffold
페이지 최상단 콘텐츠 시작 위치, H1, 부제목, Hero, 첫 카드, max-width, 좌우/상하 padding, sidebar-content gap, footer 여백, hero 유무에 따른 시작점 차이를 측정하세요.

### 4) Grid System
8pt grid, 2/3-column, aside layout, 카드 폭/baseline 정렬, hero 내부 grid, form grid, ROI/Support/Draft/Equipment ratio, page-specific grid collapse를 확인하세요.

### 5) Typography System
H1/H2/H3/Section/Card/Body/Caption/Tiny/Number/KPI/Button/Badge의 font-size, weight, line-height, letter-spacing, family를 측정하세요. KPI mono, Hero title, 로그인 전 landing typography는 일반 기준에 통합하지 마세요.

### 6) Color System
Primary/Secondary/Navy/Blue/Background/Card/Border/Text/Muted/Success/Warning/Error/Info/Disabled/Hover/Active/Focus/Chart/Highlight colors와 hard-coded hex, 유사 색상, status color 중복을 조사하세요. 새로운 hex는 제안하지 마세요.

### 7) Spacing System
margin, padding, gap, section/card/form/button/list/hero spacing을 조사하고 4/8/12/16/20/24/32/40/48/64와 10/14/18/22/26/28/30 등 임의값을 분류하세요.

### 8) Vertical Rhythm
제목-부제목, 부제목-Hero, Hero-첫 카드, 카드 내부 제목-본문, 문단 line-height, section 흐름, list gap, CTA 여백을 확인하세요.

### 9) Component Library / Reuse
Button, Card, Modal, Drawer, Dialog, Accordion, Tooltip, Tab, Dropdown, Status Badge, Form Field, Sidebar Item의 공통 재사용 여부와 page-local 중복 구현을 조사하세요.

### 10) Button System
Primary/Secondary/Outline/Ghost/Danger/Small/Icon/CTA/Disabled/Loading의 height, radius, padding, font, icon gap, hover/active/focus/disabled를 측정하세요. Legacy CTA와 workspace button을 혼동하지 마세요.

### 11) Card / Surface / Elevation System
Default/Section/Summary/Highlight/ROI/Support/Draft/Empty/Nested/Modal/Drawer card의 padding, radius, border, shadow, hover elevation을 조사하세요. Hero/large/priority card는 강제 통합하지 마세요.

### 12) Form System
Input, Select, Textarea, Checkbox, Radio, Switch, Label, Placeholder, Helper, Error, Required, Focus, Disabled, Validation state를 조사하세요. 데이터 저장/검증 로직과 연결된 TSX는 직접 수정 제안하지 마세요.

### 13) Badge / Chip / Status System
Status, ROI, D-Day, 추천, 완료, 진행중, 검토 필요, 위험, 정상, 저장됨, pending/completed/review needed의 height, radius, padding, font, tone을 조사하세요. Draft dark badge와 bright badge를 구분하세요.

### 14) Navigation / Sidebar / Header System
Sidebar width/padding, menu item height, active/hover, icon size, icon-text gap, header, breadcrumb, logo, footer nav, mobile nav, collapse 기준을 조사하세요.

### 15) Table / List / Timeline System
Table header, row height, cell padding, row hover, list spacing, timeline line/dot, numbered alignment, empty state, density를 조사하세요.

### 16) Iconography / Emoji / Illustration System
Icon size, stroke, gap, alignment, status/nav/button/card icon, Hero illustration, Emoji, Engi character, empty illustration을 조사하세요.

### 17) Motion & Interaction State
Hover, Active, Focus, Selected, Disabled, Loading, Expanded, Collapsed, Error, Empty, transition duration/easing, accordion/modal/tooltip/skeleton을 조사하세요.

### 18) Responsive / PWA / Accessibility
Desktop/Laptop/Tablet/Mobile/PWA, breakpoint, mobile padding, 1열 전환, button full-width, sidebar collapse, scroll, focus ring, contrast, keyboard, aria, disabled 인지성을 조사하세요. AI Advisor 100vh는 일반 responsive로 통합하지 마세요.

### 19) Visual Polish
Pixel/optical/number alignment, card height, hero balance, button optical balance, icon optical center, whitespace, shadow/border/radius consistency, empty space balance, typography density, CTA weight를 조사하세요. 더 예쁘게 바꾸는 제안은 금지합니다.

### 20) Manufacturing Brand Consistency / Regression / Token Integrity / Design Debt
A. 제조업/AI Advisor/Premium/신뢰/Navy/White Space/Gold-Mint 강조/산업형 다크톤과 밝은 workspace 연결감.
B. 회귀 위험 파일, API/상태/라우팅 결합 컴포넌트, 상태 class 결합, Drawer/Modal/Accordion/Advisor 위험.
C. hard-coded hex, !important, page-local variable, 임의값, 중복 shadow/border/radius/color.
D. 같은 역할의 다른 값, 반복 불일치, 공통화 후보/금지 후보, 단기/장기/보류 디자인 부채.

## 9. 출력 형식
최종 리포트는 Markdown으로 작성하세요.

1. Executive Summary: 점수, 가장 큰 불일치 5개, Critical/High/Medium/Low 개수, 전체 수정 위험도, 추천 진행 방식
2. Page Coverage: 분석한 로그인 이후 페이지/CSS/TSX, 제외한 로그인 전 페이지/인증 컴포넌트, Exclusion 검증
3. Design QA Master Table: Issue ID, Category, Problem Location, Related Pages, Related Files, Related Selectors/ClassNames, Current Values, Variant Values Found, Recommended Standard Candidate, Evidence, Impact, Difficulty, Priority, Regression Risk, Confidence, Notes
4. Critical Issues
5. High Priority Issues
6. Medium Priority Issues
7. Low Priority Issues
8. UI Inventory: typography/color/spacing/radius/shadow/button/field/badge/icon/breakpoint/motion inventory
9. Recommended Token Candidates
10. Regression Risk Report
11. Design Debt Report
12. Safe Next Step

## 10. Stop Rule
기준 불확실, 로그인 전 연결 가능성, 기능 영향, TSX 구조 변경, API/상태/라우팅 연결, AI Advisor/Chart/KPI/Dark Badge/Hero 예외 침범, Drawer 수치 추정 필요 시 “검토 필요 / 수정 보류”로 분리하세요.

## 11. Final Instruction
현재 단계에서는 절대 코드를 수정하지 마세요. 출력은 오직 Design QA Report만 작성하세요. 실제 Design Token 확정은 Phase 2, 수정 계획은 Phase 3, 구현은 Phase 4, 회귀 검증은 Phase 5에서 진행합니다.


---


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


---


# 03_Phase3_Execution_Plan_Ultra
## Cursor에 그대로 붙여넣기

# FactoFit Design QA Phase 3 — Execution Plan
## Phase 1 QA Report + Phase 2 Token Handoff 기반 / 코드 수정 금지

먼저 Phase 1 Design QA Report와 Phase 2 Design Token Specification / Handoff 내용을 반드시 읽고 요약하세요.

Execution Plan을 작성하기 전에 아래 2가지를 먼저 출력하세요.
1. Phase 1에서 확인된 실제 문제 요약
2. Phase 2에서 확정된 실제 기준 요약

그 다음에만 Execution Plan을 작성하세요. Phase 1과 Phase 2의 내용에 근거하지 않은 항목은 계획에 포함하지 마세요.

당신은 Senior Design System Architect + Senior Frontend Architect + Senior QA Engineer 역할을 수행합니다.

현재 단계는 Phase 3입니다. 아직 코드를 수정하지 마세요. 파일을 변경하지 마세요. 리팩터링하지 마세요. 구현 코드를 작성하지 마세요. CSS/TSX 수정 예시 코드를 작성하지 마세요.

## 1. 입력 기준
Execution Plan은 반드시 Phase 1 Design QA Report와 Phase 2 Design Token Specification/Handoff만 기준으로 작성하세요. 새로운 디자인 기준, px, 색상, radius, breakpoint를 만들지 마세요.

## 2. 전제
이 작업은 리디자인이 아닙니다. 이미 완성된 FactoFit 디자인, UX, UI, 레이아웃, 정보구조, 문구, 기능 로직은 절대 변경하지 않습니다. 목표는 미세한 오차 제거입니다.

## 3. 절대 제외 범위
Landing/Intro/Login/Signup/Email/Password/Welcome/Setup/비로그인 AI Advisor/비로그인 페이지는 수정하지 않습니다. API, Supabase, DB, RLS, Storage, 상태관리, 라우팅, localStorage, 데이터 필드명, 비즈니스 로직, 정보 구조, 문구, 카드 순서, 버튼 위치, UX 흐름도 수정하지 않습니다.

## 4. Execution Plan 원칙
수정 순서는 반드시 다음을 따르세요.
1. 중앙 토큰 alias 정리
2. 공통 Workspace Button 정리
3. Form focus 및 높이 체계 정리
4. Card / Border / Shadow 정리
5. Badge tone 정리
6. Scaffold 및 page override 최소화
7. 고위험 화면은 마지막
8. Regression QA

Minimum Change Principle을 따르세요. 공통 CSS/token/component 수정으로 해결 가능한 문제는 페이지별 override보다 먼저 처리합니다.

## 5. Design Change Budget
공통 token/foundation/shared style 70~80%, 페이지별 CSS override 20~30% 이하, TSX 구조 변경 원칙 금지, 신규 컴포넌트/디자인 패턴 금지.

## 6. Regression Budget
허용 Regression은 0%입니다. 기능/API/상태/라우팅/localStorage/입력저장/Drawer/Modal/Accordion/Advisor/로그인 전 영향 가능성이 있으면 “검토 필요”로 분리하세요.

## 7. Risk Matrix
Low: CSS token alias, 기존 값 alias, hover/focus 시각 상태.
Medium: feature CSS button/card/form, page wrapper padding, breakpoint 중복.
High: ApplicationDraftPage.css, aiAdvisor.css, supportProjects.workspace.css, 상태 class 결합 CSS, Drawer/Modal/Accordion CSS.
Critical: TSX 구조, 라우팅, 상태관리, API, 인증, 로그인 전. Critical은 수정 계획에 넣지 마세요.

## 8. 출력 형식
1. Executive Summary
2. Approved Standards Summary
3. Execution Order
   - Stage 1 Central Token Alias
   - Stage 2 Workspace Button
   - Stage 3 Form Focus / Height
   - Stage 4 Card / Border / Shadow
   - Stage 5 Badge Tone
   - Stage 6 Scaffold / Override Reduction
   - Stage 7 High-Risk Limited Application
   - Stage 8 Final Regression QA
각 Stage마다 수정 대상 파일, 수정 이유, 범위, 금지 사항, 예외, 영향 범위, Regression 위험도, 검증 방법을 작성하세요.
4. Target File Matrix
5. Do Not Touch List
6. Change Budget
7. Validation Plan: Dashboard, ROI, Support, Equipment, MyPage, Application Draft, AI Advisor, Safety.
8. Rollback Plan: branch, baseline commit/tag, Stage별 commit, revert 기준.
9. Final Checklist: 로그인 전/API/상태/라우팅/localStorage/문구/UX/신규 디자인/신규 hex/radius/breakpoint 없음, build 성공, visual regression 통과, Design Consistency Score 95+ 목표.

## 9. Stop Rule
기준 불명확, Phase 근거 없음, 기능 영향, 로그인 전 영향, TSX 구조 변경, AI Advisor/Hero/KPI/Chart/Draft dark badge 예외 침범 시 “검토 필요 / 수정 보류”로 분류하세요.

## 10. Final Instruction
현재 단계에서는 절대 코드를 수정하지 마세요. 출력은 실행 계획서, 위험도 분석, 검증 계획, rollback 계획만 작성하세요. 실제 수정 명령은 Phase 4에서 Stage별로 별도 승인 후 진행합니다.


---


# 04_Phase4_Implementation_Overview
## Stage별 실제 수정 운영 규칙

Phase 4는 실제 수정 단계입니다. 절대 한 번에 Stage 1~7을 모두 실행하지 마세요. 반드시 Stage별로 실행, 검증, diff 확인, commit 후 다음 Stage로 이동하세요.

공통 금지: 로그인 전 페이지, API, 상태관리, 라우팅, localStorage, DB/Supabase, 문구, UX 흐름, 카드 순서/버튼 위치, 신규 디자인/컴포넌트/hex/px/radius/breakpoint, AI Advisor/KPI/Chart/Dark badge/Hero 예외 수정 금지.

각 Stage 후 보고: 수정 파일, 수정하지 않은 파일, 적용한 token, 보존한 예외, Stop Rule 여부, 로그인 전 무변경, API/상태/라우팅/localStorage 무변경, build 또는 baseline 신규 오류 여부, 다음 Stage 가능 여부.


---


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


---


# 06_Cursor_Runbook
## 실행 순서

1. Phase 1: QA Report 생성
2. Phase 2: Design Token 기준표 생성
3. Phase 3: Execution Plan 생성
4. Phase 4: Stage별 실제 수정
5. Phase 5: Regression QA

## Git 준비
```bash
git status
git checkout -b chore/factofit-design-qa-normalization
git add .
git commit -m "backup: before FactoFit Design QA normalization"
git tag before-design-qa
```

## 실행 규칙
Phase 1~3은 코드 수정 금지입니다. Phase 4는 Stage별 하나씩 실행합니다. 각 Stage 후 git diff, build, 화면 확인, commit을 완료한 뒤 다음 Stage로 진행합니다.

금지: Phase 1~5를 한 번에 붙여넣기, Stage 1~7을 한 번에 수정, “전체 다 통일해줘” 단일 프롬프트, 로그인 전 페이지 포함, build 오류 해결 명목의 기능 코드 수정.


---


# 07_Checklists_And_Gates

## Gate 1 — Phase 1 완료 후
- [ ] QA Report만 생성
- [ ] 코드 수정 없음
- [ ] 로그인 전 페이지 제외
- [ ] 20개 Master QA 항목 포함
- [ ] UI Inventory 포함
- [ ] Regression Risk 포함
- [ ] Design Debt 포함
- [ ] Safe Next Step 포함

## Gate 2 — Phase 2 완료 후
- [ ] Phase 1 근거 기반 Token 작성
- [ ] 신규 hex 없음
- [ ] 신규 breakpoint 없음
- [ ] 예외 목록 포함
- [ ] Scaffold 기준 포함
- [ ] Button/Card/Form/Badge 기준 포함
- [ ] Token Integrity Rules 포함
- [ ] Safe Application Strategy 포함

## Gate 3 — Phase 3 완료 후
- [ ] Phase 1 + Phase 2 기반 Execution Plan
- [ ] Stage 1~8 포함
- [ ] Target File Matrix 포함
- [ ] Do Not Touch List 포함
- [ ] Change Budget 포함
- [ ] Validation Plan 포함
- [ ] Rollback Plan 포함
- [ ] 코드 수정 없음

## Gate 4 — 각 Stage 완료 후
- [ ] 해당 Stage 범위만 수정
- [ ] 로그인 전 파일 무변경
- [ ] API/상태/라우팅/localStorage 무변경
- [ ] 신규 디자인 없음
- [ ] 신규 hex/px/radius/breakpoint 없음
- [ ] Stop Rule 위반 없음
- [ ] build 신규 오류 없음
- [ ] diff 검토 완료
- [ ] Stage commit 완료

## Gate 5 — Final QA
- [ ] Phase 5 Regression QA Report 작성
- [ ] 대표 페이지 시각 확인
- [ ] 기능 smoke test 확인
- [ ] protected exception 유지
- [ ] git diff audit 완료
- [ ] 최종 PASS 또는 PASS WITH MINOR ISSUES


---


# Phase 4-1 — Stage 1 Implementation: Central Token Alias Only

이번 단계에서는 Phase 3 Execution Plan의 Stage 1만 수행하세요. Stage 2~7 금지.

수정 가능: frontend/src/index.css, frontend/src/styles/factofit/00-foundation-global.css. 확인만: frontend/src/factofit.css. 그 외 feature CSS/TSX/로그인 전/API/상태/라우팅/localStorage/backend/DB/Supabase 수정 금지.

목적: Phase 2 Handoff의 foundation alias만 추가/정리합니다. 화면이 바뀌면 안 됩니다.

허용: --blue-hover, --surface-subtle, --focus-ring, spacing/radius/shadow/line/card/status/motion alias. Phase 2 값만 사용.

금지: --blue, --navy, --bg, --line, body font, .btn, .field, media query, 기존 selector 동작 변경. 신규 hex/px/radius/shadow/breakpoint 금지.

보고: 수정 파일, 추가 alias, 변경하지 않은 core token, factofit.css import/cascade 확인, feature CSS/TSX 무변경, 로그인 전 무변경, build 또는 신규 오류 여부.


---


# Phase 4-2 — Stage 2 Implementation: Workspace Button Only

Stage 2만 수행하세요. Stage 3~7 금지.

수정 가능: dashboard.workspace.css, roi.workspace.css, supportProjects.workspace.css, equipmentStatus.workspace.css, mypage.workspace.css.

수정 금지: index.css, 00-foundation-global.css, ApplicationDraftPage.css, aiAdvisor.css, 모든 TSX, 로그인 전, API/상태/라우팅/localStorage.

기준: Workspace Primary/Secondary 44px, padding 0 16px, radius 8px, typography 15px/900, 기존 hover/disabled/loading 동작 보존.

예외 보존: Legacy .btn 54px, Landing/Auth button, Equipment emphasis CTA 48px, MyPage 46px가 기능/레이아웃에 묶여 있으면 보류, danger variant 신규 생성 금지, disabled 단일 기준 강제 통합 금지.

보고: 수정 파일, button selector, 예외, .btn/Equipment CTA/danger 무변경, 기능/라우팅/상태관리 무변경, 로그인 전 무변경, build/신규 오류.


---


# Phase 4-3 — Stage 3 Implementation: Form Focus / Height Only

Stage 3만 수행하세요. Stage 4~7 금지.

수정 가능: mypage.workspace.css, myPage.parts.tsx. 단 TSX는 focus 연결 수준만 허용.

수정 금지: API 호출, 저장/검증 로직, state 구조, placeholder/label/문구, select value, disabled 로직, revenue table 42px dense field, legacy .field 58px, 다른 feature CSS, 로그인 전.

기준: Standard Field 52px, padding 0 16px, radius 18px, focus --blue + --focus-ring, Dense/Table 42px 유지, Legacy .field 58px 유지, label-input gap 9px 유지.

보고: 수정 파일, focus selector/class, Standard/Dense/Legacy 유지, TSX 구조 무변경, validation/API/state 무변경, keyboard Tab focus, build/신규 오류.


---


# Phase 4-4 — Stage 4 Implementation: Card / Border / Shadow Only

Stage 4만 수행하세요. Stage 5~7 금지.

수정 가능: dashboard.workspace.css, roi.workspace.css, supportProjects.workspace.css, equipmentStatus.workspace.css, mypage.workspace.css.

수정 금지: ApplicationDraftPage.css, aiAdvisor.css, 모든 TSX, Drawer 수치, Hero 구조, KPI/Chart colors, 로그인 전.

기준: Standard card 16px / --line / --shadow, Section card 18px, Highlight card 20px, Large result 28px / --shadow-deep, Nested tinted info panel 유지, Priority/Hero/ROI Result 강제 통합 금지.

보고: 수정 파일, card selector, 유지 예외, Draft/Advisor/Drawer 무변경, card hover 확인, build/신규 오류.


---


# Phase 4-5 — Stage 5 Implementation: Badge / Status Tone Only

Stage 5만 수행하세요. Stage 6~7 금지.

수정 가능: ApplicationDraftPage.css, supportProjects.workspace.css.

수정 금지: TSX, 상태 mapping, dark draft workspace badge, info/error 신규 tone, Support drawer, 검색/캘린더 구조, AI Advisor, 로그인 전.

기준: Draft Primary 34px/0 14px/13px 900, Draft Compact min 28px/0 10px/12px 900, Priority Pill min 30px/0 12px/12px 900, D-Day min 24px/0 9px/12px 900, ok/warn/need 등 이미 정의된 tone만 사용.

보고: badge selector, bright badge만 수정했는지, dark badge 무변경, info/error 신규 없음, status mapping/TSX 무변경, Support D-Day tone, build/신규 오류.


---


# Phase 4-6 — Stage 6 Implementation: Scaffold / Page Override 최소화 Only

Stage 6만 수행하세요. Stage 7 금지.

수정 가능: dashboard.workspace.css, roi.workspace.css, supportProjects.workspace.css, equipmentStatus.workspace.css, mypage.workspace.css. 확인만: DashboardWorkspacePageLayout.tsx, DashboardWorkspaceSidebar.tsx.

수정 금지: TSX 구조, AI Advisor scaffold, ROI hero min-height, page-specific breakpoint, root background 강제 통합, 로그인 전.

기준: Sidebar 248px, collapse 860px, desktop padding 36/64/72, tablet 24/24/48, mobile 18/16/32, standard gap 16px, wide 1140px, MyPage shell 1180px.

보고: 수정 파일, scaffold selector, 248/860 유지, 1140/1180 유지, @980/@860 responsive, TSX 구조 무변경, 로그인 전 무변경, build/신규 오류.


---


# Phase 4-7 — Stage 7 Implementation: High-Risk Limited Application Only

고위험 파일 제한 적용 단계입니다. 한 번에 많은 파일을 수정하지 마세요. PR/commit 기준 high-risk 파일은 최대 1~2개만 수정하세요.

고위험 대상: ApplicationDraftPage.css, supportProjects.workspace.css, equipmentStatus.workspace.css, aiAdvisor.css.

수정 가능: Draft bright card/bright badge alias 잔여, Support alias 잔여, Equipment drawer 외부 저위험 alias, AI Advisor는 원칙적으로 QA/보존 확인만.

절대 금지: AI Advisor 일반 workspace token 적용, AI Advisor 100vh/dark-gold/chat bubble 변경, Draft dark panel/badge 변경, Draft 상태 class 변경, Support drawer 변경, Equipment drawer 수치 변경, Support Policy Drawer 수치 추정, TSX 구조 변경, Drawer/Modal/Accordion 구조 변경, 신규 값 생성, 로그인 전 수정.

보고: 수정 high-risk 파일 수, selector, 수정하지 않은 상태 class, Drawer/dark/Advisor/state 무변경, 1~2파일 제한 준수, build/신규 오류.
