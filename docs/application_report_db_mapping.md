# FactoFit 신청서 PDF 리포트 DB 연결 명세

작성일: 2026-06-19

## 1. 전체 연결 흐름

```text
Frontend
  → POST /api/reports/application.pdf
  → 사용자 인증
  → Supabase 테이블 조회
  → 계산 및 보고서 문장 생성
  → PDF 파일 반환
```

관련 코드:

- `frontend/src/pages/ApplicationDraftPage.tsx`
- `backend/app/routers/reports.py`
- `backend/app/services/application_report.py`
- `backend/app/core/database.py`

### API 요청

```json
{
  "company_id": "회사 UUID",
  "equipment_id": "설비 UUID",
  "policy_id": "정책 ID",
  "tone": "submission"
}
```

| `tone` | 문체 |
|---|---|
| `submission` | 높임말 종결체 |
| `analyst` | 평서문 종결체 |
| `nominal` | 명사형 종결체 |

현재 프론트엔드는 `tone`을 생략하며 기본값인 `submission`을 사용한다.

## 2. 직접 조회하는 Supabase 테이블

| 테이블 | 조회 조건 | 용도 |
|---|---|---|
| `company` | `company_id`, 로그인 사용자의 `user_id` | 신청기업 기본정보와 매출정보 |
| `equipment` | `company_id`, `equipment_id` | 설비 현황, 생산량, 운영비용 |
| `roi_output` | 회사·설비 기준 최신 `created_at` 1건 | ROI 시나리오, 절감액, 업종 평균 |
| `matched_policy` | 회사·설비·정책 기준 최고 `match_score` 1건 | 정책 적합도, 적격 여부, 추천 근거 |
| `policy` | `policy_id` | 정책 원문, 지원조건, 지원한도, 출처 |
| `draft_result` | 회사·설비·정책 기준 최신 `created_at` 1건 | 기존 AI 초안 |

> `draft_result`는 현재 조회하지만 최종 PDF 본문에는 사실상 사용하지 않는다.

## 3. 신청기업 개요

`company` 테이블을 사용한다.

| 보고서 항목 | DB 컬럼 |
|---|---|
| 기업명 | `company.company_name` |
| 기업 규모 | `company.company_type` 또는 `company.company_size` |
| 설립연도 | `company.established_year` |
| 사업장 형태 | `company.workplace_type` |
| 업종명 | `company.industry_name` |
| 업종코드 | `company.industry_code` |
| 지역 | `company.region` |
| 직원 수 | `company.employee_count` |
| 최근 연 매출 | `company.annual_revenue` |
| 2년 전 매출 | `company.revenue_2y_ago_manwon` |
| 3년 전 매출 | `company.revenue_3y_ago_manwon` |

매출 추이 그래프는 최근 연 매출과 과거 매출 중 두 개 이상의 값이 존재할 때 표시한다.

## 4. 설비 현황

`equipment` 테이블을 사용한다.

| 보고서 항목 | DB 컬럼 |
|---|---|
| 설비명 | `equipment.name` |
| 설비 분류 | `equipment.category` |
| 공정 | `equipment.process` |
| 사용연수 | `equipment.age_years` |
| 불량률 | `equipment.defect_rate` |
| 연간 생산량 | `equipment.production_qty` |
| 연간 에너지비 | `equipment.energy_cost_annual` |
| 연간 유지보수비 | `equipment.maintenance_cost_annual` |
| 제품 개당 예상이익 | `equipment.contribution_margin_won` |
| 전체교체 예상 투자금 | `equipment.scenario_a_investment_manwon` |
| 부분개선 예상 투자금 | `equipment.scenario_b_investment_manwon` |

> 실제 설비명 컬럼은 `equipment.equipment_name`이 아니라 `equipment.name`이다.

## 5. ROI 분석

ROI 데이터는 `roi_output.roi_data` JSON에 저장된다.

```text
roi_data
├─ recommended
├─ scenario_a
├─ scenario_b
├─ benchmark
├─ ai_recommendation
├─ data_quality
└─ equipment_status
```

### 시나리오 선택 순서

1. `matched_policy.scenario_match`를 확인한다.
2. 값이 없으면 `roi_data.recommended`를 확인한다.
3. 둘 다 없으면 `scenario_a`를 사용한다.

### 선택 시나리오

| 보고서 항목 | JSON 경로 |
|---|---|
| 시나리오명 | `scenario.label` |
| 총 투자금 | `scenario.investment_manwon` |
| 지원금 | `scenario.subsidy_manwon` |
| 순투자금 | `scenario.net_investment_manwon` |
| 연간 순편익 | `scenario.annual_net_benefit_manwon` |
| 회수기간 | `scenario.payback_years` |
| ROI | `scenario.roi_pct` |

### 절감액

| 보고서 항목 | JSON 경로 |
|---|---|
| 에너지 절감액 | `scenario.breakdown.energy_saving_manwon` |
| 에너지 절감 계산 근거 | `scenario.breakdown.energy_saving_method` |
| 유지보수 절감액 | `scenario.breakdown.maintenance_saving_manwon` |
| 불량비용 절감액 | `scenario.breakdown.defect_saving_manwon` |
| 불량비용 계산 근거 | `scenario.breakdown.defect_saving_method` |

### 업종 평균

| 보고서 항목 | JSON 경로 |
|---|---|
| 평균 교체주기 | `roi_data.benchmark.avg_replacement_cycle_yr` |
| 평균 불량률 | `roi_data.benchmark.avg_defect_rate_pct` |
| 평균 에너지비 | `roi_data.benchmark.avg_energy_cost_manwon` |
| 업종 평균 대비 에너지비 | `roi_data.benchmark.energy_vs_avg` |
| 비교자료 출처 | `roi_data.benchmark.sources` |

### AI 판단 및 데이터 품질

| 보고서 항목 | JSON 경로 |
|---|---|
| AI 추천 내용 | `roi_data.ai_recommendation` |
| 데이터 품질 | `roi_data.data_quality` |

## 6. 정책 매칭 결과

`matched_policy` 테이블을 사용한다.

| 보고서 항목 | DB 컬럼 |
|---|---|
| 추천 적합도 | `matched_policy.match_score` |
| 적격 판정 | `matched_policy.eligible` |
| 매칭 판단 근거 | `matched_policy.reason` |
| 적용 가능 시나리오 | `matched_policy.scenario_match` |
| 시나리오 표시명 | `matched_policy.scenario_label` |
| 정책 ID | `matched_policy.policy_id` |
| 정책 제목 | `matched_policy.title` |
| LLM 점수 | `matched_policy.llm_score` |

보고서의 매칭 판단 근거 영역은 다음 컬럼을 사용한다.

```text
matched_policy.match_score
matched_policy.eligible
matched_policy.reason
```

## 7. 정책 원문 및 지원조건

`policy` 테이블을 사용한다.

| 보고서 항목 | DB 컬럼 |
|---|---|
| 지원사업명 | `policy.title` |
| 주관기관 | `policy.organization` |
| 대상 업종 | `policy.industry_codes` |
| 대상 기업 유형 | `policy.eligible_company_types` |
| 지역 조건 | `policy.region` |
| 최소 직원 수 | `policy.employee_min` |
| 최대 직원 수 | `policy.employee_max` |
| 최소 매출 | `policy.revenue_min_manwon` |
| 최대 매출 | `policy.revenue_max_manwon` |
| 기업 최소 업력 | `policy.company_age_min` |
| 기업 최대 업력 | `policy.company_age_max` |
| 지원내용 요약 | `policy.eligibility_text` |
| 정책 원문 발췌 | `policy.eligibility_evidence` |
| 자격 추출 상태 | `policy.eligibility_extraction_status` |
| 지원 한도 | `policy.max_amount` |
| 지원 한도 설명 | `policy.max_amount_note` |
| 금액 추출 위치 | `policy.max_amount_source` |
| 금액 추출 근거 | `policy.max_amount_evidence` |
| 금액 추출 상태 | `policy.amount_extraction_status` |
| 수집처 | `policy.source_name` |
| 원본 공고 ID | `policy.source_id` |
| 원문 URL | `policy.url` |
| 정책 요약 | `policy.summary` |
| 원본 텍스트 | `policy.raw_text` |
| 원본 JSON | `policy.raw_json` |

### AI 스마트공장 지원 문장

“AI에이전트, 온디바이스AI 등을 활용해…” 문장은 다음 컬럼에서 가져온다.

| 구분 | DB 컬럼 |
|---|---|
| 지원내용 요약 | `policy.eligibility_text` |
| 정책 원문 발췌 | `policy.eligibility_evidence` |
| 수집처 | `policy.source_name` |
| 공고 원문 | `policy.url` |
| 지원 한도 | `policy.max_amount` |

해당 문장은 신청자격이 아니라 지원 범위와 지원 한도를 설명하는 근거이다.

## 8. 자동 계산값

### 자기부담금

```text
자기부담금 = 총 투자금 - 정부 지원금
```

### 예상 회수기간

```text
회수기간(개월) = scenario.payback_years × 12
```

### 연간 운영비

```text
연간 운영비
  = equipment.energy_cost_annual
  + equipment.maintenance_cost_annual
```

### 지원금 비율

```text
지원금 비율
  = scenario.subsidy_manwon
  ÷ scenario.investment_manwon
  × 100
```

### 적합도 점수 보정

`matched_policy.match_score`가 0보다 크고 1 이하이면 100을 곱한다.

```text
0.7 → 70점
```

### 지원금 대체값

`scenario.subsidy_manwon`이 없고 `policy.max_amount`가 있으면 다음 값을 사용한다.

```python
min(
    scenario.investment_manwon,
    policy.max_amount,
)
```

## 9. PDF 섹션별 연결

| PDF 섹션 | 사용 데이터 |
|---|---|
| 1. 신청기업 개요 | `company` |
| 2. 설비 현황 및 사업 필요성 | `equipment`, `roi_data.benchmark` |
| 3. 사업 목적 및 추진내용 | `matched_policy.scenario_label`, 선택된 ROI 시나리오 |
| 4. 지원사업 적합성 | `company`, `matched_policy`, `policy` |
| 5. 기대효과 | 선택 시나리오의 `breakdown`, `annual_net_benefit_manwon` |
| 6. 예산계획 | 투자금, 지원금, 정책 한도, 자동 계산값 |
| 7. 추출 근거 및 검토 메모 | `company`, `equipment`, `roi_output`, `matched_policy`, `policy` |

## 10. 인증 및 보안 연결

백엔드는 다음 환경변수로 Supabase에 연결한다.

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

연결 코드:

- `backend/app/core/config.py`
- `backend/app/core/database.py`

리포트 생성 시 기업 조회에는 로그인 사용자의 ID가 포함된다.

```text
company.company_id = API 요청 company_id
company.user_id = 로그인 사용자의 user_id
```

따라서 로그인 사용자가 소유한 회사만 조회할 수 있다.

### 보안 주의사항

- `.env`와 API 키는 Git 저장소에 커밋하지 않는다.
- `BIZINFO_API_KEY`와 `DATA_GO_KR_API_KEY`는 정책 수집 스크립트에서 사용한다.
- PDF 생성 과정에서는 외부 정책 API를 직접 호출하지 않는다.
- PDF 생성 시점에는 Supabase에 저장된 `policy` 데이터를 조회한다.

## 11. 프론트엔드 연결

프론트 파일:

```text
frontend/src/pages/ApplicationDraftPage.tsx
```

초안 결과에서 저장하는 값:

```text
company_id
equipment_id
policy_id
```

PDF 요청:

```http
POST /api/reports/application.pdf
Content-Type: application/json
Authorization: Bearer {access_token}
```

PDF 응답:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename*=UTF-8''...
```

## 12. 백엔드 연결

라우터:

```text
backend/app/routers/reports.py
```

서비스:

```text
backend/app/services/application_report.py
```

라우터 등록:

```text
backend/app/main.py
prefix: /api
```

최종 엔드포인트:

```http
POST /api/reports/application.pdf
```

처리 순서:

1. 로그인 사용자를 확인한다.
2. 요청값을 검증한다.
3. `company`를 조회한다.
4. `equipment`를 조회한다.
5. 최신 `roi_output`을 조회한다.
6. `matched_policy`를 조회한다.
7. `policy`를 조회한다.
8. 최신 `draft_result`를 조회한다.
9. 자동 계산값을 생성한다.
10. 보고서 문장을 생성한다.
11. 그래프와 표를 생성한다.
12. PDF 바이너리를 반환한다.

## 13. 현재 확인사항

- 실제 설비명 컬럼은 `equipment.name`이다.
- `draft_result`는 조회하지만 현재 최종 PDF 문장에는 사용하지 않는다.
- 정책 원문과 지원내용은 `policy` 테이블에 저장된 값을 사용한다.
- ROI 분석값은 `roi_output.roi_data` JSON에서 추출한다.
- 업종 평균값은 `roi_output.roi_data.benchmark`에서 추출한다.
- 높임말 보고서는 `submission` 문체를 사용한다.
- 높임말 본문은 `합니다`, `습니다`, `입니다` 계열의 단정형 종결 조건을 검증한다.
