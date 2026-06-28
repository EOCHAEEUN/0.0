# can_run_safety_logic 연결 로직 정리

## 목적

정책 상세 화면의 안전개선 섹션은 프론트에서 공고 제목, 태그, 상태 문구를 직접 해석해서 보여주면 안 된다.

최종 표시 조건은 항상 아래 값 하나만 본다.

```ts
policy.can_run_safety_logic === true
```

즉, 정책 데이터 생성/가공 계층에서 `can_run_safety_logic`을 계산해서 policy 객체에 포함하고, 화면 컴포넌트는 이 boolean 값만 사용한다.

## 데이터 원천

현재 기준 원천 필드는 `policy.safety_justification_usable`이다.

이 값은 안전개선 문장 사용 가능성 분류 결과이며, 대표 값은 다음과 같다.

```text
사용 가능
조건부 사용 가능
사용 어려움
판단불가
```

보조로 다음 필드들도 fallback 후보로 볼 수 있게 했다.

```text
usage_status
availability
display_status
policy_status
classification
metadata 내부 동일 필드들
```

## 판정 기준

`can_run_safety_logic` 계산 기준은 다음과 같다.

```text
사용 가능          -> true
조건부 사용 가능    -> true
available          -> true
conditional        -> true

사용 어려움        -> false
판단불가           -> false
값 없음            -> false
unavailable        -> false
disabled           -> false
```

이미 API 응답에 `can_run_safety_logic`이 boolean 또는 boolean-like 값으로 있으면 우선 사용한다.

```text
true, "true", 1, "1", "yes", "y"   -> true
false, "false", 0, "0", "no", "n"  -> false
```

## 백엔드 흐름

위치:

```text
backend/app/routers/analyze.py
```

핵심 함수:

```py
_resolve_can_run_safety_logic(status)
_resolve_policy_safety_logic(policy)
_format_policy_for_frontend(policy)
saved_policy_to_response(row, policy_detail)
```

역할:

1. `policy.safety_justification_usable` 또는 metadata/fallback 필드를 읽는다.
2. `사용 가능`, `조건부 사용 가능`이면 `can_run_safety_logic: true`로 계산한다.
3. 그 외는 `can_run_safety_logic: false`로 계산한다.
4. 추천 목록 API 응답과 상세 화면에서 쓰는 policy 객체 양쪽에 `can_run_safety_logic`을 포함한다.

응답 예:

```json
{
  "policy_id": "SMARTFACTORY:2026-N-0124:1",
  "title": "[현대자동차 그룹] 2026년도 상생형 인공지능 전환(AX) 선도모델 구축지원 사업 공고",
  "safety_justification_usable": "사용 가능",
  "application_reflection_recommendation": "반영 권장",
  "can_run_safety_logic": true
}
```

```json
{
  "policy_id": "SMARTFACTORY:2026-N-0005:1",
  "title": "2026년 스마트공장 수준확인 사업 공고",
  "safety_justification_usable": "사용 어려움",
  "application_reflection_recommendation": "반영 비권장",
  "can_run_safety_logic": false
}
```

## 정책 동기화 흐름

위치:

```text
data/scripts/sync_policy_from_validation.py
```

정책 검증/분류 테이블에서 `policy` 테이블로 동기화할 때 아래 안전개선 분류 요약 필드를 payload에 포함한다.

```text
policy_primary_nature
safety_justification_usable
safety_justification_strength
recommended_safety_viewpoints
application_reflection_recommendation
safety_justification_reason
safety_justification_synced_at
```

이 필드들이 `policy` row에 있어야 백엔드가 공고별로 `can_run_safety_logic`을 안정적으로 계산할 수 있다.

## 프론트 흐름

위치:

```text
frontend/src/features/support/supportProjects.contract.ts
frontend/src/features/support/supportProjects.utils.ts
frontend/src/features/support/AnalysisPoliciesPage.tsx
```

### 타입

`SupportProject`에 표시 제어 필드를 둔다.

```ts
can_run_safety_logic?: boolean
```

`PolicyApiItem`에는 원천 분류 필드도 포함한다.

```ts
can_run_safety_logic?: boolean | string | number | null
safety_justification_usable?: string | null
usage_status?: string | null
availability?: string | null
display_status?: string | null
policy_status?: string | null
classification?: string | null
```

### 가공

위치:

```text
frontend/src/features/support/supportProjects.utils.ts
```

핵심 함수:

```ts
resolveCanRunSafetyLogic(status)
resolvePolicySafetyLogic(policy, metadata)
mapPolicyToProject(policy, index)
```

`mapPolicyToProject`에서 최종 `SupportProject` 객체에 아래 값을 넣는다.

```ts
can_run_safety_logic: resolvePolicySafetyLogic(policy, metadata)
```

### 화면 표시

위치:

```text
frontend/src/features/support/AnalysisPoliciesPage.tsx
```

상세 화면은 이 조건만 사용한다.

```tsx
const canShowSafetyImprovement = project?.can_run_safety_logic === true

{canShowSafetyImprovement && <SafetyImprovementPreview />}
```

아래 같은 임시/하드코딩 표시 조건은 제거 대상이다.

```ts
const canShowSafetyImprovement = true
can_run_safety_logic: project.can_run_safety_logic ?? true
policy.title.includes(...)
policy.tags?.includes(...)
policy.status === "사용 가능"
policy.status === "조건부 사용 가능"
```

## 현재 확인된 공고 예시

다음 공고들은 안전개선 섹션 표시 대상이다.

```text
[포스코DX] 2026년도 상생형 인공지능 전환(AX) 선도모델 구축지원 사업 공고
  safety_justification_usable: 조건부 사용 가능
  application_reflection_recommendation: 검토 후 반영
  can_run_safety_logic: true

[코오롱베니트] 2026년도 상생형 인공지능 전환(AX) 선도모델 구축지원 사업 공고
  safety_justification_usable: 조건부 사용 가능
  application_reflection_recommendation: 검토 후 반영
  can_run_safety_logic: true

[현대자동차 그룹] 2026년도 상생형 인공지능 전환(AX) 선도모델 구축지원 사업 공고
  safety_justification_usable: 사용 가능
  application_reflection_recommendation: 반영 권장
  can_run_safety_logic: true

2026년도 자율형공장 구축 지원사업(단독신청)
  safety_justification_usable: 사용 가능
  application_reflection_recommendation: 반영 권장
  can_run_safety_logic: true
```

다음 공고는 안전개선 섹션 비표시 대상이다.

```text
2026년 스마트공장 수준확인 사업 공고
  safety_justification_usable: 사용 어려움
  application_reflection_recommendation: 반영 비권장
  can_run_safety_logic: false
```

## 주의점

DB에 제목이 유사한 중복 공고 row가 있으면, 어떤 `policy_id`가 ROI 추천에 잡히는지에 따라 표시 결과가 달라질 수 있다.

예:

```text
SMARTFACTORY:2026-N-0005:1
  title: 2026년 스마트공장 수준확인 사업 공고
  can_run_safety_logic: false

PBLN_000000000118006
  title: 2026년 스마트공장 수준확인 지원 사업 공고
  can_run_safety_logic: true
```

이 경우 로직 문제라기보다 데이터 중복/분류 정합성 문제다.

해결 방향:

1. 중복 공고를 canonical policy로 정리한다.
2. 같은 공고라면 `safety_justification_usable` 값을 일관되게 맞춘다.
3. ROI 추천 결과가 어떤 `policy_id`를 반환하는지 확인한다.

## 완료 기준

아래 조건을 만족하면 연결 완료로 본다.

```text
1. 백엔드 policy 응답에 can_run_safety_logic이 포함된다.
2. 추천 목록/상세에서 같은 policy 객체가 can_run_safety_logic을 가진다.
3. 프론트 상세 화면은 project.can_run_safety_logic === true만 본다.
4. 사용 가능/조건부 사용 가능 공고는 안전개선 섹션이 보인다.
5. 사용 어려움/판단불가/값 없음 공고는 안전개선 섹션이 보이지 않는다.
6. 프론트에 title/status/tags 기반 하드코딩 조건이 없다.
7. 안전개선 상세 내용은 아직 mock preview일 수 있으나, 표시 여부는 실제 공고 분류값 기반이다.
```
