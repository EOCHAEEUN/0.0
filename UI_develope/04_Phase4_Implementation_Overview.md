# 04_Phase4_Implementation_Overview
## Stage별 실제 수정 운영 규칙

Phase 4는 실제 수정 단계입니다. 절대 한 번에 Stage 1~7을 모두 실행하지 마세요. 반드시 Stage별로 실행, 검증, diff 확인, commit 후 다음 Stage로 이동하세요.

공통 금지: 로그인 전 페이지, API, 상태관리, 라우팅, localStorage, DB/Supabase, 문구, UX 흐름, 카드 순서/버튼 위치, 신규 디자인/컴포넌트/hex/px/radius/breakpoint, AI Advisor/KPI/Chart/Dark badge/Hero 예외 수정 금지.

각 Stage 후 보고: 수정 파일, 수정하지 않은 파일, 적용한 token, 보존한 예외, Stop Rule 여부, 로그인 전 무변경, API/상태/라우팅/localStorage 무변경, build 또는 baseline 신규 오류 여부, 다음 Stage 가능 여부.
