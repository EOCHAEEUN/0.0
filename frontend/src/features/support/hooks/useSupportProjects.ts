import { useEffect, useMemo, useRef, useState } from "react"
import type { PolicyCounters, PolicyState, SupportProject } from "../supportProjects.contract"
import { fetchPolicyCards, getStoredCompanyId } from "../supportProjects.api"
import {
  DEMO_POLICY_COUNTERS,
  buildDemoSupportProjects,
  buildPolicyCounters,
  getAnalysisFingerprint,
  getEquipmentContext,
  rankProjects,
  readAnalysisData,
} from "../supportProjects.utils"

export function useSupportProjects() {
  const hasStartedFetchRef = useRef(false)

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

  useEffect(() => {
    if (hasStartedFetchRef.current) return
    hasStartedFetchRef.current = true

    const companyId =
      analysisData.company?.company_id ||
      analysisData.equipment?.company_id ||
      getStoredCompanyId()

    const localMatchedPolicies = Array.isArray(analysisData.matched_policies)
      ? analysisData.matched_policies
      : []

    function applyDemoFallback() {
      const demoCards = rankProjects(buildDemoSupportProjects())
      setPolicyCards(demoCards)
      setPolicyCounters(DEMO_POLICY_COUNTERS)
      setSelectedProjectId(demoCards[0]?.id ?? null)
      setPolicyState("success")
    }

    if (!companyId && localMatchedPolicies.length === 0) {
      applyDemoFallback()
      return
    }

    let ignore = false

    async function loadPolicies() {
      try {
        setPolicyState("loading")

        const result = companyId
          ? await fetchPolicyCards(companyId, analysisFingerprint)
          : { cards: [], counters: buildPolicyCounters([]) }

        if (ignore) return

        if (result.cards.length === 0) {
          applyDemoFallback()
          return
        }

        setPolicyCards(result.cards)
        setPolicyCounters(result.counters)
        setSelectedProjectId(result.cards[0]?.id ?? null)
        setPolicyState("success")
      } catch (error) {
        console.error("정책 추천 API 호출 실패:", error)

        if (!ignore) {
          applyDemoFallback()
        }
      }
    }

    loadPolicies()

    return () => {
      ignore = true
    }
  }, [analysisData, analysisFingerprint])

  const rankedPolicyCards = useMemo(() => rankProjects(policyCards), [policyCards])
  const finalRecommendedProjects = useMemo(
    () => rankedPolicyCards.slice(0, 10),
    [rankedPolicyCards],
  )
  const otherMatchedProjects = useMemo(
    () => rankedPolicyCards.slice(10),
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
