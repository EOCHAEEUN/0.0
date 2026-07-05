export type RoiRoadmapPhase = {
  id: "phase-1" | "phase-2" | "phase-3"
  phase: string
  duration: string
  title: string
  items: string[]
}

export const ROI_ROADMAP_PHASES: RoiRoadmapPhase[] = [
  {
    id: "phase-1",
    phase: "PHASE 1",
    duration: "3개월",
    title: "데이터 통합 및 기반 구축",
    items: [
      "설비 가동 데이터 및 에너지 소비 데이터의 실시간 수집 체계 구축.",
      "주요 병목 공정 식별 및 데이터 정밀도 검증.",
    ],
  },
  {
    id: "phase-2",
    phase: "PHASE 2",
    duration: "6개월",
    title: "AI 모델 최적화 및 시뮬레이션",
    items: [
      "과거 생산 데이터 기반 예지보전 AI 모델 도입.",
      "가상 시나리오를 통한 공정 효율 시뮬레이션 및 ROI 검증.",
    ],
  },
  {
    id: "phase-3",
    phase: "PHASE 3",
    duration: "12개월",
    title: "지능형 자율 공정 확산",
    items: [
      "ERP·MES 연동 자동화.",
      "AI 기반 실시간 의사결정 지원 시스템 현장 적용.",
    ],
  },
]
