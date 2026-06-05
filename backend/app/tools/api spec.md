# 팩토핏 API 스펙 초안 


---

## 공통 규칙

- Base URL: `http://localhost:8000/api`
- Content-Type: `application/json`
- 금액 단위: 전부 **만원** 정수
- 에러 응답 형식:
```json
{
  "error": "에러 메시지",
  "code": "ERROR_CODE"
}
```

---

## 1. 온보딩 — 기업 정보 등록

**담당:** 노승유(구현) · 임평우(호출)

```
POST /api/onboarding
```

### 요청
```json
{
  "company_name": "안산금속(주)",
  "industry_code": "C24",
  "region": "경기도 안산시",
  "employee_count": 45,
  "annual_energy_cost": 4800,
  "equipments": [
    {
      "name": "유압 프레스 라인 A",
      "category": "press",
      "age_years": 15,
      "defect_rate": 3.2
    }
  ]
}
```

### 응답
```json
{
  "company_id": "uuid-string",
  "message": "등록 완료",
  "dashboard_ready": true
}
```

### 에러
| 코드 | 상황 |
|---|---|
| `MISSING_FIELD` | 필수값 누락 |
| `INVALID_INDUSTRY` | 업종코드 형식 오류 |

---

## 2. 대시보드 — KPI + 설비 현황

**담당:** 노승유(구현) · 임평우(호출)

```
GET /api/dashboard?company_id={company_id}
```

### 응답
```json
{
  "company_name": "안산금속(주)",
  "kpi": {
    "annual_energy_cost": 4800,
    "energy_vs_avg_pct": 38,
    "avg_equipment_age": 14.2,
    "matched_policies_count": 7,
    "estimated_subsidy_manwon": 20000
  },
  "equipments": [
    {
      "equipment_id": "uuid",
      "name": "유압 프레스 라인 A",
      "category": "press",
      "age_years": 15,
      "status": "danger",
      "status_label": "교체 권고"
    }
  ],
  "urgent_policies": [
    {
      "policy_id": "kiat_2026_001",
      "title": "KIAT 스마트 제조혁신",
      "deadline": "2026-07-15",
      "dday": 42,
      "max_amount": 8000
    }
  ]
}
```

---

## 3. ROI 시뮬레이션

**담당:** 노승유(라우터) · 정유진(roi_calc 연결) · 임평우(호출)

```
POST /api/roi/simulate
```

### 요청
```json
{
  "company_id": "uuid-string",
  "equipment": {
    "name": "유압 프레스 라인 A",
    "category": "press",
    "age_years": 15,
    "energy_cost_annual": 4800,
    "defect_rate": 3.2,
    "maintenance_cost_annual": null,
    "capacity_value": null,
    "production_qty": null,
    "contribution_margin_won": null
  },
  "scenario_a_investment_manwon": null,
  "scenario_a_subsidy_manwon": null,
  "scenario_b_investment_manwon": null,
  "scenario_b_subsidy_manwon": null
}
```

### 응답
```json
{
  "scenario_a": {
    "label": "고효율 프레스 전체 교체",
    "investment_manwon": 18000,
    "subsidy_manwon": 12400,
    "net_investment_manwon": 5600,
    "breakdown": {
      "energy_saving_manwon": 1440,
      "energy_saving_method": "비용 기반 폴백",
      "maintenance_saving_manwon": 660,
      "defect_saving_manwon": 560,
      "defect_saving_method": "업종 평균 기반"
    },
    "annual_net_benefit_manwon": 2660,
    "payback_years": 2.1,
    "roi_pct": 47.5
  },
  "scenario_b": {
    "label": "핵심 부품 교체 + 스마트 모니터링",
    "investment_manwon": 3000,
    "subsidy_manwon": 1500,
    "net_investment_manwon": 1500,
    "breakdown": {
      "energy_saving_manwon": 480,
      "energy_saving_method": "비용 기반 폴백",
      "maintenance_saving_manwon": 300,
      "defect_saving_manwon": 0,
      "defect_saving_method": "절감 없음"
    },
    "annual_net_benefit_manwon": 780,
    "payback_years": 1.9,
    "roi_pct": 52.0
  },
  "recommended": "A",
  "ai_recommendation": {
    "decision": "A",
    "confidence_score": 0.81,
    "summary": "AI는 시나리오 A를 추천합니다. (신뢰도 81%, 데이터 품질 medium)",
    "top_reasons": [
      {
        "factor": "설비 노후도",
        "impact": "high",
        "message": "설비 연령이 업종 평균 교체주기(10년)를 초과했습니다.",
        "source": "법인세법 시행규칙 별표6 구분3"
      }
    ],
    "risks": [
      {
        "type": "cashflow_risk",
        "level": "medium",
        "message": "초기 실투자금이 커서 현금흐름 부담이 있을 수 있습니다."
      }
    ],
    "switching_conditions": [
      {
        "condition": "지원금이 6200만원 이하로 낮아질 경우",
        "effect": "시나리오 B가 더 유리해질 수 있습니다."
      }
    ],
    "next_questions": [
      "연간 생산량과 제품당 기여이익을 입력하면 불량비용 계산이 더 정확해집니다."
    ]
  },
  "data_quality": {
    "score": 0.5,
    "level": "medium",
    "missing_fields": ["maintenance_cost_annual", "capacity_value", "production_qty"],
    "message": "일부 핵심 데이터가 부족합니다."
  },
  "benchmark": {
    "avg_energy_cost_manwon": 3480,
    "avg_defect_rate_pct": 1.8,
    "avg_replacement_cycle_yr": 10,
    "energy_vs_avg": 1.38,
    "sources": {
      "avg_energy_cost": "에너지공단 2023 업종별 에너지소비통계 — 금속가공업(C24)",
      "replacement_cycle": "법인세법 시행규칙 별표6 구분3 — C24 기준내용연수 10년"
    }
  },
  "equipment_status": {
    "age_vs_cycle": 5,
    "is_overdue": true
  }
}
```

### 에러
| 코드 | 상황 |
|---|---|
| `INVALID_CATEGORY` | press/cnc/injection 외 값 |
| `MISSING_ENERGY_COST` | energy_cost_annual 누락 |

---

## 4. AI 어드바이저 채팅

**담당:** 노승유(라우터) · 정유진(LangGraph 연결) · 임평우(호출)

```
POST /api/chat
```

### 요청
```json
{
  "company_id": "uuid-string",
  "message": "프레스가 15년 됐는데 교체할 가치 있을지 모르겠어요",
  "chat_history": [
    {
      "role": "user",
      "content": "이전 질문"
    },
    {
      "role": "assistant",
      "content": "이전 답변"
    }
  ]
}
```

### 응답 (SSE 스트리밍)
```json
{
  "intent": "roi",
  "response": "시나리오 A/B 분석 결과입니다...",
  "cards": [
    {
      "type": "roi_result",
      "data": { }
    }
  ],
  "next_questions": [
    "생산량을 알려주시면 더 정확한 분석이 가능합니다."
  ],
  "chat_id": "uuid"
}
```

intent
| 값 | 설명 |
|---|---|
| `roi` | ROI 분석 |
| `policy` | 정책 매칭 (마감일 조회 포함) |
| `draft` | 신청서 초안 |
| `info_missing` | 기업/설비 정보 부족 시 추가 수집 |
| `general` | 서비스 소개 등 일반 답변 |

변경 이유:
- `calendar` 제거 → policy_node 안에서 deadline tool로 처리
- `info_missing` 추가 → 정보 부족할 때 되물어보는 용도
- `general` 추가 → "팩토핏이 뭐야?" 같은 서비스 소개 질문 처리

---

## 5. 매칭 공고 목록

**담당:** 노승유(구현) · 임평우(호출)

```
GET /api/policies?company_id={company_id}&limit=10
```

### 응답
```json
{
  "policies": [
    {
      "policy_id": "kiat_2026_001",
      "title": "KIAT 스마트 제조혁신 공정개선",
      "organization": "KIAT",
      "max_amount": 8000,
      "deadline": "2026-07-15",
      "dday": 42,
      "match_score": 0.94,
      "fit_label": "완벽",
      "target_industry": ["C24"],
      "url": "https://..."
    }
  ],
  "total": 7
}
```

---

## 구현 우선순위

| 순서 | 엔드포인트 | 이유 |
|---|---|---|
| 1 | `/api/onboarding` | 모든 데이터 시작점 |
| 2 | `/api/roi/simulate` | 박 차장 데모 핵심 |
| 3 | `/api/dashboard` | 대시보드 연결 |
| 4 | `/api/chat` | AI 어드바이저 시나리오 |
| 5 | `/api/policies` | 지원사업 탭 |