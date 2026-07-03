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
