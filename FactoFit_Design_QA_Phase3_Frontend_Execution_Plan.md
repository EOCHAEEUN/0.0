# FactoFit Design QA Phase 3 — Frontend Execution Plan
## Login-Required Workspace Only

---

## 1. Executive Summary

로그인 이후 워크스페이스 UI의 디자인 일관성을 **기존 구현값·토큰만**으로 정규화한다. 신규 디자인·컴포넌트·API/라우팅 변경은 없다.

| 항목 | 내용 |
|---|---|
| 현재 상태 | Phase 1 QA: 일관성 약 5.8/10 — scaffold·button·card·form·badge·token 분산 |
| 목표 | Phase 2 Handoff 기준을 8 Stage로 안전 적용 |
| 변경 비중 | shared foundation/common rule **75~80%** · page override **20~25%** |
| TSX | 구조 변경 **0** — `myPage.parts.tsx` focus 연결만 |
| High-risk | Draft / Support / Equipment drawer / AI Advisor — **PR당 최대 1~2파일** |
| Build | 각 Stage: **baseline 대비 신규 TS 오류 없음**; baseline 해결 후에만 `npm run build` 성공을 최종 gate |

**실행 순서:** Stage 1 (alias) → 2 (button) → 3 (form) → 4 (card) → 5 (badge) → 6 (scaffold) → 7 (high-risk 제한) → 8 (회귀 QA, 코드 없음)

---

## 2. Evidence Basis

### Phase 1 Actual Problems (P1-01 ~ P1-10)

| ID | 실제 문제 | 심각도 |
|---|---|---|
| P1-01 | `max-width` 1140/1180/1240/1380px 혼재, padding 24/28/64px 혼재 | Critical |
| P1-02 | H1 등 동급 헤더 타이포 스케일 분산 | Critical |
| P1-03 | 버튼 높이 36~48px, radius 다중 | Critical |
| P1-04 | 카드 radius 8~36, shadow 분산 | Critical |
| P1-05 | 하드코딩 hex, `!important`, page-local 변수 | Critical |
| P1-06 | Draft/Advisor/Support 대형 CSS + 상태·뷰 class 결합 회귀 위험 | Critical |
| P1-07 | input 높이 42/46/48, focus 페이지별 상이 | High |
| P1-08 | 섹션 vertical spacing 14~30px 다중 | High |
| P1-09 | 반응형 breakpoint 파일별 분산 | High |
| P1-10 | focus ring / disabled 대비 불균일 | High |

### Phase 2 Approved Standards (요약)

| 영역 | 확정 기준 |
|---|---|
| Foundation | `index.css`, `00-foundation-global.css` — `--navy`, `--blue`, `--bg`, `--line`, `--shadow` 등 |
| Workspace Button | Primary/Secondary 44px, 0 16px, radius 8px |
| Legacy `.btn` | 54px, radius 6px 유지 |
| Equipment emphasis CTA | 48px 유지 |
| Standard Field | 52px, 0 16px, radius 18px + `--blue` + `--focus-ring` |
| Dense Field | 42px, 0 12px, radius 12px (revenue table) |
| Card | standard 16px / section 18px / highlight 20px / large 28px |
| Scaffold | sidebar 248px, collapse 860px, padding 3단계, gap 16px |
| Wide / Form shell | 1140px ROI·Equipment / 1180px MyPage |
| Drawer | EquipmentDrawerShell 표준; Support Policy Drawer 수치 추정 금지 |

### Protected Exceptions

AI Advisor dark/gold·100vh · chat bubble asymmetric radius · dark hero gradients · KPI DM Mono 36px · chart colors · ROI hero min-height 360px · draft dark rgba badge · workspace highlight blue `#2563eb` 등 · page-specific grid collapse 960/1080/1180 · nested tinted info panel · Legacy `.btn` 54px · Equipment 48px CTA

---

## 3. Scope Lock

| 구분 | 내용 |
|---|---|
| **수정 가능** | Foundation 2파일(alias), feature workspace CSS 6개, `myPage.parts.tsx`(focus만), layout TSX(className 확인) |
| **수정 금지** | Landing/Login/Signup · 비로그인 Advisor · API/DB/라우팅/상태/localStorage · TSX 구조 · 신규 hex/px/radius/bp |
| **Critical 제외** | Support Policy Drawer 수치 · Danger button · draft info/error tone · baseline 외 TS 오류 수정 |

---

## 4. Approved Standards Summary

| Token / Component | Official Value | Notes |
|---|---|---|
| `--blue` / hover | `#0047A0` / `#00377d` | CTA·focus; `#2563eb`는 highlight만 |
| `--line` / `--shadow` | `#E2E8F0` / `0 4px 16px rgba(6,27,52,0.06)` | card 기본 |
| `--focus-ring` | `0 0 0 4px rgba(0,71,160,0.08)` | Standard Field 연결 |
| Workspace btn | 44px / 8px / 15px·900 | dashboard 기준점 |
| Standard card | 16px / `--line` / `--shadow` | |
| Section card | 18px (MyPage) | |
| Highlight card | 20px (Support priority) | 강제 16px 금지 |
| Padding desktop/tablet/mobile | 36 64 72 / 24 24 48 / 18 16 32 | @980 / @860 |
| Drawer overlay | `rgba(15,23,42,0.42)` | Equipment 기준 |

---

## 5. Target File Matrix

| File | 수정 여부 | Stage | 수정 목적 | 허용 범위 | Risk | 검증 | 비고 |
|---|---|---|---|---|---|---|---|
| `index.css` | 예 | 1 | central alias | alias·주석만; 값 불변 | Low | diff 2파일 이내; baseline 신규 오류 없음 | |
| `00-foundation-global.css` | 예 | 1 | index 동기 alias | 동일 | Low | 동일 | |
| `factofit.css` | 아니오 | 1 | import 확인 | 순서 점검만 | Low | 변경 없음 | |
| `dashboard.workspace.css` | 예 | 2,4,6 | shared btn·card·scaffold | alias·중복 제거 | Medium | Dashboard 3 viewport | **공통 기준점** |
| `roi.workspace.css` | 제한 | 2,4,6 | alias·1140 유지 | hero·selected·360px 제외 | Medium | ROI tabs·hero | |
| `supportProjects.workspace.css` | 제한 | 2,4,5,6,7 | btn·badge·scaffold | drawer·preflight·상태 class 제외 | High | Support CTA·pills | PR 분리 |
| `equipmentStatus.workspace.css` | 제한 | 2,4,6,7 | card·scaffold | **drawer·48px 제외** | High | drawer flow | |
| `mypage.workspace.css` | 제한 | 2,3,4,6 | focus·card·shell | 46px btn·root bg 보류 | Medium | form·revenue table | |
| `ApplicationDraftPage.css` | 제한 | 5,7 | bright badge·card alias | dark·state·view 제외 | High | draft 전 상태 | PR 분리 |
| `myPage.parts.tsx` | 예 | 3 | focus 연결 | 구조·validation 금지 | Medium | keyboard focus | |
| `DashboardWorkspacePageLayout.tsx` | 확인 | 6 | className 일치 | 구조 금지 | Low | layout spot-check | |
| `DashboardWorkspaceSidebar.tsx` | 확인 | 6 | className 일치 | nav·routing 금지 | Low | collapse @860 | |
| `aiAdvisor.css` | 보류/QA | 7,8 | 예외 보존 확인 | 일반 token 적용 금지 | High | 100vh·chat | **수정 원칙 없음** |

---

## 6. Change Budget

| 항목 | 목표 | Stage 1~8 계획 | 초과 시 |
|---|---|---|---|
| shared foundation / common rule | 75~80% | **75~80%** | page-only diff 보류 |
| page override | 20~25% | **20~25%** | high-risk PR 1~2파일로 분리 |
| TSX 구조 변경 | 0 | 0 | Critical stop |
| 신규 컴포넌트 | 0 | 0 | — |
| 신규 token/hex/radius/bp | 0 | 0 | alias·동치 치환만 |
| high-risk 동시 변경 | ≤2파일/PR | Stage 7 엄격 적용 | PR split |

---

## 7. Execution Order

### Stage 1 — Central Token Alias

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-05, P1-10 |
| **Phase 2** | `--blue-hover`, `--surface-subtle`, `--focus-ring`, spacing/radius/shadow alias |
| **대상** | `index.css`, `00-foundation-global.css`; `factofit.css` 확인만 |
| **허용** | alias·주석·누락 변수; index↔foundation 동기 |
| **금지** | 기존 `--blue`/`--navy`/`--bg`/`--line` 값 변경; `.btn`/`.field`/body/media; feature·TSX |
| **Risk** | Low |
| **Stop Rule** | foundation 값 diff · feature/TSX diff → 즉시 중단 |
| **검증** | 1440/1366/390; 로그인 후 spot-check; 로그인 전 무변; baseline 신규 build 오류 없음 |
| **Exit** | [ ] alias만 추가 [ ] 기존 값 무변 [ ] feature/TSX diff 없음 [ ] factofit.css 무변 |

---

### Stage 2 — Workspace Button

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-03, P1-05 |
| **Phase 2** | 44px/0 16px/8px; `.btn` 54px; equipment 48px; Support 42/44→44 후보 |
| **대상** | 5개 feature workspace CSS; **우선** `dashboard.workspace.css` |
| **허용** | `.ff-workspace-btn` alias; Support 중복 선언 제거; equipment secondary alias |
| **금지** | `.btn` 54px 변경; equipment 48px; danger variant; mypage 46px 강제 44px; hover/disabled/loading 변경 |
| **Risk** | Medium (Support High) |
| **Stop Rule** | CTA 동작 변화 · drawer/상태 class 변경 → 롤백 |
| **검증** | 3 viewport; hover/disabled; Dashboard·Support·Equipment CTA; baseline 신규 오류 없음 |
| **Exit** | [ ] dashboard shared 기준 [ ] Support 44px 후보 또는 보류 문서화 [ ] 54px/48px/46px 보존 [ ] danger 없음 |

---

### Stage 3 — Form Focus / Height

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-07, P1-10 |
| **Phase 2** | Standard 52px/18px; Dense 42px/12px; Legacy `.field` 58px; focus `--blue`+`--focus-ring`; gap 9px |
| **대상** | `myPage.parts.tsx`, `mypage.workspace.css`(revenue focus 동치 var만) |
| **허용** | Field/SelectField focus 연결만 |
| **금지** | JSX 구조·validation·API·placeholder·disabled; revenue 42px 변경; Equipment/Support form 일괄 통합 |
| **Risk** | Medium |
| **Stop Rule** | 구조·validation diff → 중단 |
| **검증** | 3 viewport; keyboard Tab; MyPage 입력 흐름; baseline 신규 오류 없음 |
| **Exit** | [ ] 52px/18px/gap 9px 유지 [ ] focus 연결 [ ] revenue dense 유지 [ ] legacy `.field` 무변 |

---

### Stage 4 — Card / Border / Shadow

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-04, P1-05 |
| **Phase 2** | 16px/`--line`/`--shadow`; section 18px; highlight 20px; large 28px/`--shadow-deep` |
| **대상** | 5개 feature workspace CSS (**ApplicationDraft 제외**) |
| **허용** | standard·panel selector alias; mypage border `var(--line)` 동치 |
| **금지** | priority/hero/ROI result→16px; nested tinted border 제거; Draft CSS |
| **Risk** | Medium (Support High) |
| **Stop Rule** | highlight 강제 통합 · drawer shadow 재정의 → 롤백 |
| **검증** | 3 viewport; Dashboard·ROI·Support·Equipment·MyPage card screenshot; baseline 신규 오류 없음 |
| **Exit** | [ ] standard 16px 소비 [ ] 18/20/28 예외 [ ] Draft 미수정 [ ] tinted panel 유지 |

---

### Stage 5 — Badge Tone

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-04, P1-05, P1-10 |
| **Phase 2** | Draft Primary 34px; Compact 28px; Priority 30px; D-Day 24px; ok/warn/need only |
| **대상** | `ApplicationDraftPage.css`, `supportProjects.workspace.css` |
| **허용** | bright surface ok/warn/need·pill hex → central alias 동치 |
| **금지** | dark rgba badge; info/error 신규; tone mapping·TSX·상태 class; Support drawer·검색/캘린더 구조 |
| **Risk** | High |
| **Stop Rule** | dark badge·info selector·TSX diff → 롤백 |
| **검증** | 3 viewport; draft 전 tone; support 4 dday tone; baseline 신규 오류 없음 |
| **Exit** | [ ] bright만 치환 [ ] dark 무변 [ ] info/error 없음 [ ] TSX 무변 |

---

### Stage 6 — Scaffold / Override Reduction

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-01, P1-08, P1-09 |
| **Phase 2** | padding 3단계; sidebar 248/860; gap 16px; 1140/1180 유지 |
| **대상** | `dashboard.workspace.css` 우선 + 4 feature CSS; layout TSX 확인만 |
| **허용** | 중복 padding/gap alias; 중복 선언 제거 |
| **금지** | root bg→`--bg` 강제; ROI 360px; bp 통합·신규; Advisor scaffold; TSX 구조 |
| **Risk** | Medium |
| **Stop Rule** | root bg·hero·bp·layout diff → 중단 |
| **검증** | 3 viewport; @980 padding; @860 collapse; 1140/1180; baseline 신규 오류 없음 |
| **Exit** | [ ] padding 3단계 유지 [ ] 1140/1180 유지 [ ] root·hero·bp 무변 [ ] layout TSX 구조 무변 |

---

### Stage 7 — High-Risk Limited Application

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-06, P1-05 (잔여) |
| **Phase 2** | Stage 5·4 경계 재확인; drawer·Advisor 예외 |
| **대상** | Draft / Support / equipment(확인) / aiAdvisor(QA만) — **PR당 1~2파일** |
| **허용** | Draft bright card alias 잔여; Support alias 잔여(preflight·drawer 외) |
| **금지** | dark·view·state CSS; Advisor 일반 token; drawer 수치; Support Policy Drawer |
| **Risk** | High |
| **Stop Rule** | 다중 high-risk 파일 단일 PR · drawer·dark diff → 롤백 |
| **검증** | 3 viewport; draft dark 별도; equipment drawer; Advisor 시각 동일; baseline 신규 오류 없음 |
| **Exit** | [ ] 1~2파일/PR [ ] drawer·dark·Advisor token 무변 [ ] Support drawer 무변 |

---

### Stage 8 — Final Regression QA

| 항목 | 내용 |
|---|---|
| **Phase 1** | P1-06 회귀 확인 |
| **Phase 2** | 전 기준 대조 |
| **대상** | 코드 수정 없음 — 9 페이지 QA |
| **허용** | 체크리스트·스크린샷·이슈 티켓 |
| **금지** | QA 중 즉시 CSS 수정(별도 hotfix) |
| **Risk** | — |
| **Stop Rule** | 발견 결함 → 해당 Stage revert 또는 hotfix PR 분리 |
| **검증** | 아래 §10 전체 + Manual UAT |
| **Exit** | [ ] Regression Matrix 완료 [ ] Manual UAT 완료/티켓화 [ ] 로그인 전 무변 [ ] baseline 신규 오류 없음 [ ] (조건부) build 성공 |

---

## 8. High-Risk Containment

| Area | Why | Allowed | Forbidden | Validation |
|---|---|---|---|---|
| Application Draft | P1-06 대형 CSS·상태 결합 | bright badge/card alias만 | dark·view·state | 전 상태 tone |
| AI Advisor | 100vh·dark/gold | QA·보존 확인 | 일반 token | chat·session @1080 |
| Support Projects | drawer·preflight 결합 | btn·badge·scaffold alias | drawer·상태·검색/캘린더 구조 | CTA·pills; drawer 무변 |
| Equipment drawer | 유일 공식 근거 | drawer 외 alias 1건 이내 | `ff-evidence-drawer-*` 전부 | open/close @960 |
| 상태 class CSS | 스타일·기능 결합 | 동일 selector 값 alias만 | class명·분기 구조 | 상태 조합 스모크 |

**PR 규칙:** high-risk 파일 **최대 1~2개/PR** · Draft와 Support **동시 대량 변경 금지**

---

## 9. Do Not Touch / Hold Items

| 항목 | 처리 |
|---|---|
| Support Policy Drawer | 실행 제외 — Equipment 기준만 참조, 수치 추정 금지 |
| Danger button variant | 실행 제외 |
| `ff-draft-status` info/error | 실행 제외 — 미정의 |
| Draft compact badge info | 실행 제외 — scope 제한 |
| disabled 단일 기준 통합 | 실행 제외 |
| workspace root bg 강제 통합 (`#f4f7f9`/`#f4f6fb`) | 실행 제외 |
| letter-spacing / line-height 미세 조정 | 실행 제외 |
| AI Advisor 일반 token 적용 | Stage 7 원칙 보류 |
| ROI hero min-height 360px | 보존 |
| chart colors | 실행 제외 |
| draft dark rgba badge | 보존 |
| page-specific hero spacing | 보존 |
| page-specific grid collapse (960/1080/1180) | 통합·삭제 금지 |
| Legacy `.btn` 54px | 보존 |
| Equipment emphasis CTA 48px | 보존 |
| 신규 TSX 구조 변경 | 금지 |
| 로그인 전 / 인증 / API / Supabase / DB / 상태관리 / 라우팅 / localStorage | 금지 |
| baseline 외 TS 오류 (MyPage/ROI/layout/Draft) | Design QA PR 혼합 금지 |

---

## 10. Validation Plan

### Viewport (전 Stage·Stage 8 공통)

| Tier | Size |
|---|---|
| Desktop | 1440×900 |
| Laptop | 1366×768 |
| Mobile | 390px |

### Per-Page Checks

| Page | Visual | Interaction | Responsive | High-Risk |
|---|---|---|---|---|
| Dashboard | hero·analysis card·btn | sidebar·workspace btn hover | @980/@860 | dark hero 유지 |
| ROI | hero·panel·KPI Mono | tabs·CTA | 1140·@1180 | min-height 360px |
| Support | priority 20px·pills | CTA | @1080 1열 | drawer·preflight 무변 |
| Equipment | list card·48px CTA | form·list | @960 | evidence drawer |
| MyPage | section 18px·1180 | Field focus·revenue 42px | @1080/@760 | root bg·46px btn |
| Application Draft | bright/dark badge | status 화면 | page bp | dark rgba·state CSS |
| AI Advisor | dark/gold·bubble | composer·session | @1080·100vh | token 미적용 |
| Safety | card vs workspace | CTA | mobile padding | hero 예외 |

### Global Checks (Stage 8 필수)

- 로그인 전 화면 **무변경**
- baseline 대비 **신규 build 오류 없음**
- keyboard focus (MyPage Field·revenue table)
- hover / active / disabled / loading
- drawer / modal / accordion
- 주요 클릭·입력 동작
- (조건부) baseline TS 해결 후 `npm run build` 성공

---

## 11. Manual UAT Required

| 영역 | 검증 (인증·실데이터 필요) |
|---|---|
| 지원사업 | 검색·분류·캘린더·정책 상세 — **drawer 수치 변경 없음** |
| Application Draft | 상태별 화면 전체 (ok/warn/need; readiness/judgement/evidence; dark panel) |
| AI Advisor | 실제 대화·세션·workflow |
| 설비 | 증빙 drawer·업로드 흐름 |
| MyPage | 저장·validation·기업/문서/매출 E2E |

---

## 12. Rollback Plan

| 단계 | 조치 |
|---|---|
| 작업 전 | Phase 3 전용 **branch** 생성; **baseline commit** 기록 (태그 권장) |
| Stage 진행 | **Stage별 독립 commit** (Stage 1~7) |
| High-risk | Draft / Support / equipment / Advisor 관련 — **별도 PR**; merge 단위 = revert 단위 |
| Stage 내 문제 | 해당 **Stage commit만 revert**; 이후 Stage 미진행 |
| 전체 롤백 | Phase 3 시작 전 **baseline commit**으로 복귀 |
| API/DB/라우팅 | 변경 없음 → **rollback 불필요** |
| Build | revert 후 baseline 신규 오류 없음 재확인; baseline TS 미해결 시 build success gate 미적용 |

---

## 13. Final Checklist

### Process

- [ ] 전용 branch·baseline commit 확보
- [ ] Stage 1~7 순차 실행·Stage별 commit
- [ ] high-risk PR 1~2파일/PR 준수
- [ ] Hold Items 미포함 확인

### Technical

- [ ] Foundation alias만 추가, 기존 값 무변
- [ ] Workspace btn 44px/8px (54px·48px·46px 보존)
- [ ] Standard Field 52px + focus ring
- [ ] Card 16px standard / 18·20·28 예외
- [ ] Bright badge alias / dark badge 무변
- [ ] Scaffold padding 3단계·248px/860px·1140/1180
- [ ] Drawer·Advisor·Support Policy Drawer·danger·info/error 미변경

### Validation

- [ ] 1440 / 1366 / 390 전 페이지
- [ ] Regression Matrix 9페이지
- [ ] Manual UAT 5영역
- [ ] 로그인 전 무변
- [ ] baseline 대비 신규 build 오류 없음
- [ ] (조건부) `npm run build` 성공

### Scope

- [ ] API · DB · 라우팅 · 상태관리 · localStorage 무변
- [ ] 로그인 전 · 인증 화면 무변
- [ ] baseline 외 TS 오류 Design QA PR에 미포함

---

**문서 근거:** `FactoFit_Design_QA_Report.md` · `factofit_frontend_design_token_handoff.md` · Phase 3-A~D (Cursor 대화)  
**대상:** 로그인 이후 워크스페이스만 · 구현은 Stage 1부터 순차 진행
