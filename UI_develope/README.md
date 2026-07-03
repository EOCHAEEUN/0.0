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
