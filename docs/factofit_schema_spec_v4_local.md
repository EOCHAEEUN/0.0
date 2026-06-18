# FactoFit Schema Contract v3 Local

작성 기준: 2026-06-18 로컬 코드 + Supabase 컬럼 확인 기준  
원본: `factofit_schema_spec_v2.md`  
목적: ROI 기반 정책추천, raw 후보 목록, 신청서 초안 분리, 시나리오 매칭 저장 기준 반영

<!-- 변경 주석 규칙
- 추가: 이번 로컬 수정/확정으로 새로 들어간 컬럼/규칙
- 변경: v2 대비 저장 방식/필수 여부/의미가 달라진 부분
- 삭제/미사용: 사용하지 않거나 다른 테이블/구조로 이동한 부분
- 주의: 코드/DB 간 추가 확인이 필요한 부분
-->

## 0. Core Rule

```txt
auth.users
  -> user_profile
  -> company (user_id 기준 1개)
       -> equipment
            -> roi_output
            -> matched_policy
            -> draft_result
```

`user_profile`, `company`, `equipment`가 기준 데이터이며, ROI/정책추천/초안작성은 저장된 기준 데이터를 읽어서 동작한다.

## 1. Table Roles

| Table | Role |
|---|---|
| `auth.users` | Supabase Auth 계정 |
| `user_profile` | 사용자 기본정보 |
| `company` | 회사 기본정보 + 상세정보 |
| `equipment` | 설비정보 + ROI 입력값 |
| `roi_output` | ROI 계산 결과 |
| `policy` | 지원사업 원본 데이터 |
| `matched_policy` | AI 추천 정책 결과 |
| `draft_result` | 신청서 초안 생성 결과 |
| `chat_history` | AI Advisor 대화 기록 |
| `safety_rule` | 설비별 안전평가 기준 |
| `safety_inspection` | 회사/설비별 안전평가 일정 |

<!-- 삭제/미사용 -->
`roi_input` 테이블은 사용하지 않는다.

## 2. Relationships

```txt
auth.users.id
  -> user_profile.user_id
  -> company.user_id
       -> equipment.company_id
       -> roi_output.company_id
       -> matched_policy.company_id
       -> draft_result.company_id
```

Required:

```txt
user_profile.user_id = auth.users.id
company.user_id = auth.users.id
equipment.company_id = company.company_id
roi_output.company_id = company.company_id
roi_output.equipment_id = equipment.equipment_id
matched_policy.company_id = company.company_id
matched_policy.equipment_id = equipment.equipment_id
draft_result.company_id = company.company_id
draft_result.equipment_id = equipment.equipment_id
```

## 3. `user_profile`

| Column | Type | Required | Note |
|---|---|---:|---|
| `user_id` | uuid | yes | `auth.users.id` |
| `email` | text | yes | Auth email과 동기화 |
| `name` | text | yes | 사용자 이름 |
| `phone` | text | yes | 사용자 연락처 |
| `manager_name` | text | no | 담당자/관리자 이름 |
| `manager_phone` | text | no | 담당자/관리자 연락처 |
| `business_registration_no` | text | no | 보조값 |
| `service_terms_agreed` | boolean | yes | default false |
| `privacy_policy_agreed` | boolean | yes | default false |
| `created_at` | timestamptz | auto | 생성일 |
| `updated_at` | timestamptz | auto | 수정일 |

<!-- 추가 -->
`manager_name`, `manager_phone`은 관리자/담당자 표시 및 신청서 초안 작성에 사용할 수 있는 선택값이다.

## 4. `company`

company는 `user_id` 기준 1개만 유지한다.

Required index:

```sql
create unique index if not exists company_user_id_unique
on public.company(user_id);
```

| Column | Type | Required | Note |
|---|---|---:|---|
| `company_id` | uuid | yes | PK |
| `user_id` | uuid | yes | `auth.users.id` |
| `company_name` | text | yes | 회사명 |
| `industry_name` | text | yes | 업종명 |
| `industry_code` | jsonb/text[] | yes | 예: `["C24", "C25"]` |
| `business_registration_no` | text | no | 사업자등록번호 |
| `region` | text | yes | 지역 |
| `company_type` | text | yes | 중소기업/중견기업 등 |
| `primary_purpose` | text[] | yes | 지원사업 추천/ROI 분석 목적 |
| `employee_count` | int | no | optional |
| `annual_revenue` | int/bigint | yes | 단위: 만원 |
| `revenue_2y_ago_manwon` | bigint | no | 2년 전 매출 |
| `revenue_3y_ago_manwon` | bigint | no | 3년 전 매출 |
| `total_assets_manwon` | bigint | no | 자산총액 |
| `is_disclosure_group_member` | boolean | no | 대기업 계열사 여부 |
| `established_year` | int | no | 설립연도 |
| `workplace_type` | text | no | 공장/본사 등 |

<!-- 변경 -->
`employee_count`는 nullable이어야 한다.

<!-- 변경 -->
`annual_revenue`는 최종 기준상 필수다.  
백엔드 모델은 optional일 수 있으나 프론트/저장 단계에서 필수값으로 검증한다.

<!-- 삭제 -->
`company_size`는 사용하지 않고 `company_type`으로 통일한다.

## 5. `equipment`

| Column | Type | Required | Note |
|---|---|---:|---|
| `equipment_id` | uuid | yes | PK |
| `company_id` | uuid | yes | company FK |
| `name` | text | yes | 설비명 |
| `category` | text | yes | press/cnc/injection 등 |
| `process` | text | no | 공정명 |
| `age_years` | int | yes | 설비 사용연수 |
| `energy_cost_annual` | int | yes | 연간 에너지 비용, 만원 |
| `defect_rate` | float | no | 불량률 % |
| `maintenance_cost_annual` | int | no | 연간 유지보수비, 만원 |
| `current_capacity_value` | float | no | 설비 용량/생산능력 보조값 |
| `production_qty` | int | no | 연간 생산량 |
| `contribution_margin_won` | int | no | 제품 개당 예상이익 |
| `scenario_a_investment_manwon` | int | no | 전체교체 예상 투자금 |
| `scenario_b_investment_manwon` | int | no | 부분개선 예상 투자금 |

<!-- 삭제 -->
`user_status`, `system_status`, `status_reason`은 마이페이지 최종 화면 기준에서 사용하지 않는다.

## 6. `roi_output`

ROI 계산 결과 저장 테이블.

| Column | Type | Required | Note |
|---|---|---:|---|
| `id` | uuid | yes | PK |
| `company_id` | uuid | no | company FK |
| `equipment_id` | uuid | no | equipment FK |
| `roi_data` | jsonb | no | 전체 ROI 결과 JSON |
| `scenario_a_investment_manwon` | integer | no | A안 투자금 |
| `scenario_a_subsidy_manwon` | integer | no | A안 예상 지원금 |
| `scenario_b_investment_manwon` | integer | no | B안 투자금 |
| `scenario_b_subsidy_manwon` | integer | no | B안 예상 지원금 |
| `new_energy_cost_annual` | integer | no | 개선 후 예상 에너지 비용 |
| `expected_capacity_value` | double precision | no | 개선 후 예상 생산능력 |
| `created_at` | timestamp | no | 생성일 |

<!-- 변경 -->
로컬 모델 `RoiOutput` 중복 정의를 제거하고, 단일 모델로 정리했다.

<!-- 주의 -->
현재 `/api/analyze` 저장 payload는 `company_id`, `equipment_id`, `roi_data`, `created_at`만 넣는다.  
시나리오별 투자금/지원금 컬럼을 별도 컬럼으로도 채울지는 추가 결정이 필요하다.

## 7. `policy`

지원사업 원본 데이터.

| Column | Type | Note |
|---|---|---|
| `policy_id` | text | 정책 ID |
| `title` | text | 제목 |
| `organization` | text | 기관 |
| `max_amount` | integer | 최대 지원금 |
| `deadline` | date | 마감일 |
| `industry_codes` | jsonb | 대상 업종코드 |
| `region` | text | 대상 지역 |
| `url` | text | 원문 URL |
| `summary` | text | 요약 |
| `raw_text` | text | 원문/추출 텍스트 |
| `eligible_company_types` | text[] | 대상 기업유형 |
| `employee_min` / `employee_max` | integer | 직원수 조건 |
| `revenue_min_manwon` / `revenue_max_manwon` | bigint | 매출 조건 |
| `company_age_min` / `company_age_max` | integer | 업력 조건 |
| `revenue_rules` | jsonb | 복합 매출 조건 |

<!-- 변경 -->
정책 후보 raw 조회는 `policy.industry_codes`를 기준으로 한다.  
단수 `industry_code`가 아니라 복수 `industry_codes`가 실제 DB 컬럼이다.

## 8. `matched_policy`

AI 추천 정책 결과 저장 테이블.

| Column | Type | Note |
|---|---|---|
| `matched_policy_id` | uuid | PK |
| `company_id` | uuid | company FK |
| `equipment_id` | uuid | equipment FK |
| `policy_id` | text | policy FK |
| `title` | text | 정책명 |
| `match_score` | numeric | 최종 매칭 점수 |
| `eligible` | boolean | 적합 여부 |
| `reason` | text | 추천 이유 |
| `llm_score` | text | LLM 별점 |
| `scenario_match` | jsonb | a/b/c 시나리오 매칭 태그 |
| `scenario_label` | text | 시나리오 표시 라벨 |
| `created_at` | timestamptz | 생성일 |

<!-- 추가/변경 -->
`scenario_match`, `scenario_label`은 `matched_policy` DB 저장 컬럼으로 확정한다.

`scenario_match` 기준:

```txt
["a"] = A안 전체교체 적합
["b"] = B안 부분개선 적합
["c"] = C안 공통 적합
```

`scenario_label` 예:

```txt
A안 전체교체 적합
B안 부분개선 적합
C안 공통 적합
```

<!-- 변경 -->
`match_score`에는 현재 `hybrid_score -> final_score -> distance 기반 score` 순서로 최종 점수를 저장한다.

<!-- 주의 -->
`final_score`, `hybrid_score`는 응답/연산용 필드이며, 현재 DB에는 별도 컬럼으로 저장하지 않는다.

## 9. `draft_result`

신청서 초안 결과 저장 테이블.

| Column | Type | Required | Note |
|---|---|---:|---|
| `draft_result_id` | uuid | yes | PK |
| `company_id` | uuid | no | company FK |
| `equipment_id` | uuid | no | equipment FK |
| `policy_id` | text | no | policy FK |
| `draft_content` | jsonb | yes | 신청서 초안 내용 |
| `created_at` | timestamptz | yes | 생성일 |

<!-- 변경 -->
`draft_content`는 필수 컬럼이다.

<!-- 삭제/변경 -->
`draft_result.scenario`는 사용하지 않는다.  
신청서 초안 생성 시나리오 구분은 `matched_policy.scenario_match`, `matched_policy.scenario_label`을 기준으로 한다.

## 10. Analyze Response-Only Structures

DB 테이블은 아니지만 `/api/analyze` 응답에 포함되는 구조.

### `raw_candidates`

<!-- 추가 -->
정책 DB에서 company 조건으로 1차 필터링된 후보 전체.  
LLM 평가 전 목록이며 점수/순위/reason은 갖지 않는다.

```json
{
  "policy_id": "policy-id",
  "title": "정책명",
  "organization": "기관명",
  "url": "https://...",
  "deadline": "2026-06-30",
  "max_amount": 50000,
  "industry_code": ["C25"],
  "region": "전국"
}
```

### `matched_policies`

LLM 재평가까지 끝난 최종 추천 목록.

```json
{
  "id": "policy-id",
  "metadata": {},
  "scenario_match": ["c"],
  "scenario_label": "C안 공통 적합",
  "final_score": 0.83,
  "hybrid_score": 0.78,
  "llm_score": "●●●●○",
  "reason": "추천 이유"
}
```

## 11. RLS / Security

| Table | Access Rule |
|---|---|
| `user_profile` | `user_profile.user_id = auth.uid()` |
| `company` | `company.user_id = auth.uid()` |
| `equipment` | equipment.company_id가 본인 company_id |
| `roi_output` | roi_output.company_id가 본인 company_id |
| `matched_policy` | matched_policy.company_id가 본인 company_id |
| `draft_result` | draft_result.company_id가 본인 company_id |

## 12. Deprecated

| Column/Table/API | Status | Reason |
|---|---|---|
| `profiles` | 삭제 | `user_profile` 사용 |
| `company_size` | 삭제 | `company_type`으로 통일 |
| `roi_input` | 삭제/미사용 | ROI 입력은 company/equipment 기반 |
| `draft_result.scenario` | 삭제/미사용 | 시나리오 구분은 `matched_policy.scenario_match`, `scenario_label` 기준 |
| `equipment.user_status` | 삭제 | 최종 마이페이지 화면에 없음 |
| `equipment.system_status` | 삭제 | user_status 삭제에 따라 제거 |
| `equipment.status_reason` | 삭제 | user_status 삭제에 따라 제거 |
| `/api/analyze` 내부 draft 생성 | 분리 | `/api/draft`로 분리 |
