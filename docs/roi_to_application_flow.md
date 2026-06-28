# ROI 계산부터 신청서 초안까지 전체 흐름

이 문서는 현재 FactoFit의 `ROI 분석 -> 정책 매칭 -> 안전개선 준비 항목 -> 신청서 초안/PDF` 흐름을 코드와 DB 기준으로 정리한 것이다.

## 1. 전체 흐름 요약

```text
회원가입/로그인
  -> 기업정보 저장(company)
  -> 설비정보 저장(equipment)
  -> ROI 분석 실행(/api/analyze)
  -> ROI 결과 저장(roi_output)
  -> 정책 후보/순위 저장(matched_policy)
  -> 정책 상세 화면(/support-projects)
  -> can_run_safety_logic=true 정책만 안전개선 표 표시
  -> 안전개선 준비 항목 생성(safety_viewer_policy)
  -> 신청서 초안 생성(/api/draft)
  -> draft_result 저장
  -> PDF 생성(/api/reports/application.pdf)
```

## 2. 주요 화면/프론트 파일

| 단계 | 프론트 파일 | 역할 |
| --- | --- | --- |
| ROI 분석 실행 | `frontend/src/features/roi/roi.api.ts` | `/api/analyze` 호출 |
| 온보딩 후 분석 | `frontend/src/features/onboarding/onboardingAnalysisApi.ts` | 기업/설비 저장 후 분석 호출 |
| 지원사업 목록/상세 | `frontend/src/features/support/AnalysisPoliciesPage.tsx` | 정책 목록, 상세, 안전개선 준비 항목 표시 |
| 정책 API | `frontend/src/features/support/supportProjects.api.ts` | `support-projects`, `policy-summary`, `safety-preview` 호출 |
| 정책 매핑 | `frontend/src/features/support/supportProjects.utils.ts` | API 정책 데이터를 화면 카드 모델로 변환 |
| 신청서 초안 화면 | `frontend/src/features/applicationDraft/*` | 초안 생성, 상태 관리, PDF 미리보기 |
| PDF 다운로드 | `frontend/src/features/applicationDraft/components/ApplicationDraftPdfPreview.tsx` | `/api/reports/application.pdf` 호출 |

## 3. 주요 백엔드 API

| API | 파일 | 역할 |
| --- | --- | --- |
| `POST /api/auth/login` | `backend/app/routers/auth.py` | Supabase Auth 로그인 |
| `POST /api/onboarding` | `backend/app/routers/onboarding.py` | 기업정보 저장 |
| `POST /api/onboarding/{company_id}/equipment` | `backend/app/routers/onboarding.py` | 설비정보 저장 |
| `POST /api/analyze?company_id=...&equipment_id=...` | `backend/app/routers/analyze.py` | ROI 계산 + 정책 매칭 |
| `GET /api/analyze/support-projects` | `backend/app/routers/analyze.py` | 저장된 정책 매칭 결과를 화면용으로 반환 |
| `GET /api/analyze/policy-summary` | `backend/app/routers/analyze.py` | 정책 카운터/요약 반환 |
| `GET /api/analysis/{analysis_id}/policies/{policy_id}/safety-preview` | `backend/app/routers/safety_preview.py` | 생성된 안전개선 준비 항목 조회 |
| `POST /api/analysis/{analysis_id}/policies/{policy_id}/safety-preview` | `backend/app/routers/safety_preview.py` | 안전개선 준비 항목 생성 |
| `POST /api/draft` | `backend/app/routers/draft.py` | 신청서 초안 생성 및 저장 |
| `POST /api/reports/application.pdf` | `backend/app/routers/reports.py` | 신청서 PDF 생성 |

## 4. 사용하는 주요 DB 테이블

| 테이블 | 사용 단계 | 역할 |
| --- | --- | --- |
| `user_profile` | 회원가입/로그인 | 사용자 프로필 |
| `company` | 온보딩, ROI, 신청서 | 기업정보 |
| `equipment` | 온보딩, ROI, 안전개선, 신청서 | 설비정보 및 ROI 입력값 |
| `roi_output` | ROI 분석 | ROI 계산 결과 저장 |
| `policy` | 정책 매칭, 안전개선, 신청서 | 정책 원본/요약/안전 활용 가능성 |
| `matched_policy` | 정책 매칭 | 기업/설비별 추천 정책 결과 |
| `policy_ai_safety_justification` | 안전개선 | 정책별 안전개선 활용 가능성 LLM/분류 결과 |
| `safety_rule_legal` | 안전개선 | 설비 유형별 법정/안전 점검 규칙 |
| `safety_viewer_policy` | 안전개선 | 정책+설비+분석 단위로 생성된 안전개선 준비 항목 |
| `user_safety_files` | 안전개선 증빙 | 향후 사용자가 업로드할 증빙 파일 메타데이터 |
| `draft_result` | 신청서 초안 | 생성된 신청서 초안 JSON 저장 |

## 5. ROI 분석 로직

진입점은 `POST /api/analyze`다.

주요 파일:

- `backend/app/routers/analyze.py`
- `frontend/src/features/roi/roi.api.ts`
- `frontend/src/features/onboarding/onboardingAnalysisApi.ts`

처리 흐름:

1. 프론트가 `company_id`, `equipment_id`를 쿼리로 붙여 `/api/analyze` 호출
2. 백엔드가 `company`, `equipment` 테이블에서 분석 입력값 조회
3. 설비 입력값을 기반으로 ROI 시나리오 A/B 계산
4. ROI 결과를 `roi_output`에 저장
5. 같은 흐름 안에서 정책 후보를 조회하고 매칭/랭킹 수행
6. 매칭된 정책을 `matched_policy`에 저장
7. 프론트는 결과를 받아 ROI 페이지 또는 지원사업 페이지로 이동

ROI 결과는 정책 매칭의 입력 맥락으로 쓰이지만, 정책 순위는 ROI 수치만으로 결정되지 않는다. 설비, 업종, 지역, 투자 규모, 정책 조건, 정책 성격, 안전 활용 가능성 등이 같이 반영된다.

## 6. 정책 매칭 로직

주요 파일:

- `backend/app/routers/analyze.py`
- `backend/app/agents/policy.py`
- `backend/app/tools/vector_search.py`
- `frontend/src/features/support/supportProjects.api.ts`
- `frontend/src/features/support/supportProjects.utils.ts`

처리 흐름:

1. ROI 분석 결과와 설비/기업 정보를 이용해 정책 검색 쿼리 생성
2. 정책 후보를 조회
3. 조건/시나리오/정책 성격에 따라 랭킹
4. LLM 하이브리드 평가가 가능하면 보조 점수 반영
5. 실패 시에도 rule 기반 결과로 fallback
6. 결과를 `matched_policy`에 저장
7. `GET /api/analyze/support-projects`가 화면용 카드로 반환

정책 카드에는 다음 안전 관련 필드가 포함된다.

- `can_run_safety_logic`
- `safety_justification_usable`
- `safety_justification_strength`
- `recommended_safety_viewpoints`
- `application_reflection_recommendation`
- `safety_justification_reason`

## 7. `can_run_safety_logic` 로직

주요 파일:

- `backend/app/routers/analyze.py`
- `frontend/src/features/support/supportProjects.utils.ts`
- `docs/can_run_safety_logic_flow.md`

역할:

- 정책 상세 화면에서 안전개선 준비 항목 표를 보여줄지 결정한다.
- `true`인 정책만 안전개선 준비 항목 API를 호출한다.
- `false`인 정책은 안전개선 신청서 활용 대상이 아니므로 표를 표시하지 않는다.

판단 근거:

- `policy.can_run_safety_logic`
- `policy.safety_justification_usable`
- `policy.metadata.can_run_safety_logic`
- `policy_ai_safety_justification` 보조 결과

현재 기준:

- `사용 가능`
- `조건부 사용 가능`
- `available`
- `conditional`
- `true`

위 값은 안전개선 표 생성 가능으로 본다.

## 8. 안전개선 준비 항목 생성 로직

주요 파일:

- `backend/app/routers/safety_preview.py`
- `backend/app/services/safety_preview.py`
- `database/migrations/20260628_create_safety_viewer_policy.sql`
- `data/scripts/apply_safety_viewer_policy_grants.py`
- `frontend/src/features/support/AnalysisPoliciesPage.tsx`
- `frontend/src/features/support/supportProjects.api.ts`

처리 흐름:

1. 정책 상세 화면에서 `project.can_run_safety_logic === true`인지 확인
2. 먼저 `GET /api/analysis/{analysis_id}/policies/{policy_id}/safety-preview` 호출
3. 기존 생성 결과가 없으면 `POST /safety-preview` 호출
4. 백엔드가 `policy`, `policy_ai_safety_justification`, `equipment`, `safety_rule_legal` 조회
5. 정책별 `recommended_safety_viewpoints`를 우선 반영
6. 설비 유형별 안전규칙을 매칭
7. 안전개선 관점 3개를 생성
8. 필요한 증빙 목록과 설명문 생성
9. `safety_viewer_policy`에 upsert
10. 프론트가 표로 표시

현재 생성 버전:

- `generation_source = rule_based_policy_context_v7`

이 버전은 기존처럼 설비 안전규칙만 반복하지 않고, 정책별 추천 관점 순서를 우선 반영한다.

예시:

| 정책 | 생성 관점 순서 |
| --- | --- |
| 포스코DX AX | 자동화 안전성 -> 설비 운용 안정성 -> 작업자 위험 노출 감소 |
| 코오롱베니트 AX | 자동화 안전성 -> 작업환경 개선 -> 설치 후 안전관리 |
| 현대자동차 그룹 AX | 설비 운용 안정성 -> 자동화 안전성 -> 작업환경 개선 |

## 9. 신청서 초안 생성 로직

주요 파일:

- `backend/app/routers/draft.py`
- `backend/app/agents/draft.py`
- `backend/app/prompts/draft.py`
- `backend/app/models/draft_result.py`
- `frontend/src/features/applicationDraft/*`

처리 흐름:

1. 프론트 신청서 화면에서 `/api/draft` 호출
2. 백엔드가 `company`, `equipment`, `roi_output`, `matched_policy`, `policy` 조회
3. 선택한 `policy_id`에 해당하는 `matched_policy`를 찾음
4. 정책 상세와 매칭 결과를 병합
5. `application_draft_node` 호출
6. LLM 생성 성공 시 LLM 초안 사용
7. LLM 실패 시 DB 기반 fallback 초안 생성
8. `draft_result`에 저장
9. 프론트는 저장된 초안을 화면에 표시

주의:

- OpenRouter 크레딧/토큰 부족 시 LLM 생성은 실패할 수 있다.
- 이 경우에도 `backend/app/routers/draft.py`가 DB 기반 fallback 초안을 만들어 저장한다.

## 10. PDF 생성 로직

주요 파일:

- `backend/app/routers/reports.py`
- `backend/app/services/application_report.py`
- `frontend/src/features/applicationDraft/components/ApplicationDraftPdfPreview.tsx`

처리 흐름:

1. 프론트가 `/api/reports/application.pdf` 호출
2. 백엔드가 `load_application_report_data()` 실행
3. `company`, `equipment`, `roi_output`, `matched_policy`, `policy`, `draft_result` 조회
4. `build_application_report_pdf(data)`가 ReportLab으로 PDF 생성
5. 프론트가 PDF Blob을 다운로드

PDF 안에 실제로 찍히는 문구/섹션/표는 대부분 `backend/app/services/application_report.py`에서 결정된다.

## 11. 현재 연결 상태에서 중요한 사실

1. ROI 분석 결과는 `roi_output`에 저장된다.
2. 정책 매칭 결과는 `matched_policy`에 저장된다.
3. 안전개선 준비 항목은 `safety_viewer_policy`에 저장된다.
4. 신청서 초안은 `draft_result`에 저장된다.
5. 신청서 PDF는 저장된 DB 값과 초안 값을 다시 읽어서 생성한다.
6. 안전개선 준비 항목은 신청서 초안 생성과 별도 API지만, 정책 상세 화면에서 먼저 생성/확인된다.
7. `can_run_safety_logic=false` 정책은 안전개선 표 자체를 보여주지 않는다.

## 12. 검토 포인트

현재 로직이 맞는지 검토할 때는 아래를 보면 된다.

- ROI 값이 바뀌면 `roi_output`이 새로 저장되는가
- `matched_policy`의 정책 순위가 의도대로 바뀌는가
- 정책 카드의 `can_run_safety_logic`이 DB의 정책 필드와 일치하는가
- 안전개선 표가 공고별 `recommended_safety_viewpoints` 순서를 반영하는가
- `safety_viewer_policy.generation_source`가 최신 버전인지 확인하는가
- `/api/draft`가 선택한 `policy_id`의 `matched_policy`를 제대로 가져오는가
- PDF가 최신 `draft_result`를 읽고 있는가

## 13. 관련 문서

- `docs/can_run_safety_logic_flow.md`
- `database/migrations/20260628_create_safety_viewer_policy.sql`
