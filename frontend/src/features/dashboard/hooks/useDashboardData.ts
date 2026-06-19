import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchDashboardOnboarding,
  getStoredDashboardAnalysisResult,
} from "../dashboard.api"
import type {
  DashboardAnalysisStorage,
  DashboardOnboardingMeResponse,
} from "../dashboard.contract"
import {
  mapDashboardData,
  type DashboardViewModel,
} from "../mappers/dashboardMapper"

export type DashboardDataState = {
  dashboard: DashboardViewModel
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "대시보드 데이터를 불러오지 못했습니다."
}

export function useDashboardData(): DashboardDataState {
  const [onboarding, setOnboarding] =
    useState<DashboardOnboardingMeResponse | null>(null)
  const [analysis, setAnalysis] = useState<DashboardAnalysisStorage | null>(() =>
    getStoredDashboardAnalysisResult(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [nextOnboarding, nextAnalysis] = await Promise.all([
        fetchDashboardOnboarding(),
        Promise.resolve(getStoredDashboardAnalysisResult()),
      ])

      setOnboarding(nextOnboarding)
      setAnalysis(nextAnalysis)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
      setAnalysis(getStoredDashboardAnalysisResult())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const dashboard = useMemo(
    () => mapDashboardData({ onboarding, analysis }),
    [onboarding, analysis],
  )

  return {
    dashboard,
    loading,
    error,
    refetch,
  }
}
