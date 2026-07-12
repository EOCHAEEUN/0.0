import type {
  DashboardAnalysisStorage,
  DashboardOnboardingMeResponse,
  DashboardOverviewResponse,
} from "./dashboard.contract"
import {
  getAccessToken,
  getCurrentUserId,
  markAuthExpired,
  refreshAccessToken,
} from "../../services/auth"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"
const DASHBOARD_ACTIVE_ANALYSIS_KEY = "factofit_dashboard_active_analysis_id"
const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const ONBOARDING_CACHE_TTL_MS = 45_000

type OnboardingCacheEntry = {
  key: string
  expiresAt: number
  data: DashboardOnboardingMeResponse | null
  promise: Promise<DashboardOnboardingMeResponse | null> | null
}

let onboardingCache: OnboardingCacheEntry | null = null

function buildApiUrl(path: string) {
  const normalizedBase = API_BASE_URL
    .replace(/\/+$/, "")
    .replace(/\/api$/, "")

  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return `${normalizedBase}${normalizedPath}`
}

export function safeJsonParse<T = unknown>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function getDashboardAccessToken() {
  return getAccessToken()
}

function getOnboardingCacheKey(accessToken: string) {
  return `${getCurrentUserId() || "anonymous"}:${accessToken.slice(-16)}`
}

export function clearDashboardOnboardingCache() {
  onboardingCache = null
}

export function getStoredDashboardAnalysisResult() {
  if (typeof window === "undefined") return null

  const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY)
  if (!raw) return null

  const parsed = safeJsonParse<DashboardAnalysisStorage & { ownerId?: string | null }>(raw)
  if (!parsed) return null

  const currentUserId = getCurrentUserId()

  if (currentUserId && !parsed.ownerId) {
    // 레거시 데이터 (ownerId 없음) → 제거 후 거부
    window.localStorage.removeItem(ANALYSIS_RESULT_STORAGE_KEY)
    return null
  }

  if (currentUserId && parsed.ownerId && parsed.ownerId !== currentUserId) {
    // 다른 사용자 데이터 → 거부
    return null
  }

  return parsed
}

export async function fetchDashboardOnboarding() {
  const accessToken = getDashboardAccessToken()
  if (!accessToken) return null
  const cacheKey = getOnboardingCacheKey(accessToken)
  const now = Date.now()

  if (onboardingCache?.key === cacheKey) {
    if (onboardingCache.promise) return onboardingCache.promise
    if (onboardingCache.expiresAt > now) return onboardingCache.data
  }

  const request = fetchDashboardOnboardingUncached(accessToken, cacheKey)
  onboardingCache = {
    key: cacheKey,
    expiresAt: 0,
    data: null,
    promise: request,
  }

  return request
}

async function fetchDashboardOnboardingUncached(
  accessToken: string,
  cacheKey: string,
) {
  const send = (token: string) =>
    fetch(buildApiUrl("/api/onboarding/me"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    })

  let response = await send(accessToken)

  if (response.status === 401) {
    // access token 만료 가능성 — refresh 1회 후 원 요청 1회만 재시도.
    // refresh token 무효면 refreshAccessToken이 세션을 삭제하고 throw하며,
    // 일시 장애(네트워크/5xx)면 세션을 유지한 채 throw한다.
    response = await send(await refreshAccessToken())
  }

  const responseText = await response.text()

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      markAuthExpired("로그인이 만료되었습니다. 다시 로그인해주세요.")
    }
    console.error("[Dashboard company context] fetch failed", {
      status: response.status,
      hasToken: Boolean(accessToken),
      response: responseText.slice(0, 300),
    })
    if (response.status === 401) {
      // refresh 성공 후에도 401 — 무효 판정 없이는 세션을 지우지 않는다
      throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.")
    }
    throw new Error(`마이페이지 온보딩 조회에 실패했습니다. (${response.status})`)
  }

  const raw = safeJsonParse<{ success: boolean; data: DashboardOnboardingMeResponse }>(responseText)

  if (!raw?.data) {
    console.error("[Dashboard company context] unexpected response shape", {
      keys: Object.keys(raw ?? {}),
      snippet: responseText.slice(0, 200),
    })
    return null
  }

  const onboarding = raw.data
  onboardingCache = {
    key: cacheKey,
    expiresAt: Date.now() + ONBOARDING_CACHE_TTL_MS,
    data: onboarding,
    promise: null,
  }

  return onboarding
}

export function getStoredCompanyId() {
  if (typeof window === "undefined") return ""
  return (
    window.localStorage.getItem(COMPANY_ID_STORAGE_KEY)?.trim() ||
    window.localStorage.getItem("company_id")?.trim() ||
    ""
  )
}

export function getStoredDashboardActiveAnalysisId() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(DASHBOARD_ACTIVE_ANALYSIS_KEY)?.trim() || ""
}

export function setStoredDashboardActiveAnalysisId(analysisId: string) {
  if (typeof window === "undefined" || !analysisId.trim()) return
  window.localStorage.setItem(DASHBOARD_ACTIVE_ANALYSIS_KEY, analysisId.trim())
}

export async function fetchDashboardOverview(params: {
  companyId: string
  analysisId?: string
}) {
  const accessToken = getDashboardAccessToken()
  const search = new URLSearchParams({ company_id: params.companyId })
  if (params.analysisId) search.set("analysis_id", params.analysisId)

  const response = await fetch(buildApiUrl(`/api/dashboard/overview?${search}`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
  })

  const responseText = await response.text()
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      markAuthExpired("로그인이 만료되었습니다. 다시 로그인해주세요.")
    }
    throw new Error(
      `대시보드 정보를 불러오지 못했습니다. (${response.status}) ${responseText.slice(0, 120)}`,
    )
  }

  const raw = safeJsonParse<{ success: boolean; data: DashboardOverviewResponse }>(
    responseText,
  )
  if (!raw?.data) {
    throw new Error("대시보드 응답 형식이 올바르지 않습니다.")
  }

  if (raw.data.active_analysis?.analysis_id) {
    setStoredDashboardActiveAnalysisId(raw.data.active_analysis.analysis_id)
  }

  return raw.data
}

export async function patchRepresentativeEquipment(params: {
  companyId: string
  equipmentId: string | null
}) {
  const accessToken = getDashboardAccessToken()
  const response = await fetch(
    buildApiUrl(`/api/companies/${encodeURIComponent(params.companyId)}/representative-equipment`),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ equipment_id: params.equipmentId }),
    },
  )

  const responseText = await response.text()
  const payload = safeJsonParse<{
    success?: boolean
    data?: {
      representative_equipment_id?: string | null
      equipment_name?: string | null
      cleared?: boolean
    }
    detail?: string
  }>(responseText)

  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : responseText.slice(0, 120)
    throw new Error(detail || "대표 설비를 저장하지 못했습니다.")
  }

  notifyDashboardRefresh()
  return payload
}

export function notifyDashboardRefresh() {
  if (typeof window === "undefined") return
  clearDashboardOnboardingCache()
  window.dispatchEvent(new CustomEvent("factofit:dashboard-refresh"))
}
