import { getAccessToken } from "../../../services/auth"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

function buildApiUrl(path: string) {
  const normalizedBase = API_BASE_URL
    .replace(/\/+$/, "")
    .replace(/\/api$/, "")

  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return `${normalizedBase}${normalizedPath}`
}

export type LoginBriefingRecommendation = {
  policy_id: string | null
  title: string
  match_score: number | null
  scenario_label: string | null
}

export type LoginBriefingNotice = {
  policy_id: string | null
  title: string
  organization: string | null
  posted_at: string | null
  deadline: string | null
}

export type LoginBriefingResponse = {
  user_name: string | null
  company_name: string | null
  analysis_id: string | null
  equipment_id: string | null
  has_analysis: boolean
  available_policy_count: number | null
  expected_support_manwon: number | null
  expected_support_label: "recommended" | "max_scenario" | "none" | null
  expected_roi_percent: number | null
  hero_summary: string
  recommendations: LoginBriefingRecommendation[]
  notices: LoginBriefingNotice[]
}

function getStoredAnalysisId() {
  if (typeof window === "undefined") return undefined
  return (
    window.localStorage.getItem("factofit_analysis_id")?.trim() ||
    window.localStorage.getItem("factofit_dashboard_active_analysis_id")?.trim() ||
    undefined
  )
}

export async function fetchLoginBriefing(): Promise<LoginBriefingResponse> {
  const token = getAccessToken()
  if (!token) {
    throw new Error("로그인 세션이 없습니다.")
  }

  const analysisId = getStoredAnalysisId()
  const query = analysisId ? `?analysis_id=${encodeURIComponent(analysisId)}` : ""
  const response = await fetch(buildApiUrl(`/api/login/briefing${query}`), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error("진단 정보를 불러오지 못했습니다.")
  }

  const payload = (await response.json()) as {
    success?: boolean
    data?: LoginBriefingResponse
  }

  if (!payload?.data) {
    throw new Error("진단 정보를 불러오지 못했습니다.")
  }

  return payload.data
}
