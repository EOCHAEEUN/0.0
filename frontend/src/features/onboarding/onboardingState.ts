export type CompanyProfileStatus = "not_started" | "in_progress" | "completed"
export type AnalysisDraftStatus = "in_progress" | "ready_for_review" | "completed"

export type CompanyProfileDraft = {
  companyName: string
  regionSido: string
  regionSigungu: string
  industry: string
  industryCode: string
  employeeRange: string
  foundedYear?: string
  revenueRange?: string
  smartFactoryStatus?: string
  status: CompanyProfileStatus
  updatedAt?: string
}

export type UserOnboardingState = {
  companyProfileStatus: CompanyProfileStatus
  welcomeDismissed: boolean
  analysisDraftId?: string
  analysisDraftStatus?: AnalysisDraftStatus
  analysisCount: number
}

export type AnalysisConditionDraft = {
  equipmentCategory: string
  equipmentName: string
  investmentAmount: string
  ageYears: string
  energyCostAnnual: string
  monthlyProduction: string
  monthlyLaborCost: string
  monthlyMaintenanceCost: string
  expectedRevenueIncrease: string
  investmentRange?: string
  purpose: string
  // 추가 ROI 입력값 — API EquipmentInput의 scenario_b_investment_manwon, current_capacity_value 매핑
  scenarioBInvestmentManwon?: string
  equipmentCapacity?: string
}

export type AnalysisResultSnapshot = {
  schemaVersion: number
  id: string
  equipmentName: string
  recommendation: string
  recommendationDetail: string
  roiPct: number | null
  roiPercent: number | null
  paybackYears: number | null
  matchedPolicies: number
  priorityPolicies: number
  priorityPolicyName: string
  recommendedScenario: string
  companyId?: string
  equipmentId?: string
  roiResult?: unknown
  policies?: unknown[]
  policyStatus?: string
  policyError?: string | null
  createdAt: string
}

export const COMPANY_PROFILE_DRAFT_KEY = "factofit_company_profile_draft"
export const USER_ONBOARDING_STATE_KEY = "factofit_user_onboarding_state"
export const JUST_SIGNED_UP_KEY = "factofit_just_signed_up"
export const ANALYSIS_CONDITION_DRAFT_KEY = "factofit_analysis_condition_draft"
export const ANALYSIS_RESULT_KEY = "factofit_analysis_result"
export const ANALYSIS_RESULT_SCHEMA_VERSION = 2

export const emptyAnalysisConditionDraft: AnalysisConditionDraft = {
  equipmentCategory: "",
  equipmentName: "",
  investmentAmount: "",
  ageYears: "",
  energyCostAnnual: "",
  monthlyProduction: "",
  monthlyLaborCost: "",
  monthlyMaintenanceCost: "",
  expectedRevenueIncrease: "",
  investmentRange: "",
  purpose: "",
  scenarioBInvestmentManwon: "",
  equipmentCapacity: "",
}

export const emptyCompanyProfileDraft: CompanyProfileDraft = {
  companyName: "",
  regionSido: "",
  regionSigungu: "",
  industry: "",
  industryCode: "",
  employeeRange: "",
  foundedYear: "",
  revenueRange: "",
  smartFactoryStatus: "",
  status: "not_started",
}

const defaultOnboardingState: UserOnboardingState = {
  companyProfileStatus: "not_started",
  welcomeDismissed: false,
  analysisCount: 0,
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getCompanyProfileDraft(): CompanyProfileDraft {
  return {
    ...emptyCompanyProfileDraft,
    ...(readJson<Partial<CompanyProfileDraft>>(COMPANY_PROFILE_DRAFT_KEY) ?? {}),
  }
}

export function getAnalysisConditionDraft(): AnalysisConditionDraft {
  return {
    ...emptyAnalysisConditionDraft,
    ...(readJson<Partial<AnalysisConditionDraft>>(ANALYSIS_CONDITION_DRAFT_KEY) ?? {}),
  }
}

export function saveAnalysisConditionDraft(
  draft: AnalysisConditionDraft,
): AnalysisConditionDraft {
  writeJson(ANALYSIS_CONDITION_DRAFT_KEY, draft)
  return draft
}

function getAnalysisResultByIdKey(id: string) {
  return `${ANALYSIS_RESULT_KEY}:${id}`
}

function isCurrentAnalysisResult(
  result: AnalysisResultSnapshot | null,
): result is AnalysisResultSnapshot {
  return result?.schemaVersion === ANALYSIS_RESULT_SCHEMA_VERSION
}

export function getAnalysisResult(id?: string): AnalysisResultSnapshot | null {
  if (id) {
    const scoped = readJson<AnalysisResultSnapshot>(getAnalysisResultByIdKey(id))
    return isCurrentAnalysisResult(scoped) ? scoped : null
  }

  const latest = readJson<AnalysisResultSnapshot>(ANALYSIS_RESULT_KEY)
  return isCurrentAnalysisResult(latest) ? latest : null
}

export function saveAnalysisResult(
  result: AnalysisResultSnapshot,
): AnalysisResultSnapshot {
  const next = {
    ...result,
    schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION,
    roiPercent: result.roiPercent ?? result.roiPct,
  }

  console.debug("[onboarding-analysis] saving result snapshot", {
    id: next.id,
    roiPct: next.roiPct,
    roiPercent: next.roiPercent,
    paybackYears: next.paybackYears,
    recommendedScenario: next.recommendedScenario,
    matchedPolicies: next.matchedPolicies,
    priorityPolicies: next.priorityPolicies,
  })

  writeJson(ANALYSIS_RESULT_KEY, next)
  writeJson(getAnalysisResultByIdKey(next.id), next)
  updateUserOnboardingState({
    analysisDraftId: next.id,
    analysisDraftStatus: "completed",
    analysisCount: Math.max(1, getUserOnboardingState().analysisCount),
  })
  return next
}

export function saveCompanyProfileDraft(
  draft: CompanyProfileDraft,
): CompanyProfileDraft {
  const next = {
    ...draft,
    updatedAt: new Date().toISOString(),
  }
  writeJson(COMPANY_PROFILE_DRAFT_KEY, next)
  updateUserOnboardingState({ companyProfileStatus: next.status })
  return next
}

export function getUserOnboardingState(): UserOnboardingState {
  const stored =
    readJson<Partial<UserOnboardingState>>(USER_ONBOARDING_STATE_KEY) ?? {}
  const draft = getCompanyProfileDraft()
  const analysis = readJson<Record<string, unknown>>(ANALYSIS_RESULT_KEY)
  const analysisCount =
    typeof stored.analysisCount === "number"
      ? stored.analysisCount
      : analysis
        ? 1
        : 0

  return {
    ...defaultOnboardingState,
    ...stored,
    companyProfileStatus:
      stored.companyProfileStatus ?? draft.status ?? "not_started",
    analysisCount,
  }
}

export function updateUserOnboardingState(
  patch: Partial<UserOnboardingState>,
): UserOnboardingState {
  const next = {
    ...getUserOnboardingState(),
    ...patch,
  }
  writeJson(USER_ONBOARDING_STATE_KEY, next)
  return next
}

export function markJustSignedUp() {
  window.localStorage.setItem(JUST_SIGNED_UP_KEY, "1")
}

export function consumeJustSignedUp() {
  const value = window.localStorage.getItem(JUST_SIGNED_UP_KEY) === "1"
  if (value) window.localStorage.removeItem(JUST_SIGNED_UP_KEY)
  return value
}

export function resolvePostLoginPath(isJustSignedUp = consumeJustSignedUp()) {
  const state = getUserOnboardingState()

  if (isJustSignedUp) return "/welcome"

  if (state.companyProfileStatus === "in_progress") return "/setup/company"

  if (state.companyProfileStatus === "completed" && state.analysisDraftId) {
    const draftStatus = state.analysisDraftStatus ?? "in_progress"
    if (draftStatus === "ready_for_review") {
      return `/analysis/review?draftId=${state.analysisDraftId}`
    }

    return `/analysis/new?draftId=${state.analysisDraftId}`
  }

  if (state.companyProfileStatus === "completed" && state.analysisCount === 0) {
    return "/analysis/new"
  }

  if (state.analysisCount > 0) return "/dashboard"

  return "/dashboard"
}

export function resolveStartAnalysisPath() {
  const state = getUserOnboardingState()

  if (state.companyProfileStatus !== "completed") return "/setup/company"

  if (state.analysisDraftId) {
    const draftStatus = state.analysisDraftStatus ?? "in_progress"
    if (draftStatus === "ready_for_review") {
      return `/analysis/review?draftId=${state.analysisDraftId}`
    }

    return `/analysis/new?draftId=${state.analysisDraftId}`
  }

  return "/analysis/new"
}
