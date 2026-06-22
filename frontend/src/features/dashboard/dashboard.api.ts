import type {
  DashboardAnalysisStorage,
  DashboardOnboardingMeResponse,
} from "./dashboard.contract"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
const ACCESS_TOKEN_STORAGE_KEY = "factofit_access_token"
const AUTH_SESSION_STORAGE_KEY = "factofit_auth_session"
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
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

  return safeJsonParse<DashboardAnalysisStorage>(
    window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY),
  )
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
  const responseData = safeJsonParse<DashboardOnboardingMeResponse>(responseText)

  if (!response.ok) {
    throw new Error(`마이페이지 온보딩 조회에 실패했습니다. (${response.status})`)
  }

  return responseData
}
