import type { PolicyApiItem, PolicyApiResponse, PolicyCounters, SupportProject } from "./supportProjects.contract"
import { buildPolicyCounters, mapPolicyToProject, rankProjects, toNumberOrNull } from "./supportProjects.utils"

const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const AUTH_TOKEN_STORAGE_KEY = "factofit_access_token"
const POLICY_FETCH_LIMIT = 40

const policyCardsMemoryCache = new Map<string, { cards: SupportProject[]; counters: PolicyCounters }>()
const policyCardsInFlightCache = new Map<string, Promise<{ cards: SupportProject[]; counters: PolicyCounters }>>()

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
  analysisFingerprint: string,
): Promise<{ cards: SupportProject[]; counters: PolicyCounters }> {
  const cacheKey = `policies:${companyId}:${analysisFingerprint || "latest"}:${POLICY_FETCH_LIMIT}`

  const cached = policyCardsMemoryCache.get(cacheKey)
  if (cached) return cached

  const inFlight = policyCardsInFlightCache.get(cacheKey)
  if (inFlight) return inFlight

  const token = getStoredAccessToken()
  const url = buildApiUrl(
    `/api/policies?company_id=${encodeURIComponent(companyId)}&limit=${POLICY_FETCH_LIMIT}`,
  )

  const requestPromise = fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
    .then(async (response) => {
      const json = (await response.json().catch(() => ({}))) as PolicyApiResponse

      if (!response.ok) {
        if (response.status === 504) {
          console.warn("정책 추천 timeout fallback:", json)
          return { cards: [], counters: buildPolicyCounters([]) }
        }

        throw new Error(
          json?.message ||
            json?.error ||
            `Policy API failed: ${response.status}`,
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
