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
}

export type MobilePolicySummary = {
  id: string
  title: string
  deadlineLabel: string
  reason: string
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

export type MobileHomeViewModel = {
  greeting: string
  companyName: string
  statusHeadline: string
  priorityCards: MobilePriorityCard[]
  tasks: MobileTaskItem[]
  recommendedPolicies: MobilePolicySummary[]
  readiness: MobileReadinessSummary
  aiChips: MobileAiChip[]
}

export type MobileRoiViewModel = {
  hasAnalysis: boolean
  equipmentName: string
  equipmentCategory: string
  roiMetricLabel: string
  roiMetricValue: string
  investmentText: string
  savingsText: string
  aiSummary: string
  webDetailPath: string
  emptyMessage: string
  emptyCtaPath: string
}

export type MobilePoliciesViewModel = {
  hasData: boolean
  title: string
  subtitle: string
  policies: SupportProjectsPolicyCard[]
  webSearchPath: string
}

export type MobileApplicationViewModel = {
  hasWorkspace: boolean
  readinessLabel: string
  missingItems: string[]
  policyName: string
  policyDeadline: string
  policyStatus: string
  evidenceCountLabel: string
  evidenceMissingText: string
  webDraftPath: string
}

export type MobileSafetyViewModel = {
  representativeEquipmentName: string
  evidenceCount: number
  evidenceItems: SafetyCheckItem[]
}

export type MobileMapperInput = {
  dashboard: DashboardViewModel
  draftWorkspace: ApplicationDraftWorkspaceData | null
}
