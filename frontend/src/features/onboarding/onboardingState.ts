import { getCurrentUserId } from "../../services/auth"

export type CompanyProfileStatus = "not_started" | "in_progress" | "completed"
export type EquipmentSetupStatus = "not_started" | "in_progress" | "completed"
export type AnalysisDraftStatus = "in_progress" | "ready_for_review" | "completed"

export type CompanyProfileDraft = {
  companyName: string
  companyType: string
  regionSido: string
  regionSigungu: string
  industry: string
  industryCode: string
  employeeRange: string
  employees: string
  annualRevenue: string
  businessNumber: string
  purpose: string
  businessSiteType: string
  foundedYear?: string
  revenueRange?: string
  smartFactoryStatus?: string
  status: CompanyProfileStatus
  updatedAt?: string
}

export type UserOnboardingState = {
  companyProfileStatus: CompanyProfileStatus
  equipmentSetupStatus: EquipmentSetupStatus
  companyId?: string
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
  defectRate?: string
  contributionMarginWon?: string
  process?: string
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
  priorityPolicyId?: string
  recommendedScenario: string
  companyId?: string
  equipmentId?: string
  roiResult?: unknown
  policies?: unknown[]
  policyStatus?: string
  policyError?: string | null
  analysisInput?: AnalysisConditionDraft
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
  defectRate: "",
  contributionMarginWon: "",
  process: "",
}

export const emptyCompanyProfileDraft: CompanyProfileDraft = {
  companyName: "",
  companyType: "선택 필요",
  regionSido: "",
  regionSigungu: "",
  industry: "",
  industryCode: "",
  employeeRange: "",
  employees: "",
  annualRevenue: "",
  businessNumber: "",
  purpose: "선택 필요",
  businessSiteType: "선택 필요",
  foundedYear: "",
  revenueRange: "",
  smartFactoryStatus: "",
  status: "not_started",
}

const defaultOnboardingState: UserOnboardingState = {
  companyProfileStatus: "not_started",
  equipmentSetupStatus: "not_started",
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

function compactScenarioMetrics(record: Record<string, unknown>) {
  const compact: Record<string, unknown> = {}
  const numericKeys = [
    "investment_manwon",
    "subsidy_manwon",
    "net_investment_manwon",
    "net_cost_manwon",
    "annual_net_benefit_manwon",
    "annual_saving_manwon",
    "saving_manwon",
    "roi_pct",
    "roi_percent",
    "payback_years",
    "paybackYears",
  ]

  for (const key of numericKeys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      compact[key] = value
    }
  }

  const policyApplication = record.policy_application
  if (policyApplication && typeof policyApplication === "object" && !Array.isArray(policyApplication)) {
    const pa = policyApplication as Record<string, unknown>
    const status = typeof pa.status === "string" ? pa.status : ""
    const amount = pa.applied_support_manwon
    if (status || (typeof amount === "number" && Number.isFinite(amount))) {
      compact.policy_application = {
        ...(status ? { status } : {}),
        ...(typeof amount === "number" && Number.isFinite(amount)
          ? { applied_support_manwon: amount }
          : {}),
      }
    }
  }

  return compact
}

function extractPriorityPolicyId(policies: unknown[], fallback?: string) {
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim()
  if (!Array.isArray(policies) || policies.length === 0) return undefined
  const first = policies[0] as Record<string, unknown>
  const id = first.policyId ?? first.policy_id ?? first.policyID ?? first.id
  return id ? String(id) : undefined
}

function buildPersistedAnalysisResult(result: AnalysisResultSnapshot): AnalysisResultSnapshot {
  const roiResultRecord =
    result.roiResult && typeof result.roiResult === "object" && !Array.isArray(result.roiResult)
      ? (result.roiResult as Record<string, unknown>)
      : {}
  const scenarioA =
    roiResultRecord.scenario_a && typeof roiResultRecord.scenario_a === "object" && !Array.isArray(roiResultRecord.scenario_a)
      ? compactScenarioMetrics(roiResultRecord.scenario_a as Record<string, unknown>)
      : {}
  const scenarioB =
    roiResultRecord.scenario_b && typeof roiResultRecord.scenario_b === "object" && !Array.isArray(roiResultRecord.scenario_b)
      ? compactScenarioMetrics(roiResultRecord.scenario_b as Record<string, unknown>)
      : {}
  const aiRecommendation =
    roiResultRecord.ai_recommendation && typeof roiResultRecord.ai_recommendation === "object" && !Array.isArray(roiResultRecord.ai_recommendation)
      ? (roiResultRecord.ai_recommendation as Record<string, unknown>)
      : {}
  const recommendationDetail =
    typeof result.recommendationDetail === "string"
      ? result.recommendationDetail.slice(0, 500)
      : ""
  const aiSummary =
    typeof aiRecommendation.summary === "string"
      ? aiRecommendation.summary.slice(0, 500)
      : recommendationDetail

  return {
    schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION,
    id: result.id,
    equipmentName: result.equipmentName,
    recommendation: result.recommendation,
    recommendationDetail,
    roiPct: result.roiPct,
    roiPercent: result.roiPercent ?? result.roiPct,
    paybackYears: result.paybackYears,
    matchedPolicies: result.matchedPolicies,
    priorityPolicies: result.priorityPolicies,
    priorityPolicyName: result.priorityPolicyName,
    priorityPolicyId: extractPriorityPolicyId(result.policies ?? [], result.priorityPolicyId),
    recommendedScenario: result.recommendedScenario,
    companyId: result.companyId,
    equipmentId: result.equipmentId,
    roiResult: {
      recommended:
        typeof roiResultRecord.recommended === "string"
          ? roiResultRecord.recommended
          : result.recommendedScenario,
      ...(Object.keys(scenarioA).length > 0 ? { scenario_a: scenarioA } : {}),
      ...(Object.keys(scenarioB).length > 0 ? { scenario_b: scenarioB } : {}),
      ai_recommendation: {
        summary: aiSummary,
        reason_bullets: Array.isArray(aiRecommendation.reason_bullets)
          ? aiRecommendation.reason_bullets
              .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              .slice(0, 3)
          : [],
      },
    },
    policyStatus: result.policyStatus,
    policyError: result.policyError ?? null,
    createdAt: result.createdAt,
  }
}

function tryWriteAnalysisCache(key: string, value: unknown) {
  try {
    writeJsonWithOwner(key, value)
    return true
  } catch (error) {
    if (isQuotaExceededError(error)) return false
    console.warn("[onboarding-analysis] analysis cache write failed unexpectedly.", error)
    return false
  }
}

function pruneAnalysisResultCache(keepId: string) {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(`${ANALYSIS_RESULT_KEY}:`)) continue
    if (key === getAnalysisResultByIdKey(keepId)) continue
    window.localStorage.removeItem(key)
  }
}

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  )
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
  if (!latest || latest.schemaVersion !== ANALYSIS_RESULT_SCHEMA_VERSION) return null

  if (latest.id && !latest.equipmentName) {
    const scoped = readJsonOwnedByCurrentUser<AnalysisResultSnapshot>(
      getAnalysisResultByIdKey(latest.id),
    )
    return isCurrentAnalysisResult(scoped) ? scoped : null
  }

  return isCurrentAnalysisResult(latest) ? latest : null
}

export function saveAnalysisResult(
  result: AnalysisResultSnapshot,
): AnalysisResultSnapshot {
  const next = buildPersistedAnalysisResult({
    ...result,
    roiPercent: result.roiPercent ?? result.roiPct,
  })

  console.debug("[onboarding-analysis] saving result snapshot", {
    id: next.id,
    roiPct: next.roiPct,
    roiPercent: next.roiPercent,
    paybackYears: next.paybackYears,
    recommendedScenario: next.recommendedScenario,
    matchedPolicies: next.matchedPolicies,
    priorityPolicies: next.priorityPolicies,
  })

  const latestPointer = { schemaVersion: next.schemaVersion, id: next.id }
  const scopedKey = getAnalysisResultByIdKey(next.id)
  let cached =
    tryWriteAnalysisCache(scopedKey, next) && tryWriteAnalysisCache(ANALYSIS_RESULT_KEY, latestPointer)

  if (!cached) {
    console.warn("[onboarding-analysis] analysis cache quota exceeded; pruning scoped cache.", {
      id: next.id,
    })
    pruneAnalysisResultCache(next.id)
    cached =
      tryWriteAnalysisCache(scopedKey, next) &&
      tryWriteAnalysisCache(ANALYSIS_RESULT_KEY, latestPointer)
  }

  if (!cached) {
    console.warn(
      "[onboarding-analysis] analysis cache write skipped after quota retry; continuing without cache.",
      { id: next.id },
    )
  }

  try {
    updateUserOnboardingState({
      analysisDraftId: next.id,
      analysisDraftStatus: "completed",
      analysisCount: Math.max(1, getUserOnboardingState().analysisCount),
    })
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn("[onboarding-analysis] onboarding state update skipped after quota error.", {
        id: next.id,
      })
    } else {
      console.warn("[onboarding-analysis] onboarding state update failed unexpectedly.", error)
    }
  }
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
  const storedCompanyId = window.localStorage.getItem("factofit_company_id") ?? ""
  const storedEquipmentId = window.localStorage.getItem("factofit_equipment_id") ?? ""

  return {
    ...defaultOnboardingState,
    ...stored,
    companyProfileStatus:
      stored.companyProfileStatus ?? draft.status ?? "not_started",
    equipmentSetupStatus: storedEquipmentId
      ? "completed"
      : stored.equipmentSetupStatus ?? "not_started",
    companyId: stored.companyId ?? (storedCompanyId || undefined),
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

  if (state.companyProfileStatus !== "completed") return "/setup/company"

  if (state.equipmentSetupStatus !== "completed") return "/setup/equipment"

  if (state.companyProfileStatus === "completed" && state.analysisDraftId) {
    const draftStatus = state.analysisDraftStatus ?? "in_progress"
    if (draftStatus === "completed") return "/dashboard"
    if (draftStatus === "ready_for_review") {
      return `/analysis/review?draftId=${state.analysisDraftId}`
    }

    return `/analysis/new?draftId=${state.analysisDraftId}`
  }

  return "/dashboard"
}

export function resolveStartAnalysisPath() {
  return "/analysis/new"
}
