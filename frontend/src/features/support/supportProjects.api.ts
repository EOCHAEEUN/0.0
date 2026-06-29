import type {
  PolicyApiItem,
  PolicyApiResponse,
  PolicyCounters,
  PolicySummary,
  SafetyPreview,
  SupportProject,
} from "./supportProjects.contract"
import { buildPolicyCounters, mapPolicyToProject, rankProjects, toNumberOrNull } from "./supportProjects.utils"

const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const AUTH_TOKEN_STORAGE_KEY = "factofit_access_token"
const POLICY_FETCH_LIMIT = 40

const policyCardsMemoryCache = new Map<string, { cards: SupportProject[]; counters: PolicyCounters }>()
const policyCardsInFlightCache = new Map<string, Promise<{ cards: SupportProject[]; counters: PolicyCounters }>>()
const policySummaryMemoryCache = new Map<string, PolicySummary>()
const policySummaryInFlightCache = new Map<string, Promise<PolicySummary>>()

function getApiBase() {
  const envBase = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"
  return String(envBase).replace(/\/$/, "")
}

function buildApiUrl(path: string) {
  const base = getApiBase()

  if (base.endsWith("/api")) {
    return `${base}${path.replace(/^\/api/, "")}`
  }

  return `${base}${path}`
}

export function getStoredCompanyId() {
  return window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || ""
}

export function getStoredAccessToken() {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ""
}

function getJsonHeaders() {
  const token = getStoredAccessToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function normalizePolicySummary(value: unknown): PolicySummary {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return {
    totalPolicyCount: toNumberOrNull(record.totalPolicyCount as number | string | null) ?? 0,
    activePolicyCount: toNumberOrNull(record.activePolicyCount as number | string | null) ?? 0,
    matchedPolicyCount: toNumberOrNull(record.matchedPolicyCount as number | string | null) ?? 0,
    priorityPolicyCount: toNumberOrNull(record.priorityPolicyCount as number | string | null) ?? 0,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  }
}

function getPolicyListFromResponse(json: PolicyApiResponse) {
  const data = json?.data ?? {}

  const policies =
    data.policies ||
    data.matched_policies ||
    data.raw_candidates ||
    json.policies ||
    json.matched_policies ||
    json.raw_candidates ||
    []

  return Array.isArray(policies) ? policies : []
}

function getCounterValue(...values: unknown[]) {
  for (const value of values) {
    const numberValue = toNumberOrNull(value as number | string | null)
    if (numberValue !== null) return numberValue
  }

  return 0
}

function extractCounters(json: PolicyApiResponse, cards: SupportProject[]): PolicyCounters {
  const data = json?.data ?? {}
  const totalPolicyCount = getCounterValue(
    data.total_policy_count,
    data.policy_total,
    data.database_total,
    data.total,
    json.total,
  )
  const industryMatchedCount = getCounterValue(
    data.industry_matched_count,
    data.candidate_count,
    data.raw_candidate_count,
    data.total,
    json.total,
  )
  const aiRecommendedCount = getCounterValue(
    data.ai_recommended_count,
    data.final_recommended_count,
  )
  const priorityCount = cards.length > 0 ? 1 : 0
  const otherMatchedCount = getCounterValue(data.other_matched_count)

  return buildPolicyCounters(cards, {
    totalPolicyCount,
    industryMatchedCount,
    aiRecommendedCount,
    priorityCount,
    otherMatchedCount,
  })
}

export async function fetchPolicyCards(
  companyId: string,
  equipmentId: string,
  analysisFingerprint: string,
): Promise<{ cards: SupportProject[]; counters: PolicyCounters }> {
  const cacheKey = `support-projects:${companyId}:${equipmentId || "all"}:${analysisFingerprint || "latest"}:${POLICY_FETCH_LIMIT}`

  const cached = policyCardsMemoryCache.get(cacheKey)
  if (cached) return cached

  const inFlight = policyCardsInFlightCache.get(cacheKey)
  if (inFlight) return inFlight

  const query = new URLSearchParams({
    company_id: companyId,
    limit: String(POLICY_FETCH_LIMIT),
  })
  if (equipmentId) {
    query.set("equipment_id", equipmentId)
  }
  const url = buildApiUrl(`/api/analyze/support-projects?${query.toString()}`)

  const requestPromise = fetch(url, {
    method: "GET",
    headers: {
      ...getJsonHeaders(),
    },
  })
    .then(async (response) => {
      const json = (await response.json().catch(() => ({}))) as PolicyApiResponse

      // DB/API 연동 검증 단계에서는 404/504도 숨기지 않습니다.
      // analyze 라우터가 없거나 실패하면 지원사업 화면이 error 상태로 드러나야 합니다.
      if (!response.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            `Support projects API failed: ${response.status}`,
        )
      }

      const policies = getPolicyListFromResponse(json)
      const cards = rankProjects(
        policies.map((policy: PolicyApiItem, index: number) =>
          mapPolicyToProject(policy, index),
        ),
      )
      const counters = extractCounters(json, cards)

      console.log("지원사업 API 응답:", {
        source: json?.data?.source,
        total: json?.data?.total,
        count: cards.length,
        message: json?.data?.message,
      })

      return { cards, counters }
    })
    .then((result) => {
      policyCardsMemoryCache.set(cacheKey, result)
      return result
    })
    .finally(() => {
      policyCardsInFlightCache.delete(cacheKey)
    })

  policyCardsInFlightCache.set(cacheKey, requestPromise)

  return requestPromise
}

export async function fetchPolicySummary(
  companyId: string,
  equipmentId: string,
): Promise<PolicySummary> {
  const cacheKey = `policy-summary:${companyId}:${equipmentId || "all"}`
  const cached = policySummaryMemoryCache.get(cacheKey)
  if (cached) return cached

  const inFlight = policySummaryInFlightCache.get(cacheKey)
  if (inFlight) return inFlight

  const query = new URLSearchParams({ company_id: companyId })
  if (equipmentId) query.set("equipment_id", equipmentId)

  const requestPromise = fetch(buildApiUrl(`/api/analyze/policy-summary?${query.toString()}`), {
    method: "GET",
    headers: {
      ...getJsonHeaders(),
    },
  })
    .then(async (response) => {
      const json = (await response.json().catch(() => ({}))) as {
        success?: boolean
        data?: unknown
        message?: string
        error?: string
      }

      if (!response.ok || json.success === false) {
        throw new Error(json.message || json.error || `Policy summary API failed: ${response.status}`)
      }

      return normalizePolicySummary(json.data)
    })
    .then((summary) => {
      policySummaryMemoryCache.set(cacheKey, summary)
      return summary
    })
    .finally(() => {
      policySummaryInFlightCache.delete(cacheKey)
    })

  policySummaryInFlightCache.set(cacheKey, requestPromise)
  return requestPromise
}

function buildSafetyPreviewUrl(
  analysisId: string,
  policyId: string,
  equipmentId?: string | null,
  investmentPlanId?: string | null,
) {
  const query = new URLSearchParams()
  if (equipmentId) query.set("equipment_id", equipmentId)
  if (investmentPlanId) query.set("investment_plan_id", investmentPlanId)

  const suffix = query.toString() ? `?${query.toString()}` : ""
  return buildApiUrl(
    `/api/analysis/${encodeURIComponent(analysisId)}/policies/${encodeURIComponent(policyId)}/safety-preview${suffix}`,
  )
}

export async function fetchSafetyPreview({
  analysisId,
  policyId,
  equipmentId,
  investmentPlanId,
}: {
  analysisId: string
  policyId: string
  equipmentId?: string | null
  investmentPlanId?: string | null
}): Promise<SafetyPreview | null> {
  const response = await fetch(
    buildSafetyPreviewUrl(analysisId, policyId, equipmentId, investmentPlanId),
    {
      method: "GET",
      headers: getJsonHeaders(),
    },
  )
  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean
    data?: SafetyPreview | null
    message?: string
    error?: string
  }

  if (response.status === 404) return null
  if (!response.ok || json.success === false) {
    throw new Error(json.message || json.error || `Safety preview API failed: ${response.status}`)
  }

  return json.data ?? null
}

export async function generateSafetyPreview({
  analysisId,
  policyId,
  equipmentId,
  investmentPlanId,
  body,
}: {
  analysisId: string
  policyId: string
  equipmentId?: string | null
  investmentPlanId?: string | null
  body: Record<string, unknown>
}): Promise<SafetyPreview | null> {
  const response = await fetch(
    buildSafetyPreviewUrl(analysisId, policyId, equipmentId, investmentPlanId),
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(body),
    },
  )
  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean
    data?: SafetyPreview | null
    message?: string
    error?: string
  }

  if (!response.ok || json.success === false) {
    throw new Error(json.message || json.error || `Safety preview generation failed: ${response.status}`)
  }

  return json.data ?? null
}
