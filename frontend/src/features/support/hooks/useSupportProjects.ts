import { useEffect, useMemo, useState } from "react"
import type {
  PolicyCounters,
  PolicyState,
  SupportProject,
} from "../supportProjects.contract"
import { fetchPolicyCards, getStoredCompanyId } from "../supportProjects.api"
import {
  buildPolicyCounters,
  getAnalysisFingerprint,
  getEquipmentContext,
  rankProjects,
  readAnalysisData,
} from "../supportProjects.utils"

const FINAL_RECOMMENDED_LIMIT = 5

function normalizeProjectIds(projects: SupportProject[]) {
  return projects.map((project, index) => ({
    ...project,
    id: index + 1,
    rawId: project.rawId || `policy-${index + 1}`,
  }))
}

export function useSupportProjects() {
  const [policyState, setPolicyState] = useState<PolicyState>("loading")
  const [policyCards, setPolicyCards] = useState<SupportProject[]>([])
  const [policyCounters, setPolicyCounters] = useState<PolicyCounters>(() =>
    buildPolicyCounters([]),
  )
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

  useEffect(() => {
    let ignore = false

    function applyEmptyState() {
      setPolicyCards([])
      setPolicyCounters(buildPolicyCounters([]))
      setSelectedProjectId(null)
      setDetailProject(null)
      setPolicyState("empty")
    }

    function applyErrorState() {
      setPolicyCards([])
      setPolicyCounters(buildPolicyCounters([]))
      setSelectedProjectId(null)
      setDetailProject(null)
      setPolicyState("error")
    }

    async function loadPolicies() {
      if (!companyId) {
        applyEmptyState()
        return
      }

      try {
        setPolicyState("loading")

        const result = await fetchPolicyCards(companyId, analysisFingerprint)

        if (ignore) return

        if (!result.cards || result.cards.length === 0) {
          applyEmptyState()
          return
        }

        const normalizedCards = normalizeProjectIds(result.cards)
        const rankedCards = rankProjects(normalizedCards)
        const aiRecommendedCount = Math.min(
          rankedCards.length,
          FINAL_RECOMMENDED_LIMIT,
        )

        setPolicyCards(rankedCards)
        setPolicyCounters(
          buildPolicyCounters(rankedCards, {
            ...result.counters,
            industryMatchedCount:
              result.counters.industryMatchedCount || rankedCards.length,
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
          applyErrorState()
        }
      }
    }

    void loadPolicies()

    return () => {
      ignore = true
    }
  }, [companyId, analysisFingerprint])

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
    selectedProject,
    selectedProjectId,
    detailProject,
    setSelectedProjectId,
    setDetailProject,
  }
}
