import type { AdvisorQuickAction, AdvisorStageCard } from "./aiAdvisor.contract"

export const ADVISOR_QUICK_ACTIONS: AdvisorQuickAction[] = [
  {
    id: "roi",
    label: "ROI 분석",
    description: "설비 투자금, 지원금, 회수기간을 쉽게 설명합니다.",
  },
  {
    id: "support",
    label: "지원사업 추천",
    description: "현재 기업과 설비에 맞는 지원사업을 우선순위로 정리합니다.",
  },
  {
    id: "safety",
    label: "안전 리스크",
    description: "법정점검, 기한초과, 작업 전 체크 항목을 안내합니다.",
  },
  {
    id: "draft",
    label: "신청서 문장",
    description: "신청 목적, 사업 필요성, 기대효과 문장을 도와줍니다.",
  },
]

export const ADVISOR_STAGE_CARDS: AdvisorStageCard[] = [
  {
    id: "input",
    step: "01",
    title: "상황 선택",
    description: "궁금한 업무를 먼저 선택합니다.",
  },
  {
    id: "context",
    step: "02",
    title: "정보 확인",
    description: "DB에 저장된 기업·설비 정보를 불러옵니다.",
  },
  {
    id: "answer",
    step: "03",
    title: "AI 답변",
    description: "바로 이해할 수 있게 짧게 정리합니다.",
  },
]
