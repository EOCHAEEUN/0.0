# FactoFit SupportProjectsPage 구조 분리 및 UI 수정

## 기준

- 기존 `SupportProjectsPage.tsx` 단일 파일을 API/스키마 흐름 기준으로 분리했습니다.
- 핵심 도메인은 `company`, `equipment`, `roi_result`, `matched_policy`, `raw_candidates`, `draft_result`입니다.
- 화면 구조는 기존 지원사업 페이지 레이아웃을 유지하고, 사용자 요청 수정사항만 반영했습니다.

## 반영 내용

1. 상단 요약 카드 4개 유지, 내용 변경
   - 전체 정책 DB
   - 업종 매칭 후보
   - AI 최종 추천
   - 우선 검토 사업

2. 1순위 추천 영역 유지
   - `1순위 사업 상세 보기` 버튼 삭제
   - `신청서 초안 만들기` 버튼 유지
   - 오른쪽 카드 문구를 `AI 추천 순위 기준`으로 변경

3. 추천 지원사업 리스트 변경
   - 최종 추천 5개 고정 구조
   - `A/B 시나리오 배지 + 공고 제목 + 점 5개 + 퍼센트`
   - 하단 태그: `전체교체/부분교체 · 최대 지원금 · 주관사`
   - 선택된 카드 전체 강조

4. 점수 안내
   - 점 5개 hover/tap: 적합도 단계 기준 표시
   - 퍼센트 hover/tap: 추천 적합도 안내 표시

5. 추천 적합도 카드
   - 오른쪽 추천 리스트에서 선택된 사업 기준으로 표시
   - LLM/RAG 판단 이유를 본문에 반영

6. 그 외 매칭된 정책
   - 기본 10개 노출
   - 정책명 | 주관사 2열 구성
   - 나머지는 아코디언으로 더보기/접기
   - 정책명 클릭 시 상세 다이얼로그 표시

7. 정책 상세 다이얼로그
   - 공고 등록일
   - 접수 마감일
   - D-DAY
   - policy category
   - URL
   - 지원내용

## 저장 위치

```txt
frontend/src/pages/SupportProjectsPage.tsx
frontend/src/features/support/SupportProjectsFeature.tsx
frontend/src/features/support/supportProjects.api.ts
frontend/src/features/support/supportProjects.contract.ts
frontend/src/features/support/supportProjects.utils.ts
frontend/src/features/support/hooks/useSupportProjects.ts
frontend/src/features/support/components/SupportProjectDialogs.tsx
frontend/src/features/support/components/SupportProjectSections.tsx
frontend/src/features/support/components/SupportProjectStates.tsx
```

## 확인

```bash
cd frontend
npm run build
```

## 커밋

```bash
git add src/pages/SupportProjectsPage.tsx
git add src/features/support
git commit -m "feat: 지원사업 페이지 구조 분리 및 추천 UI 개선"
git push origin "feat/임평우-frontend"
```
