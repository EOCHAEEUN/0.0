import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  fetchDashboardOnboarding,
  fetchDashboardOverview,
  getStoredCompanyId,
  getStoredDashboardActiveAnalysisId,
} from "../dashboard.api"
import type { DashboardOverviewResponse } from "../dashboard.contract"
import {
  mapDashboardOverview,
  type DashboardViewModel,
} from "../mappers/dashboardMapper"

export type DashboardDataState = {
  dashboard: DashboardViewModel
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

type UseDashboardDataOptions = {
  preferredAnalysisId?: string
}

const EMPTY_DASHBOARD: DashboardViewModel = {
  companyRows: [],
  equipmentRows: [],
  workspace: {
    status: "empty",
    analysisId: null,
    companyName: "",
    industryLabel: "",
    regionLabel: "",
    actionCount: 0,
    equipmentCount: 0,
    priorityEquipmentCount: 0,
    recentAnalysisCount: 0,
    nearestDeadlineSummary: "",
    briefingTitle: "",
    recentStatusMessage: "",
    equipmentName: "대표 설비",
    actionTitle: "",
    actionMessage: "",
    priorityPolicyTitle: "",
    priorityPolicyId: null,
    deadlinePolicyId: null,
    matchedPolicyCount: "0",
    needsText: "",
    priorityChips: [],
    roiPath: "/roi",
    policyPath: "/support-projects",
    draftPath: "/analysis/new",
    advisorPath: "/advisor",
    engiTitle: "",
    kpis: [],
    analysisMetricText: "",
    recommendedScenarioName: "",
    summaryStatusText: "",
    policySummary: {
      totalPolicyCount: "0",
      activePolicyCount: "0",
      matchedPolicyCount: "0",
    },
    deadline: {
      label: "",
      dday: "-",
      policyTitle: "-",
      supportAmountText: "-",
      deadlineDisplay: "-",
      policyId: null,
    },
    deadlineList: {
      title: "마감 일정",
      subtitle: "",
      viewAllLabel: "전체 보기",
      emptyMessage: "",
      items: [],
    },
    progressText: "",
    nextStepText: "",
    engiMessage: "",
    analyses: [],
    hasMoreAnalyses: false,
    equipmentManagePath: "/equipment",
    newRoiPath: "/roi",
    newAnalysisPath: "/analysis/new",
  },
  isFallback: true,
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "대시보드 데이터를 불러오지 못했습니다."
}

export function useDashboardData(options?: UseDashboardDataOptions): DashboardDataState {
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestSequenceRef = useRef(0)

  const resolvedAnalysisId = useMemo(() => {
    return (
      options?.preferredAnalysisId?.trim() ||
      getStoredDashboardActiveAnalysisId() ||
      undefined
    )
  }, [options?.preferredAnalysisId])

  const refetch = useCallback(async () => {
    const requestSequence = requestSequenceRef.current + 1
    requestSequenceRef.current = requestSequence
    setLoading(true)
    setError(null)

    try {
      const onboarding = await fetchDashboardOnboarding()
      if (requestSequence !== requestSequenceRef.current) return

      const companyId =
        onboarding?.company?.company_id || getStoredCompanyId() || ""

      if (!companyId) {
        setOverview({
          empty_state: "company_missing",
          company: onboarding?.company ?? undefined,
        })
        return
      }

      const nextOverview = await fetchDashboardOverview({
        companyId,
        analysisId: resolvedAnalysisId,
      })

      if (requestSequence !== requestSequenceRef.current) return
      setOverview(nextOverview)
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return
      setError(getErrorMessage(nextError))
    } finally {
      if (requestSequence !== requestSequenceRef.current) return
      setLoading(false)
    }
  }, [resolvedAnalysisId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    const handleDashboardRefresh = () => {
      void refetch()
    }
    window.addEventListener("factofit:dashboard-refresh", handleDashboardRefresh)
    return () => {
      window.removeEventListener("factofit:dashboard-refresh", handleDashboardRefresh)
    }
  }, [refetch])

  const dashboard = useMemo(() => {
    if (overview && overview.company?.company_id) {
      return mapDashboardOverview(overview)
    }
    return EMPTY_DASHBOARD
  }, [overview])

  return {
    dashboard,
    loading,
    error,
    refetch,
  }
}
