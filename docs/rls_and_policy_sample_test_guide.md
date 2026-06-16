# RLS 정책 테스트 및 정책추천 샘플 가이드

## 1. RLS 테스트 대상

이번 RLS 테스트는 마이페이지에서 사용하는 3개 테이블을 대상으로 한다.

| 영역 | 테이블 | 소유권 기준 |
|---|---|---|
| 기본정보 | `public.user_profile` | `user_profile.user_id = auth.uid()` |
| 기업정보/업종/매출 | `public.company` | `company.user_id = auth.uid()` |
| 설비정보 | `public.equipment` | `equipment.company_id -> company.company_id -> company.user_id = auth.uid()` |

확인해야 할 항목:

- A 유저가 B 유저의 `company`를 조회할 수 없는지
- A 유저가 B 유저의 `equipment`를 조회/수정/삭제할 수 없는지
- `equipment`는 `company_id`가 본인 회사일 때만 `SELECT/INSERT/UPDATE/DELETE` 되는지
- `anon` role이 `user_profile/company/equipment`에 직접 접근할 수 없는지
- 테스트 데이터는 검증 후 정리되는지

## 2. RLS 테스트 실행 방법

실행 파일:

```text
database/tests/20260616_rls_policy_manual_test.sql
```

준비:

1. Supabase Auth에 테스트용 사용자 2개를 만든다.
2. 두 사용자의 `auth.users.id`를 확인한다.
3. SQL 파일 상단의 placeholder UUID를 실제 A/B 테스트 유저 UUID로 바꾼다.

변경할 부분:

```sql
INSERT INTO rls_test_users(label, user_id)
VALUES
    ('A', '00000000-0000-0000-0000-00000000000a'::uuid),
    ('B', '00000000-0000-0000-0000-00000000000b'::uuid);
```

실행 위치:

```text
Supabase SQL Editor
```

기대 결과:

| 테스트 | 기대 결과 |
|---|---|
| `A can select own company` | `actual = 1` |
| `A cannot select B company` | `actual = 0` |
| `A can select own equipment` | `actual = 1` |
| `A cannot select B equipment` | `actual = 0` |
| A가 본인 equipment update | row 반환 |
| A가 B equipment update | row 반환 없음 |
| A가 본인 company에 equipment insert | 성공 |
| A가 B company에 equipment insert | RLS violation 발생 |
| A가 본인 equipment delete | row 반환 |
| A가 B equipment delete | row 반환 없음 |
| anon table privilege | 모두 `false` |

주의:

- `A가 B company에 equipment insert` 테스트는 의도적으로 에러를 발생시키는 케이스라 SQL 파일에서는 주석 처리되어 있다.
- 해당 케이스를 확인하려면 주석을 풀고 별도로 실행한다.
- 테스트 SQL 마지막에는 생성한 `equipment/company/user_profile` 테스트 row를 삭제한다.

## 3. 정책추천 테스트용 샘플 데이터

실행 파일:

```text
data/seed/policy_recommendation_test_samples.sql
```

목적:

- 정책추천/매칭 테스트에서 팀원이 같은 `company_id`로 재현 가능하게 하기 위한 공유 샘플이다.
- 총 20개 `company`와 각 company별 1개 `equipment`를 만든다.

중요:

- 이 샘플은 RLS 소유권 테스트용이 아니다.
- `company.user_id`는 `NULL`로 넣어서 `company_user_id_unique`와 충돌하지 않게 했다.
- 정책추천 API 또는 service-role 기반 QA에서 공유 `company_id`로 쓰는 용도다.

사용한 값의 근거:

- 업종코드: 프로젝트 코드와 수집 데이터에서 확인된 `C`, `C20`, `C22`, `C24`, `C25`, `C26`, `C28`, `C29`, `C30`
- 지역: 프로젝트 수집 스크립트/seed에서 확인된 `경기도 안산시`, `서울특별시`, `경기도 평택시`, `경기도 화성시`, `경상북도`, `부산`, `인천`, `대전`, `충남`, `경남`, `전북`, `충북`, `제주` 등
- 기업규모: 화면/코드에서 확인된 `중소기업`, `중견기업`
- 설비 카테고리: 화면에서 확인된 `press`, `cnc`, `injection`, `welding`, `compressor`, `etc`

공유 company_id:

```text
30000000-0000-0000-0000-000000000001
30000000-0000-0000-0000-000000000002
30000000-0000-0000-0000-000000000003
30000000-0000-0000-0000-000000000004
30000000-0000-0000-0000-000000000005
30000000-0000-0000-0000-000000000006
30000000-0000-0000-0000-000000000007
30000000-0000-0000-0000-000000000008
30000000-0000-0000-0000-000000000009
30000000-0000-0000-0000-000000000010
30000000-0000-0000-0000-000000000011
30000000-0000-0000-0000-000000000012
30000000-0000-0000-0000-000000000013
30000000-0000-0000-0000-000000000014
30000000-0000-0000-0000-000000000015
30000000-0000-0000-0000-000000000016
30000000-0000-0000-0000-000000000017
30000000-0000-0000-0000-000000000018
30000000-0000-0000-0000-000000000019
30000000-0000-0000-0000-000000000020
```

추천 테스트 예시:

```http
POST /api/policies/match
Content-Type: application/json

{
  "company_id": "30000000-0000-0000-0000-000000000001"
}
```

또는 현재 구현된 GET API 기준:

```http
GET /api/policies?company_id=30000000-0000-0000-0000-000000000001&limit=10
```

## 4. 샘플 케이스 요약

| No | company_id suffix | 지역 | 업종코드 | 규모 | 설비 |
|---:|---|---|---|---|---|
| 1 | `0001` | 경기도 안산시 | `C25` | 중소기업 | press |
| 2 | `0002` | 서울특별시 | `C24,C25,C28,C29` | 중소기업 | cnc |
| 3 | `0003` | 경기도 평택시 | `C24,C25` | 중소기업 | press |
| 4 | `0004` | 경기도 화성시 | `C20,C24,C25,C26,C28,C29` | 중소기업 | injection |
| 5 | `0005` | 대구 모빌리티 소부장 | `C24,C25,C29` | 중견기업 | etc |
| 6 | `0006` | 경상북도 | `C24,C25,C22,C29` | 중소기업 | cnc |
| 7 | `0007` | 경기도 소재 팹리스 기업 | `C26,C29` | 중소기업 | etc |
| 8 | `0008` | 지역특화형 지자체 소재 제조기업 | `C24,C25,C22,C29` | 중소기업 | welding |
| 9 | `0009` | 레전드50+ 선정기업 | `C24,C25,C22,C29` | 중견기업 | compressor |
| 10 | `0010` | 경기도 화성시 | `C26,C29` | 중소기업 | cnc |
| 11 | `0011` | 경기도 안산시 | `C22` | 중소기업 | injection |
| 12 | `0012` | 서울특별시 | `C29` | 중견기업 | etc |
| 13 | `0013` | 부산 | `C24,C25` | 중소기업 | press |
| 14 | `0014` | 인천 | `C20,C24,C25,C26,C28,C29` | 중소기업 | cnc |
| 15 | `0015` | 대전 | `C26` | 중소기업 | etc |
| 16 | `0016` | 충남 | `C30` | 중견기업 | welding |
| 17 | `0017` | 경남 | `C29` | 중소기업 | compressor |
| 18 | `0018` | 전북 | `C25` | 중소기업 | press |
| 19 | `0019` | 충북 | `C20` | 중소기업 | compressor |
| 20 | `0020` | 제주 | `C` | 중소기업 | etc |

## 5. 샘플 데이터 정리

정리 SQL:

```sql
DELETE FROM public.equipment
WHERE company_id >= '30000000-0000-0000-0000-000000000001'
  AND company_id <= '30000000-0000-0000-0000-000000000020';

DELETE FROM public.company
WHERE company_id >= '30000000-0000-0000-0000-000000000001'
  AND company_id <= '30000000-0000-0000-0000-000000000020';
```
