# 팩토핏 데모 흐름 테스트 케이스

작성일: 2026.06.09

## 목적

이 문서는 박 차장 데모 시나리오 기준으로 `/api/chat`과 LangGraph 전체 흐름을 검증하기 위한 문서임.

`/api/roi/simulate`처럼 계산기 API만 직접 때리는 테스트가 아니라, 사용자가 자연어로 입력했을 때 라우터, 정보 수집, ROI 노드, 정책 매칭, 최종 응답이 이어지는지 확인하는 데 목적이 있음.

## 테스트 대상

- API: `POST /api/chat`
- 주요 확인 흐름:
  - Router Agent가 intent를 올바르게 분류함
  - 필요한 입력값이 부족하면 info_missing 흐름으로 감
  - ROI 계산이 필요한 경우 CAPEX/ROI 노드로 감
  - 지원하지 않는 설비나 애매한 설비는 DB/RAG에서 유사 정책을 찾아 제안함
  - 최종 응답은 `final_response` 또는 `response`로 반환됨

## 공통 요청 형식

```json
{
  "company_id": "demo-company-001",
  "message": "사용자 입력 문장",
  "chat_history": []
}
```

## TC-CHAT-01 | 박 차장 기본 ROI 데모

### 입력

```json
{
  "company_id": "demo-company-001",
  "message": "프레스 설비가 15년 됐고 연간 에너지비가 4800만원 정도 나와. 교체랑 부분개선 중에 뭐가 나은지 ROI로 비교해줘.",
  "chat_history": []
}
```

### 기대 동작

- intent가 `roi`로 분류되어야 함
- ROI 계산 노드가 실행되어야 함
- `scenario_a`, `scenario_b`가 포함된 결과가 생성되어야 함
- `ai_recommendation`이 포함되어야 함
- 정책 매칭이 가능하면 `matched_policies` 또는 추천 정책 설명이 포함되어야 함
- 최종 응답에서 A/B 시나리오 비교가 자연어로 설명되어야 함

### 데모 화면 기대값

- 시나리오 A 카드가 보임
- 시나리오 B 카드가 보임
- 추천 시나리오가 표시됨
- 예상 투자금, 지원금, 회수기간, ROI가 표시됨
- 근거가 되는 정책이 있으면 함께 표시됨

## TC-CHAT-02 | 필수 입력값 부족

### 입력

```json
{
  "company_id": "demo-company-001",
  "message": "우리 프레스 설비 교체하는 게 나을지 봐줘.",
  "chat_history": []
}
```

### 기대 동작

- 바로 계산을 강행하지 않아야 함
- 부족한 입력값을 물어봐야 함
- 예: 설비 연식, 연간 에너지비, 불량률, 생산량, 설비 용량 등을 추가로 요청함
- 서버 에러 없이 정상 응답해야 함

### 기대 응답 예시

```text
ROI를 계산하려면 설비 연식과 연간 에너지비가 필요함. 가능하면 불량률이나 설비 용량도 함께 입력해주면 더 정확하게 비교할 수 있음.
```

## TC-CHAT-03 | 지원하지 않는 설비 입력

### 입력

```json
{
  "company_id": "demo-company-001",
  "message": "레이저 커팅기 교체 지원사업이랑 ROI를 같이 봐줘.",
  "chat_history": []
}
```

### 기대 동작

- `/api/roi/simulate`처럼 단순히 지원하지 않는 category 에러로 끝나면 안 됨
- LangGraph 흐름에서는 DB/RAG 기반으로 유사한 정책을 찾아 제안해야 함
- 정확한 ROI 계산이 어렵다면 그 이유를 설명하고, 유사 정책 또는 추가 입력값을 안내해야 함
- 서버 500 에러가 나면 실패로 봄

### 기대 응답 예시

```text
현재 ROI 계산 기준 설비는 press, cnc, injection 중심이라 레이저 커팅기는 정확한 계산이 제한됨. 다만 장비 교체, 공정개선, 스마트공장 관련 정책 중 유사한 지원사업을 우선 확인할 수 있음.
```

## TC-CHAT-04 | 정책 추천 중심 질문

### 입력

```json
{
  "company_id": "demo-company-001",
  "message": "C24 제조업이고 노후 프레스 설비를 바꾸려는데 받을 수 있는 지원사업 찾아줘.",
  "chat_history": []
}
```

### 기대 동작

- intent가 `policy` 또는 `roi`와 연결된 정책 매칭 흐름으로 분류되어야 함
- Supabase/ChromaDB에 ingest된 정책 중 유사도가 높은 정책을 찾아야 함
- 추천 정책은 title, max_amount, deadline, url 중 가능한 정보를 포함해야 함
- 조건에 맞는 정책이 없으면 없다고 말하고, 유사 정책 탐색 기준을 설명해야 함

## TC-CHAT-05 | 정보 보강 후 ROI 재진입

### 1차 입력

```json
{
  "company_id": "demo-company-001",
  "message": "프레스 설비 교체 ROI 봐줘.",
  "chat_history": []
}
```

### 2차 입력

```json
{
  "company_id": "demo-company-001",
  "message": "15년 됐고 연간 에너지비는 4800만원, 불량률은 3.2%야.",
  "chat_history": [
    {
      "role": "assistant",
      "content": "ROI 계산에 필요한 추가 정보를 요청한 이전 응답"
    }
  ]
}
```

### 기대 동작

- 1차에서는 부족한 정보를 물어봄
- 2차에서는 새 입력값을 반영해 ROI 계산으로 넘어감
- 이전 대화 맥락을 일부 활용해야 함
- 최종적으로 A/B 비교 응답이 나와야 함

## TC-CHAT-06 | 신청서 초안 요청

### 입력

```json
{
  "company_id": "demo-company-001",
  "message": "방금 추천한 지원사업 기준으로 신청서 초안도 만들어줘.",
  "chat_history": []
}
```

### 기대 동작

- intent가 `draft`로 분류되어야 함
- 신청서 초안 생성 노드로 연결되어야 함
- 회사 정보와 추천 정책 정보가 있으면 반영해야 함
- 정보가 부족하면 필요한 항목을 요청해야 함

## TC-CHAT-07 | 일반 질문

### 입력

```json
{
  "company_id": "demo-company-001",
  "message": "팩토핏이 어떤 서비스인지 간단히 설명해줘.",
  "chat_history": []
}
```

### 기대 동작

- intent가 `general`로 분류되어야 함
- ROI 계산이나 정책 매칭으로 억지 진입하지 않아야 함
- 서비스 설명 중심으로 응답해야 함

## 완료 기준

| 항목 | 완료 기준 |
|---|---|
| Router 분류 | roi, policy, draft, general, info_missing 흐름이 구분됨 |
| ROI 데모 | 박 차장 입력으로 A/B 비교 응답이 나옴 |
| 정보 부족 처리 | 부족한 입력값을 질문함 |
| 미지원 설비 처리 | 서버 에러 없이 유사 정책 또는 한계 안내를 반환함 |
| 정책 추천 | ChromaDB/Supabase 기반 추천 정책이 응답에 포함됨 |
| 최종 응답 | `final_response` 또는 `response` fallback으로 프론트가 받을 수 있음 |
| 서버 안정성 | 테스트 중 HTTP 500이 발생하지 않음 |

## 현재 주의사항

- 이 문서는 서비스 데모 기준 문서임
- 정확한 숫자 계산 검증은 `roi_api_test_cases.md`에서 따로 확인함
- 프론트 ROI 페이지가 아직 API와 연결되지 않은 상태라면, 화면 데모는 별도 작업이 필요함
