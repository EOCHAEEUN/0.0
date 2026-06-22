import type {
  DashboardAnalysisStorage,
  DashboardOnboardingMeResponse,
} from "./dashboard.contract"
import { apiFetch } from "../../services/apiClient"

const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"

export function safeJsonParse<T = unknown>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function getStoredDashboardAnalysisResult() {
  if (typeof window === "undefined") return null

  return safeJsonParse<DashboardAnalysisStorage>(
    window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY),
  )
}

export async function fetchDashboardOnboarding() {
  const response = await apiFetch("/onboarding/me", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  const responseText = await response.text()
  const responseData = safeJsonParse<DashboardOnboardingMeResponse>(responseText)

  if (!response.ok) {
    throw new Error(`마이페이지 온보딩 조회에 실패했습니다. (${response.status})`)
  }

  return responseData
}
