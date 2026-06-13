# 팩토핏 데모 기준 + 테스트 케이스 v2

작성일: 2026.06.09

## 1. 데모 기준

### 박 차장 시나리오 공통 입력값

대상 API는 `POST /api/roi/simulate`로 정했음.

요청 형식은 아래와 같음.

```json
{
  "equipment": {
    "name": "유압 프레스 라인 A",
    "category": "press",
    "age_years": 15,
    "energy_cost_annual": 4800,
    "defect_rate": 3.2,
    "current_capacity_value": 250
  }
}
```

현재 API 응답 형식은 아래와 같음.

```json
{
  "success": true,
  "data": {
    "scenario_a": {},
    "scenario_b": {},
    "recommended": "A",
    "ai_recommendation": {},
    "data_quality": {},
    "benchmark": {},
    "equipment_status": {}
  }
}
```

### ROI 카드 필수 필드

`scenario_a`, `scenario_b` 공통 필드는 아래와 같음.

| API 필드 | 화면 표시명 | 검증 기준 |
|---|---|---|
| `label` | 방안명 | 문자열 존재 |
| `investment_manwon` | 총 투자금 | 0보다 큰 숫자 |
| `subsidy_manwon` | 예상 지원금 | 0 이상 숫자 |
| `net_investment_manwon` | 실 기업 부담금 | 0 이상 숫자 |
| `annual_net_benefit_manwon` | 연간 순효과 | 0 이상 숫자 |
| `payback_years` | 투자 회수기간 | null이 아니어야 함 |
| `roi_pct` | ROI % | null이 아니어야 함 |
| `breakdown.energy_saving_manwon` | 에너지비 절감 | 0 이상 숫자 |
| `breakdown.maintenance_saving_manwon` | 유지보수비 절감 | 0 이상 숫자 |
| `breakdown.defect_saving_manwon` | 불량비용 절감 | 0 이상 숫자 |

### AI 추천 영역 필수 필드

| API 필드 | 화면 표시명 | 검증 기준 |
|---|---|---|
| `ai_recommendation.decision` | 추천 시나리오 | `"A"` 또는 `"B"` |
| `ai_recommendation.confidence_score` | 신뢰도 | 0~1 숫자 |
| `ai_recommendation.summary` | 한 줄 추천 | 문자열 존재 |
| `ai_recommendation.top_reasons` | 추천 이유 | 배열 |
| `ai_recommendation.risks` | 리스크 | 배열 |
| `ai_recommendation.next_questions` | 추가 질문 | 배열 |

## 2. 정상 테스트 케이스

### TC-01 | 박 차장 시나리오: 유압 프레스

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "유압 프레스 라인 A",
    "category": "press",
    "age_years": 15,
    "energy_cost_annual": 4800,
    "defect_rate": 3.2,
    "current_capacity_value": 250
  }
}
```

기대 응답은 아래와 같음.

- `success == true`여야 함
- `data.scenario_a`가 존재해야 함
- `data.scenario_b`가 존재해야 함
- `data.scenario_a.investment_manwon > 0`이어야 함
- `data.scenario_b.investment_manwon > 0`이어야 함
- `data.scenario_a.payback_years != null`이어야 함
- `data.scenario_b.payback_years != null`이어야 함
- `data.ai_recommendation.decision == "A"`여야 함
- `data.data_quality.level == "medium"`이어야 함

현재 입력값은 optional field 5개 중 `defect_rate`, `current_capacity_value`만 있으므로 `data_quality.level`은 `medium`이 정상임.

기대 화면은 아래와 같음.

- 시나리오 A/B 카드가 모두 렌더링되어야 함
- A 카드에 AI 추천 표시가 보여야 함
- 총 투자금, 예상 지원금, 실 기업 부담금이 보여야 함
- 투자 회수기간과 ROI가 보여야 함
- 신뢰도 숫자가 보여야 함

### TC-02 | CNC / C24 / current_capacity_value 없음

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "CNC 선반 B-3호기",
    "category": "cnc",
    "age_years": 11,
    "energy_cost_annual": 3200,
    "defect_rate": 2.1,
    "current_capacity_value": null
  }
}
```

기대 응답은 아래와 같음.

- `success == true`여야 함
- `data.scenario_a`가 존재해야 함
- `data.scenario_b`가 존재해야 함
- `data.scenario_a.investment_manwon > 0`이어야 함
- `data.scenario_b.investment_manwon > 0`이어야 함
- `data.data_quality.level == "low"`여야 함
- `data.data_quality.missing_fields`에 `current_capacity_value`가 포함되어야 함
- `data.ai_recommendation.next_questions` 배열이 존재해야 함

현재 코드에서는 `current_capacity_value`가 없어도 업종 평균 투자금 폴백으로 계산됨.

기대 화면은 아래와 같음.

- A/B 카드가 정상 렌더링되어야 함
- 데이터 부족 안내가 보여야 함
- 추가 입력 권장 질문이 보여야 함

### TC-03 | 사출성형기 / 불량률 있음

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "자동 사출성형기 I-5",
    "category": "injection",
    "age_years": 9,
    "energy_cost_annual": 2600,
    "defect_rate": 4.1,
    "current_capacity_value": 120
  }
}
```

기대 응답은 아래와 같음.

- `success == true`여야 함
- `data.scenario_a`가 존재해야 함
- `data.scenario_b`가 존재해야 함
- `data.scenario_a.breakdown.defect_saving_manwon >= 0`이어야 함
- `data.scenario_b.breakdown.defect_saving_manwon >= 0`이어야 함
- `data.ai_recommendation.decision`은 `"A"` 또는 `"B"`여야 함
- `data.data_quality.level`이 존재해야 함

기대 화면은 아래와 같음.

- 불량비용 절감 항목이 보여야 함
- 에너지비 절감 항목이 보여야 함
- 추천 시나리오가 보여야 함

### TC-04 | press / 입력 데이터 부족

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "유압 프레스 C라인",
    "category": "press",
    "age_years": 8,
    "energy_cost_annual": 3000
  }
}
```

기대 응답은 아래와 같음.

- `success == true`여야 함
- 계산은 정상 완료되어야 함
- `data.scenario_a`가 존재해야 함
- `data.scenario_b`가 존재해야 함
- `data.data_quality.level == "low"`여야 함
- `data.data_quality.missing_fields`에 `defect_rate`가 포함되어야 함
- `data.data_quality.missing_fields`에 `current_capacity_value`가 포함되어야 함
- `data.ai_recommendation.confidence_score < 0.7`이어야 함
- `data.ai_recommendation.next_questions` 배열이 존재해야 함

기대 화면은 아래와 같음.

- 데이터 부족 안내가 보여야 함
- 추가 입력 질문이 보여야 함
- A/B 카드 자체는 깨지지 않고 보여야 함

### TC-05 | CNC / 투자금 직접 입력

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "CNC 머시닝센터 M-2",
    "category": "cnc",
    "age_years": 13,
    "energy_cost_annual": 2900,
    "defect_rate": 1.9,
    "current_capacity_value": 80
  },
  "scenario_a_investment_manwon": 15000,
  "scenario_a_subsidy_manwon": 6000,
  "scenario_b_investment_manwon": 4000,
  "scenario_b_subsidy_manwon": 1500
}
```

기대 응답은 아래와 같음.

- `success == true`여야 함
- `data.scenario_a.investment_manwon == 15000`이어야 함
- `data.scenario_a.subsidy_manwon == 6000`이어야 함
- `data.scenario_b.investment_manwon == 4000`이어야 함
- `data.scenario_b.subsidy_manwon == 1500`이어야 함
- 직접 입력값이 추정값보다 우선 적용되어야 함

기대 화면은 아래와 같음.

- 입력 투자금 기준 계산 결과가 보여야 함
- A/B 카드가 정상 렌더링되어야 함

## 3. 예외 테스트 케이스

### TC-06 | 지원하지 않는 설비 카테고리

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "레이저 커팅기",
    "category": "laser_cutter",
    "age_years": 6,
    "energy_cost_annual": 1800
  }
}
```

현재 기대 응답은 아래와 같음.

- 현재 코드 기준으로는 `calculate_roi()` 내부에서 `ValueError` 발생 가능성이 있음
- FastAPI 레벨에서 graceful error wrapping은 아직 미구현 상태임
- 개선 필요 항목으로 관리해야 함

권장 완료 기준은 아래와 같음.

- HTTP 400을 반환해야 함
- 메시지는 `"지원하지 않는 설비 카테고리입니다: laser_cutter"` 형식이어야 함
- `supported_categories: ["press", "cnc", "injection"]`를 반환해야 함

### TC-07 | energy_cost_annual 누락

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "유압 프레스 A라인",
    "category": "press",
    "age_years": 12
  }
}
```

현재 기대 응답은 아래와 같음.

- FastAPI/Pydantic 검증 실패가 발생해야 함
- HTTP 422가 반환되어야 함

권장 화면은 아래와 같음.

- 필수 입력값 누락 안내가 보여야 함
- `"연간 에너지비용을 입력해주세요"` 메시지가 보여야 함

`info_missing` intent는 `/api/chat` 자연어 입력 흐름에서 별도로 검증해야 함.

### TC-08 | category 오타 입력

대상 API는 `POST /api/roi/simulate`로 정함.

입력값은 아래와 같음.

```json
{
  "equipment": {
    "name": "프레스기",
    "category": "pres",
    "age_years": 10,
    "energy_cost_annual": 3000
  }
}
```

현재 기대 응답은 아래와 같음.

- 현재 코드 기준으로는 `ValueError` 발생 가능성이 있음
- graceful error response는 아직 미구현 상태임
- 개선 필요 항목으로 관리해야 함

권장 완료 기준은 아래와 같음.

- HTTP 400을 반환해야 함
- 메시지는 `"지원하지 않는 설비 카테고리입니다: pres"` 형식이어야 함
- `supported_categories: ["press", "cnc", "injection"]`를 반환해야 함

### TC-09 | 정책 추천 결과 없음

대상 API는 `POST /api/chat`으로 정함.

입력값은 아래와 같음.

```json
{
  "company_id": "",
  "message": "Z99 업종 인도 지역 설비 보조금 찾아줘",
  "chat_history": []
}
```

기대 응답은 아래와 같음.

- 서버 오류 없이 응답해야 함
- `intent == "policy"` 또는 fallback intent여야 함
- `matched_policies`가 비어도 에러가 나지 않아야 함
- `response`에 조건에 맞는 공고가 없다는 취지의 안내가 포함되어야 함

현재 정책 매칭은 ChromaDB ingest 상태에 의존함.

### TC-10 | LLM 응답 파싱 실패 시 fallback

대상 API는 `POST /api/chat`으로 정함.

시나리오는 아래와 같음.

- LLM이 JSON 형식이 아닌 자연어로 응답함
- 또는 코드블록 형식이 깨져서 JSON parsing이 실패함

기대 동작은 아래와 같음.

- HTTP 500이 아니라 정상 응답을 반환해야 함
- `final_response`에 최소한의 텍스트 응답이 포함되어야 함
- 콘솔에는 파싱 실패 로그가 남을 수 있음
- 프론트는 에러 화면 대신 일반 답변 또는 재시도 안내를 보여야 함

## 4. 프론트 완료 기준

현재 `RoiPage.tsx`는 하드코딩 상태이므로 아래 기준을 만족해야 데모 완료로 봄.

### ROI 페이지 API 연결 기준

- `/api/roi/simulate`를 호출해야 함
- 응답의 `data.scenario_a`로 A 카드를 렌더링해야 함
- 응답의 `data.scenario_b`로 B 카드를 렌더링해야 함
- 응답의 `data.ai_recommendation`으로 추천 영역을 렌더링해야 함
- 하드코딩 숫자를 제거해야 함
- loading 상태를 표시해야 함
- error 상태를 표시해야 함
- success 상태를 표시해야 함

### 필수 화면 필드

- 총 투자금
- 예상 지원금
- 실 기업 부담금
- 연간 순효과
- 투자 회수기간
- ROI %
- 에너지비 절감
- 유지보수비 절감
- 불량비용 절감
- AI 추천 시나리오
- 신뢰도
- 추천 이유
- 리스크
- 추가 질문

## 5. 완료 기준

| 항목 | 완료 기준 |
|---|---|
| TC-01~05 정상 케이스 | 5개 모두 API 응답 구조 정상 |
| TC-06~08 예외 케이스 | 500 없이 graceful 처리 또는 개선 필요 항목으로 명시 |
| TC-09~10 LLM/RAG 예외 | 서버 오류 없이 fallback 응답 |
| ROI API | `success`, `data.scenario_a`, `data.scenario_b` 반환 |
| 프론트 ROI 화면 | 실제 API 응답으로 A/B 카드 렌더링 |
| AI 추천 영역 | decision / confidence / top_reasons 표시 |
| 상태 처리 | loading / error / success 3상태 구현 |
| 데이터 품질 안내 | low/medium/high에 따라 안내 문구 표시 |
