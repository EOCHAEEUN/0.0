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
