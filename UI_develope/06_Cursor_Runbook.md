# 06_Cursor_Runbook
## 실행 순서

1. Phase 1: QA Report 생성
2. Phase 2: Design Token 기준표 생성
3. Phase 3: Execution Plan 생성
4. Phase 4: Stage별 실제 수정
5. Phase 5: Regression QA

## Git 준비
```bash
git status
git checkout -b chore/factofit-design-qa-normalization
git add .
git commit -m "backup: before FactoFit Design QA normalization"
git tag before-design-qa
```

## 실행 규칙
Phase 1~3은 코드 수정 금지입니다. Phase 4는 Stage별 하나씩 실행합니다. 각 Stage 후 git diff, build, 화면 확인, commit을 완료한 뒤 다음 Stage로 진행합니다.

금지: Phase 1~5를 한 번에 붙여넣기, Stage 1~7을 한 번에 수정, “전체 다 통일해줘” 단일 프롬프트, 로그인 전 페이지 포함, build 오류 해결 명목의 기능 코드 수정.
