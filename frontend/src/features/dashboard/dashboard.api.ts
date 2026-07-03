import type {
  DashboardAnalysisStorage,
  DashboardOnboardingMeResponse,
  DashboardOverviewResponse,
} from "./dashboard.contract"
import { getCurrentUserId } from "../../services/auth"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
const ACCESS_TOKEN_STORAGE_KEY = "factofit_access_token"
const AUTH_SESSION_STORAGE_KEY = "factofit_auth_session"
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"
const DASHBOARD_ACTIVE_ANALYSIS_KEY = "factofit_dashboard_active_analysis_id"
const COMPANY_ID_STORAGE_KEY = "factofit_company_id"

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

function getStoredAuthSession() {
  if (typeof window === "undefined") return null

  return safeJsonParse<Record<string, unknown>>(
    window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY),
  )
}

export function getDashboardAccessToken() {
  if (typeof window === "undefined") return null

  const directToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  if (directToken?.trim()) return directToken.trim()

  const session = getStoredAuthSession()
  const token = session?.access_token

  return typeof token === "string" && token.trim() ? token.trim() : null
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

  const response = await fetch(buildApiUrl("/api/onboarding/me"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
  })

  const responseText = await response.text()

  if (!response.ok) {
    console.error("[Dashboard company context] fetch failed", {
      status: response.status,
      hasToken: Boolean(accessToken),
      response: responseText.slice(0, 300),
    })
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
  window.dispatchEvent(new CustomEvent("factofit:dashboard-refresh"))
}
