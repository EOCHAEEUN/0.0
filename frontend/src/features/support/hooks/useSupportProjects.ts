import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  PolicyCounters,
  PolicySummary,
  PolicyState,
  SupportProject,
} from "../supportProjects.contract"
import {
  fetchPolicyCards,
  fetchPolicySummary,
  getStoredCompanyId,
  PolicyCardsApiError,
} from "../supportProjects.api"
import {
  buildPolicyCounters,
  getAnalysisFingerprint,
  getEquipmentContext,
  rankProjects,
  readAnalysisData,
} from "../supportProjects.utils"

const FINAL_RECOMMENDED_LIMIT = 5
const EMPTY_POLICY_SUMMARY: PolicySummary = {
  totalPolicyCount: 0,
  activePolicyCount: 0,
  matchedPolicyCount: 0,
  priorityPolicyCount: 0,
  updatedAt: "",
}

function normalizeProjectIds(projects: SupportProject[]) {
  return projects.map((project, index) => ({
    ...project,
    id: index + 1,
    rawId: project.rawId || `policy-${index + 1}`,
  }))
}

export function useSupportProjects(options?: { analysisId?: string; enabled?: boolean }) {
  const analysisId = options?.analysisId
  const enabled = options?.enabled ?? true
  const [policyState, setPolicyState] = useState<PolicyState>("loading")
  const [policyCards, setPolicyCards] = useState<SupportProject[]>([])
  const [policyCounters, setPolicyCounters] = useState<PolicyCounters>(() =>
    buildPolicyCounters([]),
  )
  const [policySummary, setPolicySummary] = useState<PolicySummary>(EMPTY_POLICY_SUMMARY)
  const [policyErrorCode, setPolicyErrorCode] = useState("")
  const [policyErrorMessage, setPolicyErrorMessage] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [detailProject, setDetailProject] = useState<SupportProject | null>(null)

  const analysisData = useMemo(() => readAnalysisData(), [])

  const analysisFingerprint = useMemo(
    () => getAnalysisFingerprint(analysisData),
    [analysisData],
  )

  const selectedEquipmentContext = useMemo(
    () => getEquipmentContext(analysisData),
    [analysisData],
  )

  const companyId = useMemo(() => {
    return (
      analysisData.company?.company_id ||
      analysisData.equipment?.company_id ||
      getStoredCompanyId()
    )
  }, [analysisData])
  const equipmentId = useMemo(() => {
    return (
      analysisData.equipment?.equipment_id ||
      analysisData.equipment_id ||
      window.localStorage.getItem("factofit_equipment_id") ||
      window.localStorage.getItem("factofit_selected_equipment_id") ||
      ""
    )
  }, [analysisData])

  const requestIdRef = useRef(0)

  // refresh=true(무거운 재계산)는 명시적으로 요청했을 때만 사용한다.
  // 페이지 진입/탭 이동으로 실행되는 effect 쪽 호출은 항상 refresh=false로
  // 고정해, 캐시(analysis_id 스냅샷 또는 matched_policy 캐시)를 우선 쓴다.
  const loadPolicies = useCallback(
    async (options?: { refresh?: boolean }) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      function applyEmptyState(summary: PolicySummary = EMPTY_POLICY_SUMMARY) {
        if (requestId !== requestIdRef.current) return
        setPolicyCards([])
        setPolicyCounters(buildPolicyCounters([]))
        setPolicySummary(summary)
        setSelectedProjectId(null)
        setDetailProject(null)
        setPolicyErrorCode("")
        setPolicyErrorMessage("")
        setPolicyState("empty")
      }

      function applyErrorState(errorCode = "", message = "") {
        if (requestId !== requestIdRef.current) return
        setPolicyCards([])
        setPolicyCounters(buildPolicyCounters([]))
        setPolicySummary(EMPTY_POLICY_SUMMARY)
        setSelectedProjectId(null)
        setDetailProject(null)
        setPolicyErrorCode(errorCode)
        setPolicyErrorMessage(message)
        setPolicyState("error")
      }

      if (!enabled) {
        applyEmptyState()
        return
      }

      if (!companyId) {
        applyEmptyState()
        return
      }

      try {
        setPolicyState("loading")
        setPolicyErrorCode("")
        setPolicyErrorMessage("")

        const [result, summary] = await Promise.all([
          fetchPolicyCards(companyId, equipmentId, analysisFingerprint, analysisId, {
            refresh: Boolean(options?.refresh),
          }),
          fetchPolicySummary(companyId, equipmentId),
        ])

        if (requestId !== requestIdRef.current) return

        if (!result.cards || result.cards.length === 0) {
          applyEmptyState(summary)
          return
        }

        const normalizedCards = normalizeProjectIds(result.cards)
        const rankedCards = rankProjects(normalizedCards)
        const aiRecommendedCount = Math.min(
          rankedCards.length,
          FINAL_RECOMMENDED_LIMIT,
        )

        setPolicyCards(rankedCards)
        setPolicySummary({
          ...summary,
          matchedPolicyCount: summary.matchedPolicyCount ?? rankedCards.length,
          priorityPolicyCount: summary.priorityPolicyCount ?? (rankedCards.length > 0 ? 1 : 0),
        })
        setPolicyCounters(
          buildPolicyCounters(rankedCards, {
            ...result.counters,
            industryMatchedCount:
              result.counters.industryMatchedCount ?? rankedCards.length,
            aiRecommendedCount,
            priorityCount: aiRecommendedCount > 0 ? 1 : 0,
            otherMatchedCount: Math.max(
              rankedCards.length - FINAL_RECOMMENDED_LIMIT,
              0,
            ),
          }),
        )
        setSelectedProjectId(rankedCards[0]?.id ?? null)
        setPolicyState("success")
      } catch (error) {
        console.error("정책 추천 API 호출 실패:", error)

        if (error instanceof PolicyCardsApiError) {
          applyErrorState(error.errorCode, error.message)
        } else {
          applyErrorState("", error instanceof Error ? error.message : "")
        }
      }
    },
    [companyId, equipmentId, analysisFingerprint, analysisId, enabled],
  )

  useEffect(() => {
    void loadPolicies()
  }, [loadPolicies])

  // "다시 계산/새로고침/최신 추천"처럼 사용자가 명시적으로 누르는 액션에서만
  // 호출한다. 페이지 진입/탭 이동 등 일반 흐름에서는 호출하지 않는다.
  const refreshPolicyCards = useCallback(() => loadPolicies({ refresh: true }), [loadPolicies])

  const rankedPolicyCards = useMemo(() => rankProjects(policyCards), [policyCards])

  const finalRecommendedProjects = useMemo(
    () => rankedPolicyCards.slice(0, FINAL_RECOMMENDED_LIMIT),
    [rankedPolicyCards],
  )

  const otherMatchedProjects = useMemo(
    () => rankedPolicyCards.slice(FINAL_RECOMMENDED_LIMIT),
    [rankedPolicyCards],
  )

  const selectedProject = useMemo(() => {
    return (
      finalRecommendedProjects.find((project) => project.id === selectedProjectId) ||
      finalRecommendedProjects[0] ||
      null
    )
  }, [finalRecommendedProjects, selectedProjectId])

  return {
    analysisData,
    selectedEquipmentContext,
    policyState,
    policyCards: rankedPolicyCards,
    finalRecommendedProjects,
    otherMatchedProjects,
    policyCounters,
    policySummary,
    policyErrorCode,
    policyErrorMessage,
    selectedProject,
    selectedProjectId,
    detailProject,
    setSelectedProjectId,
    setDetailProject,
    refreshPolicyCards,
  }
}
