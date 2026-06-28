import { getCurrentUserId } from "../../services/auth"

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

// ── 사용자별 소유권 검증 읽기/쓰기 ─────────────────────────────────────────────

function readJsonOwnedByCurrentUser<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const currentUserId = getCurrentUserId()

    if (!currentUserId) {
      // 세션 없음 → 어떤 데이터도 반환하지 않음
      return null
    }

    if (!parsed.ownerId) {
      // ownerId 없는 레거시 데이터 → 제거 후 거부
      window.localStorage.removeItem(key)
      console.warn("[ONBOARDING DEBUG] legacy data without ownerId removed:", key)
      return null
    }

    if (parsed.ownerId !== currentUserId) {
      // 다른 사용자 데이터 → 거부
      console.warn("[ONBOARDING DEBUG] ownerId mismatch — ignoring:", key, { stored: parsed.ownerId, current: currentUserId })
      return null
    }

    return parsed as T
  } catch {
    return null
  }
}

function writeJsonWithOwner(key: string, value: unknown) {
  const currentUserId = getCurrentUserId()
  const stored = currentUserId
    ? { ...(value as object), ownerId: currentUserId }
    : value
  window.localStorage.setItem(key, JSON.stringify(stored))
}

// ── 공개 읽기 함수 ─────────────────────────────────────────────────────────────

export function getCompanyProfileDraft(): CompanyProfileDraft {
  const stored = readJsonOwnedByCurrentUser<Partial<CompanyProfileDraft>>(COMPANY_PROFILE_DRAFT_KEY) ?? {}
  return {
    ...emptyCompanyProfileDraft,
    ...stored,
  }
}

export function getAnalysisConditionDraft(): AnalysisConditionDraft {
  const stored = readJsonOwnedByCurrentUser<Partial<AnalysisConditionDraft>>(ANALYSIS_CONDITION_DRAFT_KEY) ?? {}
  return {
    ...emptyAnalysisConditionDraft,
    ...stored,
  }
}

export function saveAnalysisConditionDraft(
  draft: AnalysisConditionDraft,
): AnalysisConditionDraft {
  writeJsonWithOwner(ANALYSIS_CONDITION_DRAFT_KEY, draft)
  return draft
}

function getAnalysisResultByIdKey(id: string) {
  return `${ANALYSIS_RESULT_KEY}:${id}`
}

function isCurrentAnalysisResult(
  result: AnalysisResultSnapshot | null | undefined,
): result is AnalysisResultSnapshot {
  return result?.schemaVersion === ANALYSIS_RESULT_SCHEMA_VERSION
}

export function getAnalysisResult(id?: string): AnalysisResultSnapshot | null {
  if (id) {
    const scoped = readJsonOwnedByCurrentUser<AnalysisResultSnapshot>(getAnalysisResultByIdKey(id))
    return isCurrentAnalysisResult(scoped) ? scoped : null
  }

  const latest = readJsonOwnedByCurrentUser<AnalysisResultSnapshot>(ANALYSIS_RESULT_KEY)
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

  writeJsonWithOwner(ANALYSIS_RESULT_KEY, next)
  writeJsonWithOwner(getAnalysisResultByIdKey(next.id), next)
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
  writeJsonWithOwner(COMPANY_PROFILE_DRAFT_KEY, next)
  updateUserOnboardingState({ companyProfileStatus: next.status })
  return next
}

export function getUserOnboardingState(): UserOnboardingState {
  const stored =
    readJsonOwnedByCurrentUser<Partial<UserOnboardingState>>(USER_ONBOARDING_STATE_KEY) ?? {}
  const draft = getCompanyProfileDraft()
  const analysis = readJsonOwnedByCurrentUser<Record<string, unknown>>(ANALYSIS_RESULT_KEY)
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
  writeJsonWithOwner(USER_ONBOARDING_STATE_KEY, next)
  return next
}

// ── 신규 가입/로그아웃 시 데이터 초기화 ────────────────────────────────────────

export function clearUserOnboardingData() {
  window.localStorage.removeItem(COMPANY_PROFILE_DRAFT_KEY)
  window.localStorage.removeItem(USER_ONBOARDING_STATE_KEY)
  window.localStorage.removeItem(ANALYSIS_CONDITION_DRAFT_KEY)
  window.localStorage.removeItem(ANALYSIS_RESULT_KEY)
  // 사용자별 캐시 — 전 사용자의 데이터가 신규 사용자에게 노출되지 않도록 전체 초기화
  window.localStorage.removeItem("factofit_mypage_profile")
  window.localStorage.removeItem("factofit_company_id")
  window.localStorage.removeItem("factofit_equipment_id")
  window.localStorage.removeItem("factofit_selected_equipment_id")
  window.localStorage.removeItem("factofit_selected_project")
  window.localStorage.removeItem("factofit_selected_policy")
  window.localStorage.removeItem("factofit_selected_policy_id")
  window.localStorage.removeItem("factofit_policy_id")
  window.localStorage.removeItem("factofit_application_policy")
  window.localStorage.removeItem("factofit_selected_support_project")
}

// ── 가입 직후 플래그 ────────────────────────────────────────────────────────────

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
    if (draftStatus === "completed") return "/dashboard"
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
