# ROI API 테스트 케이스

작성일: 2026.06.09

## 목적

이 문서는 `/api/roi/simulate` REST API와 `calculate_roi()` 계산 로직을 검증하기 위한 개발자용 테스트 문서임.

LangGraph 자연어 흐름, RAG 정책 추천, 정보 재질문 흐름은 이 문서의 대상이 아님. 그 흐름은 `demo_chat_flow_test_cases.md`에서 따로 검증함.

## 테스트 대상

- API: `POST /api/roi/simulate`
- 내부 함수: `backend/app/tools/roi_calc.py`의 `calculate_roi()`
- 라우터: `backend/app/routers/roi.py`

## 현재 응답 형식

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

## 공통 확인 필드

| 필드 | 확인 기준 |
|---|---|
| `success` | 정상 케이스에서 `true`여야 함 |
| `data.scenario_a` | 존재해야 함 |
| `data.scenario_b` | 존재해야 함 |
| `data.ai_recommendation` | 존재해야 함 |
| `data.data_quality` | 존재해야 함 |
| `data.benchmark` | 존재해야 함 |
| `data.equipment_status` | 존재해야 함 |

## 시나리오 카드 필수 필드

`scenario_a`, `scenario_b` 공통 필드 기준임.

| 필드 | 의미 | 확인 기준 |
|---|---|---|
| `label` | 방안명 | 문자열이어야 함 |
| `investment_manwon` | 총 투자금 | 0보다 큰 숫자여야 함 |
| `subsidy_manwon` | 예상 지원금 | 0 이상 숫자여야 함 |
| `net_investment_manwon` | 순 기업 부담금 | 0 이상 숫자여야 함 |
| `annual_net_benefit_manwon` | 연간 순효과 | 숫자여야 함 |
| `payback_years` | 투자 회수기간 | `null`이 아니어야 함 |
| `roi_pct` | ROI | `null`이 아니어야 함 |
| `breakdown.energy_saving_manwon` | 에너지비 절감 | 0 이상 숫자여야 함 |
| `breakdown.maintenance_saving_manwon` | 유지보수비 절감 | 0 이상 숫자여야 함 |
| `breakdown.defect_saving_manwon` | 불량비용 절감 | 0 이상 숫자여야 함 |

## TC-ROI-01 | 박 차장 데모 기준 프레스 설비

### 입력

```json
{
  "equipment": {
    "name": "노후 프레스 라인 A",
    "category": "press",
    "age_years": 15,
    "energy_cost_annual": 4800,
    "defect_rate": 3.2,
    "capacity_value": 250
  }
}
```

### 기대 응답

- `success == true`여야 함
- `data.scenario_a`가 존재해야 함
- `data.scenario_b`가 존재해야 함
- `data.scenario_a.investment_manwon > 0`이어야 함
- `data.scenario_b.investment_manwon > 0`이어야 함
- `data.scenario_a.payback_years != null`이어야 함
- `data.scenario_b.payback_years != null`이어야 함
- `data.ai_recommendation.decision`은 `"A"` 또는 `"B"`여야 함
- `data.data_quality.level`은 현재 입력 기준 `medium` 수준으로 나오는 것이 정상임

## TC-ROI-02 | CNC 설비, capacity_value 없음

### 입력

```json
{
  "equipment": {
    "name": "CNC 선반 B-3호기",
    "category": "cnc",
    "age_years": 11,
    "energy_cost_annual": 3200,
    "defect_rate": 2.1,
    "capacity_value": null
  }
}
```

### 기대 응답

- `success == true`여야 함
- `data.scenario_a`와 `data.scenario_b`가 존재해야 함
- 투자금이 `null`이 아니라 업종 평균/기본 추정값으로 계산되어야 함
- `data.data_quality.level == "low"`여야 함
- `data.data_quality.missing_fields`에 `capacity_value`가 포함되어야 함
- `data.ai_recommendation.next_questions`가 존재해야 함

## TC-ROI-03 | 사출성형기, 불량률 있음

### 입력

```json
{
  "equipment": {
    "name": "자동 사출성형기 I-5",
    "category": "injection",
    "age_years": 9,
    "energy_cost_annual": 2600,
    "defect_rate": 4.1,
    "capacity_value": 120
  }
}
```

### 기대 응답

- `success == true`여야 함
- `data.scenario_a`와 `data.scenario_b`가 존재해야 함
- `breakdown.defect_saving_manwon`이 0 이상이어야 함
- `breakdown.energy_saving_manwon`이 0 이상이어야 함
- `data.ai_recommendation.decision`은 `"A"` 또는 `"B"`여야 함
- `data.data_quality.level`이 존재해야 함

## TC-ROI-04 | 프레스 설비, 입력 데이터 부족

### 입력

```json
{
  "equipment": {
    "name": "노후 프레스 C라인",
    "category": "press",
    "age_years": 8,
    "energy_cost_annual": 3000
  }
}
```

### 기대 응답

- `success == true`여야 함
- 계산은 정상 완료되어야 함
- `data.scenario_a`와 `data.scenario_b`가 존재해야 함
- `data.data_quality.level == "low"`여야 함
- `data.data_quality.missing_fields`에 `defect_rate`가 포함되어야 함
- `data.data_quality.missing_fields`에 `capacity_value`가 포함되어야 함
- `data.ai_recommendation.confidence_score`가 낮게 나와야 함
- `data.ai_recommendation.next_questions`가 존재해야 함

## TC-ROI-05 | 투자금 직접 입력

### 입력

```json
{
  "equipment": {
    "name": "CNC 머시닝센터 M-2",
    "category": "cnc",
    "age_years": 13,
    "energy_cost_annual": 2900,
    "defect_rate": 1.9,
    "capacity_value": 80
  },
  "scenario_a_investment_manwon": 15000,
  "scenario_a_subsidy_manwon": 6000,
  "scenario_b_investment_manwon": 4000,
  "scenario_b_subsidy_manwon": 1500
}
```

### 기대 응답

- `success == true`여야 함
- `data.scenario_a.investment_manwon == 15000`이어야 함
- `data.scenario_a.subsidy_manwon == 6000`이어야 함
- `data.scenario_b.investment_manwon == 4000`이어야 함
- `data.scenario_b.subsidy_manwon == 1500`이어야 함
- 직접 입력한 투자금과 지원금이 추정값보다 우선 적용되어야 함

## TC-ROI-06 | 지원하지 않는 설비 category

### 입력

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

### 현재 기대 동작

- 현재 계산기 API 기준으로는 `calculate_roi()` 내부에서 `ValueError`가 발생할 수 있음
- graceful error response가 아직 미구현이면 개선 필요 항목으로 관리함

### 권장 완료 기준

- HTTP 400으로 반환해야 함
- 메시지에 지원하지 않는 설비 category임을 표시해야 함
- `supported_categories: ["press", "cnc", "injection"]`를 반환하면 좋음

## TC-ROI-07 | 필수값 energy_cost_annual 누락

### 입력

```json
{
  "equipment": {
    "name": "노후 프레스 A라인",
    "category": "press",
    "age_years": 12
  }
}
```

### 기대 응답

- FastAPI/Pydantic 검증 실패가 발생해야 함
- HTTP 422가 반환되어야 함
- 이 케이스는 `/api/chat`의 정보 재질문 흐름과 다름

## TC-ROI-08 | category 오타 입력

### 입력

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

### 현재 기대 동작

- 현재 계산기 API 기준으로는 `ValueError`가 발생할 수 있음
- graceful error response가 아직 미구현이면 개선 필요 항목으로 관리함

### 권장 완료 기준

- HTTP 400으로 반환해야 함
- 메시지에 지원하지 않는 설비 category임을 표시해야 함
- `supported_categories: ["press", "cnc", "injection"]`를 반환하면 좋음

## 완료 기준

| 항목 | 완료 기준 |
|---|---|
| 정상 케이스 | TC-ROI-01~05가 모두 `success: true`로 응답함 |
| 시나리오 구조 | `scenario_a`, `scenario_b`가 모두 반환됨 |
| AI 추천 | `ai_recommendation`이 반환됨 |
| 데이터 품질 | `data_quality`가 반환되고 부족 필드가 표시됨 |
| 투자금 추정 | capacity_value가 없어도 투자금이 `null`로 끝나지 않음 |
| 직접 입력값 | 직접 입력한 투자금/지원금이 우선 적용됨 |
| 예외 케이스 | TC-ROI-06~08은 500이 아닌 graceful 처리로 개선 필요함 |

## 프론트 연결 기준

`RoiPage.tsx`에서 API를 연결할 때는 아래 항목을 실제 응답값으로 렌더링해야 함.

- 시나리오 A 카드
- 시나리오 B 카드
- 총 투자금
- 예상 지원금
- 순 기업 부담금
- 연간 순효과
- 투자 회수기간
- ROI
- 에너지비 절감
- 유지보수비 절감
- 불량비용 절감
- AI 추천 시나리오
- 추천 이유
- 리스크
- 추가 질문

## 현재 주의사항

- 이 문서는 계산기 API 기준 문서임
- 미지원 설비를 RAG로 다시 찾는 흐름은 `/api/chat`에서 검증해야 함
- 박 차장 데모 전체 흐름은 `demo_chat_flow_test_cases.md`를 기준으로 봐야 함
