# FactoFit ROI Page Split by API/Schema Contract

ROI 페이지를 API/스키마 기준으로 분리한 버전입니다. 기존 UX/UI 흐름은 유지하고 요청된 변경만 반영했습니다.

## 반영 사항

1. 공통 필수 정보의 `설비 종류` 옆에 마이페이지와 동일한 ROI 분석 지원 설비 안내 tooltip을 추가했습니다.
2. `신청서 초안 생성하기` 버튼과 `/application-draft` 이동 prop을 제거했습니다. ROI 페이지는 ROI 분석/비교 역할에 집중합니다.
3. 왼쪽 안내 카드의 `공통 필수 정보` 박스를 삭제했습니다.
4. 필수값 누락 시 첨부 예시와 같은 어두운 다이얼로그 스타일로 안내합니다.

## 파일 구조

```txt
src/
  pages/
    RoiPage.tsx

  features/
    roi/
      RoiFeature.tsx
      roi.api.ts
      roi.constants.ts
      roi.contract.ts
      roi.utils.ts

      components/
        RoiPageSections.tsx
```

## 파일 역할

- `pages/RoiPage.tsx`: 라우팅용 입구 파일
- `features/roi/RoiFeature.tsx`: ROI 페이지 상태와 계산 실행 흐름
- `features/roi/roi.contract.ts`: API/스키마 기준 타입
- `features/roi/roi.api.ts`: ROI API 호출 래퍼
- `features/roi/roi.constants.ts`: 옵션, 색상, 공통 스타일
- `features/roi/roi.utils.ts`: 입력 정규화, payload 생성, ROI 시나리오 계산, 점수 계산
- `features/roi/components/RoiPageSections.tsx`: 화면 섹션 및 공통 UI 컴포넌트

## 적용 위치

```txt
frontend/src/pages/RoiPage.tsx
frontend/src/features/roi/...
```

## 확인

```bash
cd frontend
npm run build
```
