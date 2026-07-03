# FactoFit 로그인 이후 워크스페이스 디자인 토큰 정규화 전달서
**대상:** Frontend 담당자  
**범위:** 로그인 후 서비스 화면만  
**목적:** 신규 디자인 작업이 아니라, 이미 구현된 FactoFit UI의 색상·간격·컴포넌트 규격을 안전하게 정규화합니다.

---

## 1. 작업 원칙

### 포함 범위
- Dashboard
- ROI
- 지원사업
- 설비관리
- 마이페이지
- 로그인 후 AI Advisor
- 공통 Workspace Layout / Sidebar / Button / Card / Form / Badge / Drawer

### 제외 범위
- Landing / Intro
- Login / Signup / 인증 화면
- 비로그인 AI Advisor
- API, Supabase, DB, RLS, Storage
- 상태관리, 라우팅, localStorage
- 페이지별 정보 구조·문구·기능 흐름 변경

### 반드시 지킬 것
1. **새로운 색상·px 값·radius·breakpoint를 임의로 만들지 않습니다.**
2. 기존 동작, API 호출, 데이터 필드, 라우팅은 변경하지 않습니다.
3. 공통 토큰을 먼저 정리하고, 페이지별 CSS override는 마지막에 최소화합니다.
4. AI Advisor, KPI, 차트, Hero는 아래 “예외” 규칙을 우선합니다.
5. 한 번에 전 페이지를 바꾸지 말고, 단계별로 시각 검증 후 다음 단계로 진행합니다.

---

## 2. 대상 파일 및 우선순위

### 중앙 Foundation
- `frontend/src/index.css`
- `frontend/src/styles/factofit/00-foundation-global.css`
- `frontend/src/factofit.css`  
  - import/cascade 순서 확인만 필요

### Workspace 공통
- `frontend/src/features/dashboard/dashboard.workspace.css`
- `frontend/src/components/layout/DashboardWorkspacePageLayout.tsx`
- `frontend/src/components/layout/DashboardWorkspaceSidebar.tsx`

### 페이지별 Workspace CSS
- `frontend/src/features/roi/roi.workspace.css`
- `frontend/src/features/support/supportProjects.workspace.css`
- `frontend/src/features/equipmentStatus/equipmentStatus.workspace.css`
- `frontend/src/features/mypage/mypage.workspace.css`
- `frontend/src/features/applicationDraft/ApplicationDraftPage.css`

### 특수 화면
- `frontend/src/features/aiAdvisor/aiAdvisor.css`  
  - 특수 예외 기준만 유지. 일반 Workspace 토큰 강제 적용 금지.

---

# 3. Official Foundation Tokens

## 3-1. Color

| Token | Official Value | 사용 기준 | 비고 |
|---|---:|---|---|
| `--navy` | `#061B34` | 브랜드 딥 네이비, 제목, 다크 CTA | 기존 중앙 토큰 유지 |
| `--blue` | `#0047A0` | Primary CTA, 링크, focus border | Action 용도 |
| `--blue-hover` | `#00377d` | Primary CTA hover | 신규 alias 추가 가능 |
| `--bg` | `#F5F7FB` | 앱 shell 기본 배경 | Workspace root `#f4f7f9`은 1차 유지 |
| `--card` | `#FFFFFF` | 카드, 패널, Drawer panel | |
| `--surface-subtle` | `#F8FAFC` | 입력, 테이블, 빈 상태 | alias 추가 가능 |
| `--ink` | `#0B1F3A` | H1, 강조 제목 | |
| `--text` | `#334155` | 본문 기본 | |
| `--muted` | `#667085` | 캡션, 보조 문구 | |
| `--line` | `#E2E8F0` | 기본 카드·입력·divider 보더 | |
| `--line-dark` | `#CBD5E1` | 강조 divider / strong border | |
| `--green` | `#0B7A53` | 성공 텍스트 | |
| `--green-soft` | `#E8F5EF` | 성공 배경 | |
| `--orange` | `#E65F00` | 경고 텍스트 | |
| `--orange-soft` | `#FFF2DF` | 경고 배경 | |
| `--red` | `#CD2E3A` | 오류 텍스트 | |
| `--red-soft` | `#FDE8E9` | 오류 배경 | |
| `--focus-ring` | `0 0 0 4px rgba(0, 71, 160, 0.08)` | 공통 input focus ring | alias 추가 가능 |
| disabled background | `#aeb4c6` | 버튼 disabled 배경 | 현재 공통화 우선순위 낮음 |

### 색상 적용 규칙
- `#2563eb`, `#3b82f6`, `#93c5fd`는 ROI·지원사업·설비 화면의 **workspace highlight 계열**입니다. `--blue`를 대체하지 말고, 선택 상태·정보성 강조·차트/도메인 UI에만 유지합니다.
- `#f4f7f9`, `#f4f6fb`는 현 워크스페이스 root 변형입니다. 첫 단계에서 강제 치환하지 말고, 공통 token alias 도입 후 점진 정리합니다.
- `#e1e9f3`, `#dbe3ee`, `#e8eef5` 등 유사 border는 최종적으로 `--line` 중심으로 정리합니다.
- 새로운 hex 값 추가 금지.

---

## 3-2. Typography

| Token | Official Value | 사용 기준 |
|---|---|---|
| body font | `"Noto Sans KR", "Pretendard", system-ui, sans-serif` | 전역 본문 |
| label font | `'DM Sans', sans-serif` | 섹션 라벨, 태그 |
| numeric/KPI font | `"DM Mono", ui-monospace, ...` | KPI·금액 강조 |
| H1 | `clamp(24px, 2.4vw, 30px) / 950 / -0.03em` | 페이지/hero 제목 |
| H2 | `20px / 900` | section 제목 |
| H3 / section title | `17px / 900` | panel·list header |
| Card title | `18px / 900` | 카드 헤더 |
| Body | `15px / 700 / line-height: 1.65–1.8` | 본문/설명 |
| Body small | `14px / 700–800` | 보조 본문, 테이블, 버튼 주변 |
| Caption / badge | `12px / 900` | 배지, 메타 |
| Button | `14px / 900` | Workspace CTA |
| Number emphasis | `36px / 500 / -1.5px` | KPI 전용, DM Mono 사용 |

### Typography 규칙
- 13px은 dense/보조 UI에 한정합니다.
- 14px은 body-small, 15px은 일반 본문으로 사용합니다.
- `H1 22px/28px`, `H2 22px/25px`, `Card title 16px/17px` 등 기존 변형은 페이지 구조상 필요할 때만 유지합니다.
- KPI 대형 숫자는 body scale에 통합하지 않습니다.

---

## 3-3. Spacing

| Token | Value | 사용 기준 |
|---|---:|---|
| `--space-4` | `4px` | nav micro gap |
| `--space-8` | `8px` | label, chip, small row gap |
| `--space-12` | `12px` | toolbar, card 내부 small gap |
| `--space-16` | `16px` | 기본 grid gap, section 내부 gap |
| `--space-20` | `20px` | card padding, block gap |
| `--space-24` | `24px` | hero padding, layout gap |
| `--space-32` | `32px` | large section, hero horizontal padding |
| `--space-40` | `40px` | large hero inner gap |
| `--space-48` | `48px` | tablet bottom padding |
| `--space-64` | `64px` | desktop main horizontal padding |

### 예외/정규화 후보
| Existing Value | 처리 |
|---:|---|
| `10px` | 8px 또는 12px으로 정리 후보 |
| `14px` | badge·grid·section gap에서 유지 가능 |
| `18px` | 16px 또는 20px으로 정리 후보 |
| `28px` | hero margin, highlight grid 등 구조상 필요한 곳만 유지. 일반 spacing은 24px/32px 우선 |

---

## 3-4. Radius / Border / Shadow

### Radius
| Token | Value | 사용 기준 |
|---|---:|---|
| `--radius-small` | `8px` | nav item, small utility control |
| `--radius-control` | `12px` | input, standard button, composer |
| `--radius-card` | `16px` | 일반 workspace card / panel |
| `--radius-large` | `28px` | large result / draft card / large modal |
| `--radius-pill` | `999px` | badge, chip, status |

### Border
| Token | Value | 사용 기준 |
|---|---|---|
| default | `1px solid #E2E8F0` | 기본 card, input, table |
| selected | `2px solid #0047A0` | selected choice / active card |
| focus | `border-color: #0047A0` + `--focus-ring` | 입력 focus |

### Shadow
| Token | Value | 사용 기준 |
|---|---|---|
| `--shadow` | `0 4px 16px rgba(6,27,52,0.06)` | 기본 card |
| `--shadow-deep` | `0 16px 48px rgba(6,27,52,0.13)` | 강조/결과 card |
| `--shadow-modal` | `0 24px 48px rgba(15,29,53,0.18)` | modal / drawer |
| hover | `translateY(-1px ~ -2px)` + shadow 1단계 상승 | card / button hover |
| transition | `0.18s ease` | interactive 요소 공통 |

---

# 4. Workspace Scaffold Standard

## 4-1. 공통 Workspace Shell

| Scaffold Token | Official Value | 적용 기준 |
|---|---|---|
| sidebar width | `248px` | `--ff-dashboard-sidebar-width` |
| desktop main padding | `36px 64px 72px` | `≥981px` |
| tablet main padding | `24px 24px 48px` | `≤980px` |
| mobile main padding | `18px 16px 32px` | `≤860px` |
| sidebar collapse | `860px` | width 0 → static full width, main margin-left 0 |
| standard content width | full main | Dashboard / Support |
| wide content width | `1140px` centered | ROI / Equipment |
| form-heavy shell | `1180px` | MyPage |
| standard section gap | `16px` | 기본 section/card stack |
| hero/header → first content | `16px` | 기본값. ROI/hero 특수 화면은 예외 |
| default card grid gap | `16px` | 기본 Workspace grid |

## 4-2. Responsive

| Tier | Breakpoint | 기본 동작 |
|---|---:|---|
| Desktop | `≥981px` | fixed sidebar, multi-column |
| Tablet | `≤980px` | main padding 축소 |
| Mobile Workspace | `≤860px` | sidebar static, workspace 기본 grid 1열 |
| Page-specific exception | `960/1080/1180px` | Equipment / Support / MyPage / ROI 구조에 따라 1열 전환 |
| AI Advisor exception | `1080/1200px` | 별도 100vh flex 구조, 일반 scaffold와 분리 |

### Scaffold 적용 주의
- Dashboard와 Support는 full-width main을 기본으로 유지합니다.
- ROI / Equipment의 `1140px` inner wrapper는 유지합니다.
- MyPage의 `1180px` shell은 form-heavy 예외로 유지합니다.
- AI Advisor full-page workspace의 `height: 100vh; overflow: hidden;`은 일반 Workspace에 적용하지 않습니다.

---

# 5. Component Standards

## 5-1. Button

| Variant | Height | Padding | Radius | Typography | Color / Border | Usage |
|---|---:|---|---:|---|---|---|
| Workspace Primary | `44px` | `0 16px` | `8px` | `15px / 900` | `#123b6d`, white | `ff-workspace-btn.primary` |
| Workspace Secondary | `44px` | `0 16px` | `8px` | `15px / 900` | `#c9d7e8` border | `ff-workspace-btn.secondary` |
| Compact Secondary | `40px` | `0 14px` | `12px` | `13px / 800` | default border | equipment secondary |
| Global CTA / Legacy | `54px` | `0 26px` | `6px` | `15px / 900` | `.btn.blue` / `--blue` | landing/legacy/modal footer 우선 |
| Icon / Utility | `34px × 34px` | - | `8px` | icon `18px` | `#f8fafc` | drawer close |
| Emphasis CTA exception | `48px` | `0 20px` | `12px` | `15px / 800` | equipment CTA | 설비 강조 CTA |

### Button 정리 원칙
- Workspace 기본 버튼은 **44px / radius 8px** 기준으로 맞춥니다.
- `.btn` 54px은 Global CTA/legacy로 보존합니다.
- Support의 `42px/44px` 중복 선언은 기능 변경 없이 44px로 정리 후보입니다.
- 공통 danger variant는 현재 명시 정의가 없으므로 새 색상/스타일을 임의로 추가하지 않습니다.
- disabled는 현재 `#aeb4c6` 또는 `opacity: 0.6–0.7`로 혼재하므로, 기존 UX가 깨지지 않는 범위에서만 추후 통합합니다.

---

## 5-2. Card

| Variant | Padding | Radius | Border | Shadow | Usage |
|---|---|---:|---|---|---|
| Standard Workspace Section Card | head `20px 22px 0`, body `18px 22px 22px` | `18px` | `1px #E2E8F0` | `0 8px 24px rgba(15,23,42,0.04)` | MyPage section card |
| Form / Analysis Section Card | `22px 24px 20px` | `16px` | `1px #e1e9f3` | `0 8px 24px rgba(17,42,76,0.05)` | dashboard analysis |
| Priority / Highlight Card | `28px 30px` | `20px` | `1px #e8edf5` | `0 10px 28px rgba(15,23,42,0.05)` | support priority |
| Nested Info Panel | `18px 20px` | `16px` | `1px #e0e7ff` | none | support reason panel |
| Large Result Card | `28px` | `28px` | `1px #E2E8F0` | `--shadow-deep` | draft/result |

### Card 정리 원칙
- 기본 workspace 카드: `radius 16px`, `--line`, `--shadow` 중심.
- Section card는 `18px`, highlight card는 `20px`을 허용합니다.
- 큰 결과/초안 카드만 `28px`을 사용합니다.
- Nested info panel의 tinted border는 정보성 panel 예외로 유지합니다.
- Priority card, Hero, ROI Result는 일반 card 규칙으로 강제 통일하지 않습니다.

---

## 5-3. Form

| Variant | Height | Padding | Radius | Border / Focus | Typography | Usage |
|---|---:|---|---:|---|---|---|
| Standard Field | `52px` | `0 16px` | `18px` | `1px #E2E8F0`; 공통 focus token 연결 대상 | label `13px/900`, input `15px/800` | MyPage Field / SelectField |
| Dense / Table Field | `42px` | `0 12px` | `12px` | border `#e2e8f0`, existing focus 유지 | `14px/700` | revenue table |
| Legacy `.field` | `58px` | `0 18px` | `18px` | legacy outline 유지 | label `13px/900` | compatibility only |

### Form 정리 원칙
- Standard Field는 52px을 기본으로 유지합니다.
- Dense/Table Field는 42px을 table 전용으로 유지합니다.
- `.field` 58px은 기존 호환용이며, 신규 화면에서 우선 사용하지 않습니다.
- Standard Field의 focus가 누락된 곳은 새 스타일을 창작하지 말고 `--focus-ring`과 `--blue`를 연결하는 방향으로만 통일합니다.
- field label ↔ input 간격은 기존 9px을 보존합니다.

---

## 5-4. Badge / Chip / Status

| Variant | Size | Radius | Typography | 색상 규칙 | Usage |
|---|---|---:|---|---|---|
| Priority Pill | min `30px`, `0 12px` | pill | `12px/900` | `#eef2ff / #4338ca` | support priority |
| D-Day Pill | min `24px`, `0 9px` | pill | `12px/900` | urgent / soon / normal / past 별도 tone | support deadline |
| Draft Primary Status | `34px`, `0 14px` | pill | `13px/900` | ok / warn / need | `ff-draft-status` |
| Draft Compact Status | min `28px`, `0 10px` | pill | `12px/900` | bright surface ok/warn/need | readiness/judgement/evidence |
| General Semantic Status | component scope 유지 | pill | `12px/900` | central success/warning/error/info | 일반 workspace |

### Badge 정리 원칙
- `ff-draft-status`의 `info/error`는 현재 CSS 정의가 없으므로 신규 tone 추가 금지.
- draft compact badge의 `info`는 일부 scope에서만 정의됨. scope 밖에서 임의 사용 금지.
- dark draft workspace의 rgba badge는 밝은 surface badge와 혼용 금지.

---

## 5-5. Drawer / Modal

| Element | Official Existing Value | Responsive |
|---|---|---|
| Standard Side Drawer | `width: min(560px,100vw); height:100%` | `≤960px`: mobile bottom drawer |
| Wide Side Drawer | `min(760px,100vw)` | `≤960px`: width 100vw |
| Mobile Bottom Drawer | `max-height:92vh; border-radius:16px 16px 0 0` | `≤960px` |
| Overlay | `rgba(15,23,42,0.42); z-index:1200` | fixed inset |
| Header | `20px 22px 16px`, bottom border `#e8eef5` | |
| Body | `18px 22px 24px`, `flex:1; overflow:auto` | |
| Footer | `14px 22px 18px`, top border `#e8eef5`, background `#fbfdff`, actions gap `8px` | |
| Close Button | `34×34px`, radius `8px`, background `#f8fafc`, icon `18px` | |

### Drawer 규칙
- EquipmentDrawerShell을 현재 **표준 Side Drawer 근거**로 사용합니다.
- Support Policy Drawer는 별도 수치/CSS 근거가 확인되지 않았으므로, 신규 규격을 추정하지 않습니다.
- Modal/drawer shadow는 `--shadow-modal`을 기준으로 하되, 기존 실사용 CSS를 우선 보존합니다.

---

## 5-6. Sidebar

| Element | Existing Standard | State / Responsive |
|---|---|---|
| Container | `248px`; `padding:28px 18px 24px`; right border `#d8e0ec` | `≤860px`: static full width |
| Brand | grid gap `4px`; padding `0 8px` | |
| Main nav | min-height `44px`; padding `0 12px`; gap `10px`; icon `18px` | active `#dfe8fb / #123b6d` |
| Sub nav | min-height `36px`; padding `0 10px`; indent `28px` | active `#e8eef9` |
| Footer nav | min-height `40px`; icon `17px`; margin-top auto | active `#dfe8fb` |
| Nav stack | main gap `4px`, sub gap `2px` | |
| Collapse | `--ff-dashboard-sidebar-width: 0px` | main margin-left 0 |

---

# 6. Interaction Standards

| State | Existing Pattern | 적용 대상 |
|---|---|---|
| Hover – card | `translateY(-2px)` + elevated shadow | interactive cards |
| Hover – button | `translateY(-1px ~ -2px)` + darkened background | CTA / workspace buttons |
| Active / selected | sidebar active tint, ROI selected border | nav / tabs / selected choice |
| Focus | `--blue` border + `--focus-ring` | input / select / keyboard focus |
| Disabled | `#aeb4c6` 또는 `opacity:0.6–0.7` | 기존 컴포넌트별 동작 보존 |
| Loading | skeleton gradient `1.2s infinite` | dashboard / support |
| Empty | dashed border | upload / empty state |
| Transition | `0.18s ease` | interactive controls |

---

# 7. Special Exceptions — Do Not Normalize

| Area | Existing Pattern | 구현 규칙 |
|---|---|---|
| AI Advisor dark/gold | dark gradient + `#d8ad43` | foundation color로 대체 금지 |
| AI Advisor full workspace | `height/max-height:100vh; overflow:hidden` | 일반 page scaffold 미적용 |
| Chat bubble | asymmetric `22px 22px 6px 22px` | pill/card radius와 통합 금지 |
| Dark Hero gradients | page-specific navy gradients | 일반 page background로 대체 금지 |
| KPI number | DM Mono `36px/500/-1.5px` | body typography와 통합 금지 |
| Chart colors | semantic visual colors | brand action color로 통합 금지 |
| Page-specific Hero | margin `16/20/28px`, padding `24–36px` | 단일 hero gap 강제 금지 |
| Page grid collapse | `860/960/1080/1180px` | 구조 의존 breakpoint 유지 |
| Draft dark badges | rgba background + light text | bright badge와 혼용 금지 |
| Workspace highlight blue | `#2563eb`, `#93c5fd` 등 | `--blue` action color 대체 금지 |
| ROI hero | min-height `360px` | 일반 hero 규칙 미적용 |
| Support Policy Drawer | 상세 수치 미확인 | Equipment drawer 기준만 참조, 추정 구현 금지 |

---

# 8. Token Integrity Rules

| Rule | 허용 | 피해야 할 것 | 예외 |
|---|---|---|---|
| New hex | 기존 inventory / 공식 token 값 | 신규 임의 색상 | Special Exception 기존 색상 |
| Primary blue | `--blue` for CTA/focus | `#2563eb`로 CTA 대체 | ROI/Support highlight |
| Spacing | 4/8/12/16/20/24/32 scale 우선 | 10/18/28 무분별 추가 | 14px badge/grid, hero 구조 |
| Radius | card 16, section 18, highlight 20 | 동일 역할에 임의 radius 혼용 | large 28, pill 999 |
| Card border | `--line` | 유사 hex 신규 확산 | tinted nested panel |
| Button height | workspace 44px | 42–54px 신규 확산 | legacy `.btn` 54, equipment emphasis 48 |
| Input height | standard 52 / dense 42 / legacy 58 | 중간값 신규 생성 | revenue table |
| Focus | `--focus-ring` | focus 누락 방치 | legacy `.field` outline |
| Button radius | workspace 8 / control 12 | 6/10/14의 신규 확산 | legacy `.btn` 6 |
| Scaffold | 36/64/72 → 24/24/48 → 18/16/32 | 페이지별 임의 padding | AI Advisor layout |
| Breakpoint | 980 / 860 공통 | 신규 공통 breakpoint 생성 | page-only 960/1080/1180 |
| Exceptions | 별도 표 유지 | Advisor/Hero/Chart 강제 통합 | - |

---

# 9. Safe Application Plan

## Stage 1 — 중앙 토큰 alias 정리
**수정 범위**
- `index.css`
- `00-foundation-global.css`

**허용**
- 기존 값을 변경하지 않고 alias/주석/누락 변수 보강
- `--blue-hover`, `--surface-subtle`, radius, spacing, focus, shadow alias 추가

**금지**
- 기존 `--blue`, `--navy`, body, `.btn`, `.field`, media query, selector 값 변경
- feature CSS, TSX, backend 수정

**검증**
- `git diff`가 중앙 CSS 2개 이내인지
- 기존 CSS 변수 값이 변경되지 않았는지
- `npm run build`

---

## Stage 2 — Workspace Button 정리
**수정 범위**
- Workspace 관련 feature CSS만

**목표**
- 기본 Workspace 버튼을 `44px / radius 8px` 기준으로 정리
- Support의 42px/44px 중복 선언 제거 후보 처리

**보존**
- `.btn` 54px legacy/global CTA
- Equipment 강조 CTA 48px
- 기존 클릭·disabled·loading 동작

**검증**
- Dashboard / Support / Equipment 버튼 hover, disabled, mobile 확인
- API/라우팅 변경 없음

---

## Stage 3 — Form focus 및 높이 체계
**수정 범위**
- `myPage.parts.tsx`
- `mypage.workspace.css`
- 공통 foundation의 focus alias

**목표**
- Standard Field 52px 유지
- Dense Table Field 42px 유지
- Standard Field에 공통 focus token 연결

**보존**
- Legacy `.field` 58px
- 데이터 입력/검증 로직
- placeholder, disabled, select value 처리

**검증**
- keyboard tab focus
- select/input validation
- MyPage 문서/기업 입력 흐름

---

## Stage 4 — Card / Border / Shadow 정리
**수정 범위**
- Workspace feature CSS

**목표**
- 기본 card는 `--line`, radius 16, `--shadow` 중심으로 정리
- Section 18 / Highlight 20 / Large result 28 예외 보존

**검증**
- Dashboard / ROI / Support / Equipment / MyPage screenshot 비교
- card hover 및 nested info panel 확인

---

## Stage 5 — Badge tone 정리
**수정 범위**
- `ApplicationDraftPage.css`
- Support badge CSS

**목표**
- bright surface의 ok/warn/need tone 일관성 정리
- info/error이 정의되지 않은 배지는 신규 창작하지 않음

**보존**
- draft dark workspace rgba badge
- 기존 데이터 상태 mapping

**검증**
- draft status, readiness, judgement, evidence 모든 상태 확인

---

## Stage 6 — Scaffold 및 페이지 override 최소화
**수정 범위**
- `dashboard.workspace.css` 중심
- 각 feature workspace CSS의 중복 선언 최소화

**목표**
- page padding 3단계와 sidebar 248px/860px collapse 유지
- 중복 border, spacing, radius alias로 치환

**보존**
- ROI/Equipment max-width
- MyPage 1180px shell
- page-specific grid collapse
- AI Advisor 100vh 구조

**검증**
- Desktop `1440×900`
- Laptop `1366×768`
- Mobile `390px`
- Dashboard / ROI / Support / Equipment / MyPage / Draft / Advisor screenshot 비교

---

# 10. Definition of Done

- [ ] 로그인 전 화면, API, backend, Supabase, routing, 상태관리 변경 없음
- [ ] 중앙 token alias와 feature CSS의 역할이 명확함
- [ ] Workspace 기본 버튼이 44px / 8px으로 일관됨
- [ ] Standard Field 52px, Dense Field 42px 체계 유지
- [ ] 공통 focus ring을 사용할 수 있음
- [ ] 기본 card가 line/radius/shadow 기준을 따름
- [ ] Sidebar 248px 및 860px collapse 유지
- [ ] AI Advisor / chart / dark hero / KPI / draft dark badge 예외 보존
- [ ] 모든 변경 후 `npm run build` 성공
- [ ] 대표 페이지 시각 회귀 비교 완료
- [ ] 기존 기능 클릭, 입력, drawer, modal, responsive 동작 유지
