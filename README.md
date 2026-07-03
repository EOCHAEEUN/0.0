# 팩토핏 (FactoFit)

중소 제조기업 설비투자 AI 의사결정 에이전트 — 산업통상자원부 공공데이터 기반

## 실행 방법

### 백엔드
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # API 키 직접 입력
uvicorn app.main:app --reload
```

### 프론트엔드
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

### 데이터 파이프라인
```bash
cd data/scripts
python ingest.py        # 공고 → ChromaDB 임베딩
python seed_supabase.py # Supabase 초기 데이터 시딩
```
