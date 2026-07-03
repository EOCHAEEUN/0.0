# FactoFit Design QA Report (Phase 1)

작성 목적: 로그인 이후 서비스 화면의 디자인 일관성 불일치 탐지/측정  
작성 원칙: 코드/로직/구조 수정 없이 QA 리포트만 작성

---

## 1) Executive Summary

- 전체 디자인 일관성 상태: **중간 이하 (약 5.8/10)**  
  - 페이지별 완성도는 높지만, 동일 역할 컴포넌트(버튼/카드/타이포/배지/입력)의 값이 화면마다 다르게 분기되어 누적 편차가 큼
- 가장 큰 불일치 5개
  1. **Page Scaffold 불일치**: `max-width`, 좌우 패딩, hero 시작점이 페이지별로 크게 다름 (`1140 / 1180 / 1240 / 1380px` 혼재)
  2. **Radius/Spacing 난립**: 8,10,12,14,16,18,20,22,24,26,28,30,32,34,36px 등 광범위 사용
  3. **Typography 스케일 분산**: H1/Section Title/Body의 기준 스케일이 화면마다 별도 운영
  4. **Button/Form 높이 불일치**: 36/40/42/44/46/48px 등 동일 계층 컴포넌트에 다중 높이 적용
  5. **Token Integrity 약화**: 서비스 화면에 하드코딩 hex, `!important`, page-local 변수 다수 존재
- 수정 우선순위 요약
  - P0: Scaffold + Typography + Button height 기준 통일
  - P1: Radius/Spacing 체계 정리
  - P2: Status/Badge/Icon/Interaction 상태 정의 일원화

---

## 2) Page Coverage

### 분석한 로그인 이후 페이지 (Authenticated 영역)

- `/dashboard`
- `/roi`, `/roi/strategy`, `/roi/analysis`, `/roi/roadmap`, `/roi/history`
- `/analysis/:id/result`, `/analysis/:id`
- `/analysis/:id/policies`, `/analysis/:id/policies/:policyId`
- `/application-draft`
- `/support-projects`, `/support-projects/priority`, `/support-projects/discovery`, `/support-detail`
- `/advisor`, `/ai`, `/ai-advisor`
- `/safety`
- `/equipment`
- `/mypage`, `/company`

### 분석에서 제외한 로그인 전 페이지/컴포넌트

- Landing/Main, Intro 계열
- Login/Signup/SignupModal/SignupForm
- Welcome/Setup 계열 (`/welcome`, `/setup/*`)
- 이메일 인증/비밀번호 재설정 계열 인증 컴포넌트
- 비로그인 전용 접근 UI 전반

### Exclusion Rule 검증

- `App.tsx` 기준으로 인증 가드(`AuthenticatedLayout`) 외부 라우트는 본 보고서 범위에서 제외 처리 완료

---

## 3) Design QA Table

아래는 카테고리별 대표 불일치 항목입니다.

### QA-01
- 카테고리: Page Scaffold
- 문제 위치: 본문 컨테이너 폭/패딩 기준
- 관련 페이지: Dashboard, ROI, MyPage, Safety, Policy
- 관련 파일명: `dashboard.workspace.css`, `roi.workspace.css`, `mypage.workspace.css`, `safety.css`, `AnalysisPoliciesPage.css`
- 현재 값: `max-width`가 `1140/1180/1240/1380px` 혼재, 본문 패딩 `24/28/64px` 혼재
- 권장 기준값: 워크스페이스 컨테이너 1세트(예: 1140~1200 + 좌우 24/32 단계)
- 불일치 설명: 페이지 이동 시 시작점/폭 체감이 달라 동일 제품 인상이 약화됨
- 영향 범위: 전 서비스 화면
- 수정 난이도: 중
- 우선순위: Critical
- Regression 위험도: 중

### QA-02
- 카테고리: Navigation System
- 문제 위치: 사이드바/서브메뉴 item height
- 관련 페이지: 공통 워크스페이스
- 관련 파일명: `dashboard.workspace.css`
- 현재 값: 메인 `44px`, 서브 `36px`, 하단 `40px`
- 권장 기준값: depth별 명시 규격(예: L1 44, L2 36 고정 + 상태 규칙 통일)
- 불일치 설명: 현재도 계층 분리는 있으나 페이지별 버튼 체계와 결합 시 전체 버튼 시스템과 불일치
- 영향 범위: 전역 내비게이션 인지성
- 수정 난이도: 하
- 우선순위: High
- Regression 위험도: 하

### QA-03
- 카테고리: Typography System
- 문제 위치: H1 scale
- 관련 페이지: ROI, Equipment, Policy, MyPage, Draft
- 관련 파일명: `roi.workspace.css`, `equipmentStatus.workspace.css`, `AnalysisPoliciesPage.css`, `mypage.workspace.css`, `ApplicationDraftPage.css`
- 현재 값: `clamp(24~30)`, `28px`, `34px`, `clamp(42~68)` 등 동급 헤더에 큰 편차
- 권장 기준값: H1 token 2~3단계로 제한 (예: workspace/hero/landing)
- 불일치 설명: 동일한 “페이지 타이틀” 역할에 서로 다른 타이포 위계가 적용됨
- 영향 범위: 헤더 인지, 정보 위계
- 수정 난이도: 중
- 우선순위: Critical
- Regression 위험도: 중

### QA-04
- 카테고리: Spacing System
- 문제 위치: 섹션 간 vertical spacing
- 관련 페이지: Dashboard, Support, Draft, Safety
- 관련 파일명: `dashboard.workspace.css`, `supportProjects.workspace.css`, `ApplicationDraftPage.css`, `safety.css`
- 현재 값: `14/16/18/20/22/24/26/28/30px` 다중 운영
- 권장 기준값: 8pt 파생 세트(8/12/16/24/32) 중심으로 재매핑
- 불일치 설명: 섹션 전환 리듬이 화면마다 달라 탐색 피로 증가
- 영향 범위: 전체 가독성/리듬
- 수정 난이도: 중
- 우선순위: High
- Regression 위험도: 하

### QA-05
- 카테고리: Grid System
- 문제 위치: hero/콘텐츠 그리드 폭 비율
- 관련 페이지: ROI, Draft, Support
- 관련 파일명: `roi.workspace.css`, `ApplicationDraftPage.css`, `supportProjects.workspace.css`
- 현재 값: `1fr+420`, `0.82fr+1.55fr`, `repeat(3)` 등 패턴별 독립 설계
- 권장 기준값: 공통 레이아웃 그리드 토큰(2col, 3col, aside ratio) 정의
- 불일치 설명: 카드 정렬과 baseline이 페이지마다 다르게 끝남
- 영향 범위: 데스크톱 시각 안정감
- 수정 난이도: 중
- 우선순위: High
- Regression 위험도: 중

### QA-06
- 카테고리: Color System
- 문제 위치: 브랜드 Navy/Blue 계열 사용
- 관련 페이지: Dashboard, Policy, Equipment, MyPage, Safety
- 관련 파일명: 다수 feature css
- 현재 값: `#061b34`, `#0f172a`, `#111827`, `#123b6d`, `#344ba0` 등 역할 중복
- 권장 기준값: semantic color map(Title/Body/Muted/Brand/Action) 단일화
- 불일치 설명: 같은 용도의 텍스트/버튼에 유사하지만 다른 색 반복
- 영향 범위: 브랜드 톤 일관성
- 수정 난이도: 중
- 우선순위: High
- Regression 위험도: 하

### QA-07
- 카테고리: Button System
- 문제 위치: primary/secondary height/radius
- 관련 페이지: ROI, Equipment, MyPage, Support
- 관련 파일명: `roi.workspace.css`, `equipmentStatus.workspace.css`, `mypage.workspace.css`, `supportProjects.workspace.css`
- 현재 값: 높이 `46/48/40/36`, radius `10/12/14/16/999`
- 권장 기준값: 버튼 사이즈 token(S/M/L) 고정 + variant별 style map
- 불일치 설명: 페이지 전환 시 CTA 밀도/강조 강도가 달라 보임
- 영향 범위: 주요 액션 가시성
- 수정 난이도: 중
- 우선순위: Critical
- Regression 위험도: 중

### QA-08
- 카테고리: Form System
- 문제 위치: input/select 높이/폰트/포커스
- 관련 페이지: Support, MyPage, Equipment
- 관련 파일명: `supportProjects.workspace.css`, `mypage.workspace.css`, `equipmentStatus.workspace.css`
- 현재 값: 높이 `42/46/48`, 폰트 `13/14`, focus 스타일 페이지별 상이
- 권장 기준값: 필드 높이 2단계 + focus ring 공통
- 불일치 설명: 입력폼 통일감/접근성 피드백 일관성 약함
- 영향 범위: 데이터 입력 UX
- 수정 난이도: 중
- 우선순위: High
- Regression 위험도: 중

### QA-09
- 카테고리: Component Library
- 문제 위치: 카드 컴포넌트 radius/shadow
- 관련 페이지: Draft, Support, Safety, Equipment, MyPage
- 관련 파일명: 각 feature css
- 현재 값: radius `8~36`, shadow alpha/offset 다양
- 권장 기준값: 카드 계층 2~3종(plain/elevated/hero)로 제한
- 불일치 설명: 카드가 공통 라이브러리보다 페이지 로컬 스타일로 증식
- 영향 범위: 화면 통일감
- 수정 난이도: 중
- 우선순위: Critical
- Regression 위험도: 하

### QA-10
- 카테고리: Badge / Status
- 문제 위치: 상태 pill 높이/색 농도
- 관련 페이지: MyPage, Policy, Support, ROI
- 관련 파일명: `mypage.workspace.css`, `AnalysisPoliciesPage.css`, `supportProjects.workspace.css`, `roi.workspace.css`
- 현재 값: 높이 `28/30/34/36`, 색상 채도/명도 편차 큼
- 권장 기준값: status token(success/warning/error/info/neutral) + size 2단계
- 불일치 설명: 동일 상태라도 의미 강도가 달라 보임
- 영향 범위: 상태 해석 정확성
- 수정 난이도: 하
- 우선순위: Medium
- Regression 위험도: 하

### QA-11
- 카테고리: Iconography
- 문제 위치: icon container 및 텍스트 간격
- 관련 페이지: Sidebar, MyPage, ROI, Equipment
- 관련 파일명: `dashboard.workspace.css`, `mypage.workspace.css`, `roi.workspace.css`, `equipmentStatus.workspace.css`
- 현재 값: 아이콘 박스 `10/12/14` radius, gap `6/8/10/12`
- 권장 기준값: 아이콘 사이즈(16/18/20) 및 gap token 고정
- 불일치 설명: 아이콘 광학 중심과 텍스트 baseline이 균일하지 않음
- 영향 범위: 정보 스캔 속도
- 수정 난이도: 하
- 우선순위: Medium
- Regression 위험도: 하

### QA-12
- 카테고리: Table / List / Timeline
- 문제 위치: table row density
- 관련 페이지: MyPage, Support
- 관련 파일명: `mypage.workspace.css`, `supportProjects.workspace.css`
- 현재 값: table cell padding/row height 기준 상이
- 권장 기준값: 데이터 밀도별 compact/regular 두 단계
- 불일치 설명: 목록형 UI의 밀도 정책이 화면별로 다름
- 영향 범위: 데이터 읽기 효율
- 수정 난이도: 하
- 우선순위: Medium
- Regression 위험도: 하

### QA-13
- 카테고리: Motion & Interaction
- 문제 위치: hover/active/transition 정의
- 관련 페이지: Equipment, Advisor, Sidebar 등
- 관련 파일명: `equipmentStatus.workspace.css`, `aiAdvisor.css`, `dashboard.workspace.css`
- 현재 값: 일부 버튼만 transition 명시, 다수 컴포넌트는 상태 정의 누락
- 권장 기준값: interactive token(duration/easing/state opacity/scale)
- 불일치 설명: 클릭 가능 요소의 반응감이 페이지별로 다름
- 영향 범위: 인터랙션 신뢰도
- 수정 난이도: 중
- 우선순위: Medium
- Regression 위험도: 중

### QA-14
- 카테고리: Responsive / PWA
- 문제 위치: 브레이크포인트 및 모바일 패딩
- 관련 페이지: 전반
- 관련 파일명: 각 feature css + `dashboard.workspace.css`
- 현재 값: 반응형 규칙이 파일별 독립적이며 공통 breakpoint policy 약함
- 권장 기준값: breakpoint token(`sm/md/lg/xl`) 공통 선언 및 재사용
- 불일치 설명: 축소 시 카드 전환/패딩/스크롤 영역 기준 불연속
- 영향 범위: 태블릿/노트북 UX
- 수정 난이도: 중
- 우선순위: High
- Regression 위험도: 중

### QA-15
- 카테고리: Accessibility
- 문제 위치: focus ring/disabled 인지성
- 관련 페이지: 다수 폼/버튼
- 관련 파일명: feature css 전반
- 현재 값: 포커스 스타일 구현 편차, disabled 대비 기준 불균일
- 권장 기준값: focus ring 색/두께/오프셋, disabled contrast 최소 기준 통일
- 불일치 설명: 키보드 탐색 및 상태 인식 예측 가능성이 낮음
- 영향 범위: 접근성/운영 품질
- 수정 난이도: 중
- 우선순위: High
- Regression 위험도: 중

### QA-16
- 카테고리: Visual Polish
- 문제 위치: radius/shadow/border optical balance
- 관련 페이지: Draft, Safety, Support, Advisor
- 관련 파일명: `ApplicationDraftPage.css`, `safety.css`, `supportProjects.workspace.css`, `aiAdvisor.css`
- 현재 값: 대형 radius + 강한 shadow가 페이지별로 과/저 사용
- 권장 기준값: elevation scale + corner scale 분리 운영
- 불일치 설명: 일부 페이지만 과도하게 “무겁거나” “가벼운” 인상
- 영향 범위: 프리미엄 톤 균일성
- 수정 난이도: 중
- 우선순위: Medium
- Regression 위험도: 하

### QA-17
- 카테고리: Manufacturing Brand Consistency
- 문제 위치: 제조업/신뢰/프리미엄 톤의 일관 전달
- 관련 페이지: Safety, ROI, Policy, Dashboard
- 관련 파일명: 관련 feature css
- 현재 값: 일부 페이지는 산업형 다크톤, 일부는 소비자형 블루-퍼플 톤 강조
- 권장 기준값: 제조업 중심 톤 매트릭스(Primary/Accent/Neutral 비율)
- 불일치 설명: 기능은 연결되지만 브랜드 내러티브 톤은 단절감 발생
- 영향 범위: 브랜드 경험
- 수정 난이도: 중
- 우선순위: High
- Regression 위험도: 하

### QA-18
- 카테고리: Regression Risk
- 문제 위치: 스타일-기능 결합도가 높은 뷰
- 관련 페이지: Application Draft, Advisor, Support
- 관련 파일명: `ApplicationDraftPage.css`, `aiAdvisor.css`, `supportProjects.workspace.css`
- 현재 값: 단일 파일 초대형 CSS + 상태 클래스/뷰 클래스 결합
- 권장 기준값: 변경 단위 분리(토큰→공통컴포넌트→페이지)
- 불일치 설명: 디자인 정리 과정에서 기능 DOM/상태 클래스 영향 가능성 큼
- 영향 범위: 실서비스 회귀
- 수정 난이도: 상
- 우선순위: Critical
- Regression 위험도: 상

### QA-19
- 카테고리: Design Token Integrity
- 문제 위치: 하드코딩 값, `!important`, 중복 hex
- 관련 페이지: Dashboard, Draft, Advisor, Equipment, Policy, MyPage
- 관련 파일명: 각 feature css
- 현재 값: 하드코딩 색상 대량 사용, `!important` 다수, radius/spacing 임의값 다중
- 권장 기준값: token-only 우선 원칙 + 예외 whitelist
- 불일치 설명: 토큰 외 값 증가로 시스템 확장성 저하
- 영향 범위: 장기 유지보수
- 수정 난이도: 중
- 우선순위: Critical
- Regression 위험도: 중

### QA-20
- 카테고리: Design Debt Report
- 문제 위치: 동일 역할 다중 구현
- 관련 페이지: 전체
- 관련 파일명: feature css 전반
- 현재 값: 버튼/카드/배지/폼이 페이지별 별도 구현
- 권장 기준값: 공통 primitive + semantic variant 조합
- 불일치 설명: 화면 추가 시 편차가 더 빨리 누적되는 구조
- 영향 범위: 향후 개발 속도/품질
- 수정 난이도: 상
- 우선순위: Critical
- Regression 위험도: 중

---

## 4) Critical Issues (먼저 수정 필요)

1. Scaffold 기준 통일 실패 (`max-width`, main padding, hero 시작점)
2. Typography 계층(H1/H2/body/button) 스케일 분산
3. Button/Form 사이즈 체계 부재(높이/radius/상태)
4. Card/Badge radius-shadow 규칙 미정의
5. Token 무결성 저하(`!important`, 하드코딩 값, 중복 색상)
6. 대형 단일 CSS 파일 중심 구조로 인한 회귀 위험

---

## 5) High Priority Issues

- Responsive 기준/브레이크포인트 정책 파일별 분산
- Navigation/CTA 상태 표현(hover/focus/active) 통일 부족
- 브랜드 톤(제조업/프리미엄/신뢰) 페이지 간 농도 차이
- 입력 컴포넌트 포커스/disabled 접근성 일관성 부족

---

## 6) Medium Priority Issues

- 배지/상태칩 높이/폰트/색 농도 미세 편차
- 리스트/테이블 밀도 규칙 페이지별 상이
- 아이콘-텍스트 간격/정렬의 광학적 편차
- 모션/전환 정의 누락 또는 분산

---

## 7) Low Priority Issues

- 일부 미세 letter-spacing 편차
- 카드 내부 문단 line-height의 미세 차이
- 숫자/단위 텍스트의 alignment 미세 차이

---

## 8) Recommended Token Candidates

- Typography token
  - `font.display.hero`, `font.heading.h1/h2/h3`, `font.body.md/sm`, `font.label`, `font.caption`
- Color token
  - `color.text.primary/secondary/muted`, `color.bg.page/card`, `color.action.primary/hover`, `color.status.*`
- Spacing token
  - `space.4/8/12/16/20/24/32/40`
- Radius token
  - `radius.sm(8)`, `md(12)`, `lg(16)`, `xl(24)`, `pill(999)`
- Shadow token
  - `shadow.sm/md/lg` (명도/알파 고정)
- Button token
  - `btn.height.sm/md/lg`, `btn.radius`, `btn.padding`, `btn.focusRing`
- Card token
  - `card.padding.sm/md/lg`, `card.radius`, `card.border`, `card.elevation`
- Form token
  - `field.height.sm/md`, `field.radius`, `field.border`, `field.focus`
- Badge token
  - `badge.height`, `badge.padding`, `badge.text`, `badge.statusColor`
- Icon token
  - `icon.size.sm/md/lg`, `icon.stroke`, `icon.textGap`
- Motion token
  - `motion.fast/normal`, `motion.easing.standard`, `motion.interactive.hover/press`

---

## 9) Suggested Next Step (수정 실행 전 안전 순서 제안)

실제 수정은 아직 진행하지 않고, 다음 단계에서 아래 순서로 진행하는 것이 안전합니다.

1. **기준 확정 단계**: Scaffold/Type/Button/Form/Card의 기준 토큰 세트 확정
2. **공통 스타일 단계**: 공통 토큰 적용 레이어만 우선 반영 (기능 로직 비접촉)
3. **저위험 화면 단계**: MyPage/Equipment처럼 기능 결합도 낮은 화면부터 적용
4. **중위험 화면 단계**: ROI/Support/Safety 순으로 적용
5. **고위험 화면 단계**: Application Draft/Advisor 등 대형 CSS+상태 결합 화면 마지막 적용
6. **회귀 점검 단계**: 데스크톱/태블릿/모바일 + 키보드 포커스 + 주요 CTA 동작 확인

---

## 참고 (분석 방식)

- 본 리포트는 **로그인 이후 라우트 및 해당 스타일 파일의 정적 QA 분석**으로 작성됨
- 현재 단계에서는 코드/UX/정보구조/API/상태/라우팅 수정 없이 불일치 항목만 정리함
