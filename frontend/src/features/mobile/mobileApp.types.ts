import type { DashboardViewModel } from "../dashboard/mappers/dashboardMapper"
import type { SupportProjectsPolicyCard } from "../support/supportProjectsOverview.types"
import type { ApplicationDraftWorkspaceData } from "../applicationDraft/applicationDraft.contract"
import type { SafetyCheckItem } from "../safetyCheck/safetyCheck.contract"

export type MobilePriorityCard = {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaPath: string
}

export type MobileTaskItem = {
  id: string
  label: string
  summary: string
  path: string
  status?: "pending" | "done" | "urgent"
}

export type MobilePolicySummary = {
  id: string
  title: string
  deadlineLabel: string
  reason: string
  supportAmountText: string
  metaLine: string
  preflightNote: string
  path: string
}

export type MobileReadinessSummary = {
  scoreLabel: string
  missingItems: string[]
}

export type MobileAiChip = {
  label: string
  question: string
}

export type MobileCompanySummaryRow = {
  label: string
  value: string
}

export type MobileEquipmentAlert = {
  title: string
  message: string
  ctaLabel: string
  ctaPath: string
  showCta: boolean
}

export type MobileCompanyCard = {
  companyName: string
  locationLine: string
  equipmentStatusLine: string
  registeredEquipmentCount: number
  closingSoonCount: number
  matchedPolicyLabel: string
}

export type MobileFeaturedPolicy = MobilePolicySummary & {
  organizationLabel: string
  tags: string[]
  matchBadge: string
  supportAmountLabel: string
  ctaLabel: string
}

export type MobileAiCard = {
  message: string
  highlightText: string
  ctaLabel: string
}

export type MobileHomeViewModel = {
  greeting: string
  companyName: string
  statusHeadline: string
  equipmentAlert: MobileEquipmentAlert
  companyCard: MobileCompanyCard
  companyRows: MobileCompanySummaryRow[]
  equipmentInfoRows: MobileCompanySummaryRow[]
  matchedPolicyCount: string
  summaryStatusText: string
  todayTaskCount: number
  priorityCards: MobilePriorityCard[]
  tasks: MobileTaskItem[]
  featuredPolicy: MobileFeaturedPolicy | null
  recommendedPolicies: MobilePolicySummary[]
  policiesViewAllPath: string
  readiness: MobileReadinessSummary
  aiCard: MobileAiCard
  aiChips: MobileAiChip[]
  aiHeadline: string
  aiPrompt: string
}

export type MobileScenarioCard = {
  key: "A" | "B"
  badge: string
  title: string
  subtitle: string
  investmentText: string
  subsidyText: string
  netInvestmentText: string
  paybackText: string
  roiText: string
  annualBenefitText: string
  hasData: boolean
}

export type MobileRoiKpi = {
  label: string
  value: string
}

export type MobileRoadmapStep = {
  phase: string
  duration: string
  title: string
  body: string
}

export type MobileStrategyComparison = {
  label: string
  detail: string
  hasData: boolean
}

export type MobileStrategyPhase = {
  id: string
  phase: string
  duration: string
  title: string
  items: string[]
}

export type MobileStrategyRoadmap = {
  eyebrow: string
  title: string
  subtitle: string
  roiComparison: MobileStrategyComparison
  paybackComparison: MobileStrategyComparison
  phases: MobileStrategyPhase[]
  summaryTitle: string
  summary: string
}

export type MobileRoiViewModel = {
  hasAnalysis: boolean
  equipmentName: string
  equipmentCategory: string
  introTitle: string
  introBody: string
  recommendedKey: "A" | "B" | null
  recommendedLabel: string
  scenarioA: MobileScenarioCard
  scenarioB: MobileScenarioCard
  roiMetricLabel: string
  roiMetricValue: string
  kpis: MobileRoiKpi[]
  chartRoiA: number | null
  chartRoiB: number | null
  recommendationSummary: string
  roadmapSteps: MobileRoadmapStep[]
  strategyRoadmap: MobileStrategyRoadmap
  aiSummary: string
  webDetailPath: string
  emptyMessage: string
  emptyCtaPath: string
}

export type MobilePriorityPolicyDetail = {
  rankStatusLabel: string
  supportTypeLabel: string
  displayTitle: string
  equipmentLabel: string
  deadlineLabel: string
  ddayLabel: string
  ddayTone: "urgent" | "soon" | "normal" | "past"
  recommendationReason: string
  whyCheckNow: string[]
  preflightChecks: Array<{ label: string; value: string }>
  documentsLabel: string
  actionLabel: string
}

export type MobilePolicyTypeGroup = {
  typeLabel: string
  policies: SupportProjectsPolicyCard[]
}

export type MobilePoliciesViewModel = {
  hasData: boolean
  eyebrow: string
  pageTitle: string
  pageSubtitle: string
  updatedAtLabel: string
  title: string
  subtitle: string
  priorityPolicy: SupportProjectsPolicyCard | null
  priorityDetail: MobilePriorityPolicyDetail | null
  policies: SupportProjectsPolicyCard[]
  policiesByType: MobilePolicyTypeGroup[]
  urgentPolicies: SupportProjectsPolicyCard[]
  webSearchPath: string
}

export type MobileApplicationStep = {
  key: string
  label: string
  status: "complete" | "pending" | "needs"
  summary: string
}

export type MobileApplicationViewModel = {
  hasWorkspace: boolean
  steps: MobileApplicationStep[]
  summaryParagraphs: string[]
  readinessLabel: string
  missingItems: string[]
  policyName: string
  policyDeadline: string
  policyStatus: string
  investmentText: string
  subsidyText: string
  netInvestmentText: string
  paybackText: string
  evidenceCountLabel: string
  evidenceMissingText: string
  draftExists: boolean
  webDraftPath: string
}

export type MobileSafetyViewpoint = {
  key: string
  title: string
  judgement: string
  evidenceStatus: string
  description: string
  uploadedCount: number
  requiredCount: number
  tone: "need" | "ok" | "neutral"
}

export type MobileSafetyViewModel = {
  representativeEquipmentName: string
  overallStatusLabel: string
  overallStatusTone: "need" | "ok" | "neutral"
  attachmentSummary: string
  viewpoints: MobileSafetyViewpoint[]
  evidenceCount: number
  evidenceItems: SafetyCheckItem[]
  canGenerateReport: boolean
  reportPreviewPath: string
}

export type MobileMapperInput = {
  dashboard: DashboardViewModel
  draftWorkspace: ApplicationDraftWorkspaceData | null
}
