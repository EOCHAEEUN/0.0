import { useEffect, useMemo, useState } from "react"
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

export function useSupportProjects(options?: { analysisId?: string }) {
  const analysisId = options?.analysisId
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

  useEffect(() => {
    let ignore = false

    function applyEmptyState(summary: PolicySummary = EMPTY_POLICY_SUMMARY) {
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
      setPolicyCards([])
      setPolicyCounters(buildPolicyCounters([]))
      setPolicySummary(EMPTY_POLICY_SUMMARY)
      setSelectedProjectId(null)
      setDetailProject(null)
      setPolicyErrorCode(errorCode)
      setPolicyErrorMessage(message)
      setPolicyState("error")
    }

    async function loadPolicies() {
      if (!companyId) {
        applyEmptyState()
        return
      }

      try {
        setPolicyState("loading")
        setPolicyErrorCode("")
        setPolicyErrorMessage("")

        const [result, summary] = await Promise.all([
          fetchPolicyCards(companyId, equipmentId, analysisFingerprint, analysisId),
          fetchPolicySummary(companyId, equipmentId),
        ])

        if (ignore) return

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

        if (!ignore) {
          if (error instanceof PolicyCardsApiError) {
            applyErrorState(error.errorCode, error.message)
          } else {
            applyErrorState("", error instanceof Error ? error.message : "")
          }
        }
      }
    }

    void loadPolicies()

    return () => {
      ignore = true
    }
  }, [companyId, equipmentId, analysisFingerprint, analysisId])

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
  }
}
