# FactoFit 문서 업로드 / 제출 전 서류 확인 UI 반영본

## 반영 내용

1. 마이페이지 `첨부파일` 아코디언 추가
   - 서류명 선택
   - 파일 선택
   - 드래그 앤 드롭 영역
   - 추가하기
   - 등록된 첨부파일 목록/삭제
   - 저장 위치: `localStorage.factofit_mypage_documents`

2. 신청서 초안 페이지 `제출 전 확인할 서류` 섹션 추가
   - 지원처 요구 서류와 마이페이지 저장 문서를 비교
   - 일치: V 체크 / 확인 완료
   - 미보유: X 표시 / 미보유
   - 기본 샘플 저장 문서: 사업자등록증, 중소기업확인서

3. 공통 문서 저장 유틸 추가
   - `src/features/documents/documentStorage.ts`

4. TypeScript 확인
   - `npx tsc -b` 통과 확인
   - Vite build는 업로드된 node_modules에 Linux용 Rolldown optional binding이 없어 sandbox에서 실행 불가했습니다. 로컬에서는 `npm install` 후 `npm run build` 또는 `npm run dev`로 확인하면 됩니다.

## 실행 방법

### 백엔드

```bash
cd backend
python -m venv venv
.\\venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

프론트 주소:

```txt
http://localhost:5173
```
