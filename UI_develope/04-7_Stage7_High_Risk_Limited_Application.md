# Phase 4-7 — Stage 7 Implementation: High-Risk Limited Application Only

고위험 파일 제한 적용 단계입니다. 한 번에 많은 파일을 수정하지 마세요. PR/commit 기준 high-risk 파일은 최대 1~2개만 수정하세요.

고위험 대상: ApplicationDraftPage.css, supportProjects.workspace.css, equipmentStatus.workspace.css, aiAdvisor.css.

수정 가능: Draft bright card/bright badge alias 잔여, Support alias 잔여, Equipment drawer 외부 저위험 alias, AI Advisor는 원칙적으로 QA/보존 확인만.

절대 금지: AI Advisor 일반 workspace token 적용, AI Advisor 100vh/dark-gold/chat bubble 변경, Draft dark panel/badge 변경, Draft 상태 class 변경, Support drawer 변경, Equipment drawer 수치 변경, Support Policy Drawer 수치 추정, TSX 구조 변경, Drawer/Modal/Accordion 구조 변경, 신규 값 생성, 로그인 전 수정.

보고: 수정 high-risk 파일 수, selector, 수정하지 않은 상태 class, Drawer/dark/Advisor/state 무변경, 1~2파일 제한 준수, build/신규 오류.
