[정책 자격조건 추출 작업 정리]

이번에 data/scripts/enrich_policy_eligibility.py 스크립트를 추가해서
policy 테이블의 지원 자격조건 관련 컬럼을 보강했음.

목적은 정책 추천할 때 회사 정보와 공고 지원조건을 비교하기 위함임.
예를 들어 직원 수, 매출, 업력, 기업유형 조건이 있으면 구조화해서 저장하고,
명확한 숫자 조건이 없으면 NULL로 남기도록 설계했음.

---

1. 새로 채우는 컬럼

policy 테이블 기준으로 아래 컬럼을 사용함.

- employee_min
  - 최소 직원 수 조건
  - 예: 5인 이상이면 5

- employee_max
  - 최대 직원 수 조건
  - 예: 50인 이하이면 50

- revenue_min_manwon
  - 최소 매출 조건, 만원 단위
  - 예: 50억원 이상이면 500000

- revenue_max_manwon
  - 최대 매출 조건, 만원 단위
  - 예: 100억원 미만이면 1000000

- company_age_min
  - 최소 업력/창업연수 조건
  - 예: 창업 3년 이상이면 3

- company_age_max
  - 최대 업력/창업연수 조건
  - 예: 창업 7년 이내이면 7

- eligible_company_types
  - 지원 가능한 기업 유형 배열
  - 예: ["중소기업", "제조기업", "창업기업"]

- eligibility_text
  - 공고에서 추출한 지원대상/자격조건 요약 텍스트

- eligibility_evidence
  - 실제 근거 문장
  - 너무 길어지지 않도록 일부만 저장

- eligibility_extraction_status
  - 추출 상태값

---

2. 현재 DB 반영 상태

총 policy 291건 기준:

- eligibility_text: 291건 채워짐
- eligibility_evidence: 291건 채워짐
- eligibility_extraction_status: 291건 채워짐
- eligible_company_types: 285건 채워짐

숫자 조건 컬럼은 대부분 NULL임.

- employee_min / employee_max
- revenue_min_manwon / revenue_max_manwon
- company_age_min / company_age_max

이 NULL은 오류가 아니라,
해당 공고에 직원 수, 매출액, 업력 조건이 명확히 없다는 의미로 봐야 함.

예를 들어 공고가 “중소기업 대상”, “제조기업 대상”이라고만 쓰여 있고
“50인 이하”, “매출 100억원 미만” 같은 숫자가 없으면
숫자 컬럼은 NULL로 유지하는 게 맞음.

---

3. 추출 상태값 의미

eligibility_extraction_status는 아래처럼 사용함.

- type_only_extracted
  - 기업 유형이나 지원대상 텍스트만 추출됨
  - 숫자 조건은 없음
  - 가장 많은 케이스

- structured_extracted
  - 직원 수, 매출, 업력 중 하나 이상 숫자 조건이 추출됨

- llm_extracted
  - 정규식으로 부족해서 LLM 보조로 추출됨

- needs_review
  - 자동 판단이 애매해서 사람이 봐야 함

- not_found
  - 사용할 수 있는 지원대상 텍스트를 찾지 못함

현재는 type_only_extracted가 대부분이고,
structured_extracted는 일부 공고만 해당함.

---

4. 중요한 해석 기준

숫자 컬럼 NULL은 나쁜 값이 아님.

NULL의 의미:
“조건이 없거나, 공고 본문에서 명시적으로 확인되지 않음”

따라서 정책 매칭 로직에서는 이렇게 처리하면 됨.

- employee_max가 NULL이면 직원 수 제한 없음으로 간주
- revenue_max_manwon이 NULL이면 매출 제한 없음으로 간주
- company_age_max가 NULL이면 업력 제한 없음으로 간주
- eligible_company_types는 있으면 회사 유형/업종 매칭에 활용

즉 NULL은 필터 탈락 조건이 아니라
“해당 조건으로 제한하지 않는다”로 해석해야 함.

---

5. 정리한 오류

일부 revenue 컬럼에 0이 들어간 값이 있었음.
이건 정상적인 매출 조건이 아니라 추출 오류 가능성이 있어 NULL로 정리했음.

예:
- revenue_min_manwon = 0
- revenue_max_manwon = 0

이 값들은 실제 조건으로 쓰면 안 되므로 NULL 처리하는 게 맞음.

---

6. 앞으로 DB 담당자가 확인하면 좋은 것

1. policy 테이블에 위 컬럼들이 모두 존재하는지 확인
2. eligibility_extraction_status별 count 확인
3. structured_extracted인 공고 몇 개를 샘플로 열어서 숫자 조건이 맞게 들어갔는지 확인
4. type_only_extracted는 숫자 컬럼 NULL이어도 정상으로 판단
5. revenue_min_manwon / revenue_max_manwon에 0 값이 다시 생기지 않는지 확인

확인용 SQL 예시:

select eligibility_extraction_status, count(*)
from policy
group by eligibility_extraction_status
order by count(*) desc;

select
  policy_id,
  title,
  employee_min,
  employee_max,
  revenue_min_manwon,
  revenue_max_manwon,
  company_age_min,
  company_age_max,
  eligible_company_types,
  eligibility_extraction_status
from policy
where eligibility_extraction_status = 'structured_extracted'
limit 20;

select *
from policy
where revenue_min_manwon = 0
   or revenue_max_manwon = 0;