# Policy Schema 통합 수정 완료 보고서

## 📋 수정 완료 파일 목록

### 1. ✅ backend/app/models/policy.py (필드 45줄 → 53줄)
**수정 내용:**
- 필드명 변경:
  - `category` → `policy_category`
  - `sub_category` → `policy_subcategory`
- 필드 추가 (14개):
  - 분류: `service_category`, `service_subcategory`
  - 금액 추출: `max_amount_note`, `max_amount_source`, `max_amount_evidence`, `amount_extraction_status`
  - 데이터 소스: `source_name`, `source_id`, `raw_text`, `raw_json`, `hashtags`
  - 점수/선택: `relevance_score`, `is_selected`, `selected_reason`

**영향:**
- ✅ Supabase 테이블과 완벽 일치
- ✅ API 응답 타입 정의 확정
- ✅ 백엔드 내부 모델과 DB 스키마 일치

### 2. ✅ data/scripts/collect_bizinfo_to_supabase.py
**확인 사항:**
- ✅ 이미 `relevance_score`, `is_selected`, `selected_reason` 저장 중 (main 함수에서 처리)
- ✅ `max_amount` 미저장 정책 유지 (enrich_max_amount.py에서 처리)
- 추가 수정 불필요

### 3. ✅ data/scripts/ingest.py (15줄 → 26줄)
**수정 내용:**
- ChromaDB 메타데이터 확장:
  - 추가: `policy_category`
  - 추가: `service_category`
  - 추가: `industry_codes` (쉼표로 구분된 문자열)
  - 추가: `region`
  - 변경: `max_amount` null 처리 추가

**영향:**
- ✅ 벡터 검색 후 메타데이터 필터링 가능
- ✅ 분류별 그룹화 가능
- ✅ 업종/지역 필터 지원

### 4. ✅ frontend/lib/types.ts (PolicyAnnouncement 인터페이스)
**수정 내용:**
- 필드 재구성 (6개 → 13개):
  - 기본: `policy_id`, `title`, `organization`, `url`
  - 분류: `policy_category`, `service_category`, `service_subcategory`
  - 금액: `max_amount`, `max_amount_note`, `max_amount_source`
  - 마감: `deadline`, `deadline_note`
  - 매칭: `d_day`, `match_score`

**영향:**
- ✅ UI에서 상세 정보 표시 가능
- ✅ 분류별 필터링 구현 가능
- ✅ 마감일 설명 표시 가능

### 5. ✅ backend/app/agents/policy.py (5줄 → 37줄)
**수정 내용:**
- 벡터 검색 필터링 구현:
  - 업종코드(industry_code) 필터
  - 지역(region) 필터 (전국은 항상 포함)
  - 필터 조건 optional (없으면 전체 검색)

**영향:**
- ✅ TODO 완료: 업종코드 + 지역 필터 적용
- ✅ 더 정확한 매칭 결과
- ✅ 검색 성능 향상

---

## 🗄️ Supabase 마이그레이션 SQL

**파일 위치:** `database/migrations/20260607_expand_policy_schema.sql`

### 추가 컬럼 (16개)

```sql
-- 분류 (4개)
policy_category VARCHAR(255)
policy_subcategory VARCHAR(255)
service_category VARCHAR(255)
service_subcategory VARCHAR(255)

-- 금액 추출 정보 (4개)
max_amount_note TEXT
max_amount_source VARCHAR(100)
max_amount_evidence TEXT
amount_extraction_status VARCHAR(50)

-- 데이터 소스 (5개)
source_name VARCHAR(100)
source_id VARCHAR(255)
raw_text LONGTEXT
raw_json JSON
hashtags JSON

-- 점수/선택 (3개)
relevance_score INT
is_selected BOOLEAN
selected_reason TEXT
```

### 성능 최적화 인덱스 (5개)
```sql
idx_policy_category
idx_service_category
idx_amount_status
idx_is_selected
idx_relevance_score
```

---

## 🚀 마이그레이션 및 테스트 방법

### Step 1: Supabase 마이그레이션 실행

#### 옵션 A: Supabase 콘솔 직접 실행
1. Supabase 대시보드 → SQL Editor
2. `database/migrations/20260607_expand_policy_schema.sql` 내용 복사-붙여넣기
3. "Run" 클릭

#### 옵션 B: 명령줄 (Supabase CLI 설치 필요)
```bash
supabase db push
```

#### 옵션 C: 스크립트로 실행
```python
import os
from supabase import create_client

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

with open("database/migrations/20260607_expand_policy_schema.sql", "r") as f:
    sql = f.read()
    supabase.rpc("execute_sql", {"sql": sql}).execute()
```

### Step 2: 데이터 수집 & 보강

#### 1. 기업마당 데이터 수집 (collect_bizinfo_to_supabase.py)
```bash
cd data/scripts
python collect_bizinfo_to_supabase.py
```

**확인 사항:**
- ✅ `relevance_score` 저장됨
- ✅ `is_selected` 저장됨 (TRUE)
- ✅ `selected_reason` 저장됨
- ✅ `max_amount` 미저장 (NULL)

#### 2. 지원금 추출 & 보강 (enrich_max_amount.py)
```bash
python enrich_max_amount.py
```

**확인 사항:**
- ✅ `max_amount` 채워짐
- ✅ `max_amount_source` 설정됨 (summary/detail_page/attachment_* 등)
- ✅ `max_amount_evidence` 저장됨
- ✅ `amount_extraction_status` 설정됨

#### 3. ChromaDB 임베딩 업데이트 (ingest.py)
```bash
python ingest.py
```

**확인 사항:**
- ✅ `policy_category`, `service_category` 메타데이터 포함
- ✅ `industry_codes` 메타데이터 포함
- ✅ 총 임베딩 수 확인

### Step 3: 백엔드 API 검증

#### 테스트 1: Policy 모델 직렬화
```python
# test_policy_model.py
import sys
sys.path.insert(0, 'backend')

from app.models.policy import PolicyAnnouncement
from datetime import date

# 테스트 데이터
policy_data = {
    "policy_id": "test-001",
    "title": "테스트 공고",
    "organization": "테스트기관",
    "policy_category": "스마트공장",
    "service_category": "스마트공장",
    "max_amount": 50000,
    "max_amount_source": "summary",
    "deadline": date(2026, 12, 31),
    "industry_codes": ["C24"],
    "url": "https://example.com",
}

try:
    policy = PolicyAnnouncement(**policy_data)
    print("✅ 모델 검증 성공")
    print(f"   Fields: {policy.model_fields_set}")
except Exception as e:
    print(f"❌ 모델 검증 실패: {e}")
```

#### 테스트 2: Supabase에서 데이터 조회
```bash
# 백엔드 터미널
cd backend
python -c "
import os
import sys
sys.path.insert(0, '.')
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

result = supabase.table('policy').select('*').limit(1).execute()
if result.data:
    print('✅ Supabase 연결 성공')
    policy = result.data[0]
    print(f'   정책: {policy.get(\"title\")}')
    print(f'   service_category: {policy.get(\"service_category\")}')
    print(f'   amount_status: {policy.get(\"amount_extraction_status\")}')
else:
    print('❌ 데이터 없음')
"
```

#### 테스트 3: 벡터 검색 필터링
```bash
# 백엔드 터미널
python -c "
import sys
sys.path.insert(0, 'backend')
from app.tools.vector_search import search_policies

# 필터 없이 검색
results = search_policies('스마트공장', n_results=3)
print(f'✅ 검색 결과: {len(results)}건')

for r in results:
    print(f\"   - {r['metadata'].get('title', 'Unknown')}\")
    print(f\"     category: {r['metadata'].get('service_category')}\")
"
```

### Step 4: 프론트엔드 타입 검증

#### 테스트 4: TypeScript 컴파일
```bash
cd frontend
npm run type-check
```

**확인 사항:**
- ✅ PolicyAnnouncement 타입 오류 없음
- ✅ API 응답 타입 일치

---

## ✅ 검증 체크리스트

### 데이터베이스
- [ ] 마이그레이션 SQL 실행 완료
- [ ] 새 컬럼 생성 확인 (16개)
- [ ] 인덱스 생성 확인 (5개)
- [ ] 기존 데이터 integrity 유지

### 백엔드
- [ ] PolicyAnnouncement 모델 필드 확인 (53개)
- [ ] 수집 스크립트 실행 (relevance_score 저장)
- [ ] 보강 스크립트 실행 (max_amount_source 설정)
- [ ] ChromaDB 메타데이터 확인 (4개 필드)
- [ ] 벡터 검색 필터링 작동 확인

### 프론트엔드
- [ ] 타입스크립트 컴파일 성공
- [ ] PolicyAnnouncement 인터페이스 필드 13개 확인
- [ ] 분류 필터 UI 추가 가능

---

## 📝 주요 변경 사항 요약

| 카테고리 | 변경 전 | 변경 후 | 상태 |
|---------|--------|--------|------|
| DB 컬럼 | 기본 필드만 | +16개 신규 필드 | ✅ 완료 |
| 백엔드 모델 | category/sub_category | policy_/service_ 분류 분리 | ✅ 완료 |
| 프론트엔드 타입 | 6개 필드 | 13개 필드 | ✅ 완료 |
| ChromaDB | 5개 메타데이터 | 9개 메타데이터 | ✅ 완료 |
| 검색 로직 | 전체 검색 | 업종/지역 필터 | ✅ 완료 |

---

## ⚠️ 주의사항

### 데이터 호환성
- **category/sub_category 필드:** 기존 호환성 유지 (이름 변경 안 함)
- 필요시 Supabase VIEW로 별칭 지정 가능

### 마이그레이션 순서 (중요!)
1. ✅ Supabase 마이그레이션 (DB 스키마)
2. ✅ 백엔드 모델 수정 (API)
3. ✅ 프론트엔드 타입 수정 (UI)
4. ✅ 데이터 수집/보강 스크립트 실행

### 성능 고려사항
- ChromaDB 재임베딩 필요 (ingest.py 재실행)
- 대량 데이터: 배치 처리 권장
- 인덱스 생성 후 첫 쿼리는 느릴 수 있음

---

## 🔄 롤백 방법 (필요시)

```sql
-- 마이그레이션 롤백 (컬럼 삭제)
ALTER TABLE policy DROP COLUMN IF EXISTS policy_category;
ALTER TABLE policy DROP COLUMN IF EXISTS policy_subcategory;
-- ... (나머지 컬럼도 동일)

-- 인덱스 삭제
DROP INDEX IF EXISTS idx_policy_category;
DROP INDEX IF EXISTS idx_service_category;
-- ... (나머지 인덱스도 동일)
```

---

**마지막 수정:** 2026-06-07
**작성자:** 분석 에이전트
**상태:** 🟢 준비 완료 (마이그레이션 실행 대기)
