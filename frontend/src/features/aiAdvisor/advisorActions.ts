import {
  BarChart3,
  Coins,
  FileText,
  GitCompare,
  Landmark,
  PlayCircle,
  type LucideIcon,
} from "lucide-react"

export type AdvisorActionId =
  | "roi_detail"
  | "roi_compare"
  | "investment_simulation"
  | "matched_policies"
  | "application_draft_status"
  | "start_analysis"
  | "roi_analyze"

export type AdvisorResponseType = "database" | "simulation" | "dialog" | "graph" | "selection"

export type AdvisorActionDefinition = {
  id: AdvisorActionId
  label: string
  userMessage: string
  icon: LucideIcon
  requiresAnalysis: boolean
  loadingLabel: string
  responseType: AdvisorResponseType
}

export const ANALYSIS_QUICK_ACTIONS: AdvisorActionDefinition[] = [
  {
    id: "roi_detail",
    label: "ROI 상세",
    userMessage: "ROI 상세 보기",
    icon: BarChart3,
    requiresAnalysis: true,
    loadingLabel: "ROI 조회 중…",
    responseType: "database",
  },
  {
    id: "roi_compare",
    label: "전체/부분 비교",
    userMessage: "A/B 투자안 비교",
    icon: GitCompare,
    requiresAnalysis: true,
    loadingLabel: "비교 조회 중…",
    responseType: "database",
  },
  {
    id: "investment_simulation",
    label: "투자금 변경",
    userMessage: "투자금 변경 시뮬레이션",
    icon: Coins,
    requiresAnalysis: true,
    loadingLabel: "시뮬레이션 중…",
    responseType: "dialog",
  },
  {
    id: "matched_policies",
    label: "매칭 지원사업",
    userMessage: "매칭 지원사업 보기",
    icon: Landmark,
    requiresAnalysis: true,
    loadingLabel: "정책 조회 중…",
    responseType: "database",
  },
  {
    id: "application_draft_status",
    label: "신청서 초안",
    userMessage: "신청서 초안 확인",
    icon: FileText,
    requiresAnalysis: true,
    loadingLabel: "초안 조회 중…",
    responseType: "database",
  },
]

export const NO_ANALYSIS_ACTION: AdvisorActionDefinition = {
  id: "start_analysis",
  label: "새 투자 분석 시작",
  userMessage: "새 투자 분석 시작",
  icon: PlayCircle,
  requiresAnalysis: false,
  loadingLabel: "설비 목록 불러오는 중…",
  responseType: "selection",
}
