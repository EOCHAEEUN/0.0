import { useEffect, useMemo, useRef, useState } from "react"
import type {
  PolicyApiItem,
  PolicyCounters,
  PolicyState,
  SupportProject,
} from "../supportProjects.contract"
import { fetchPolicyCards, getStoredCompanyId } from "../supportProjects.api"
import {
  DEMO_POLICY_COUNTERS,
  buildDemoSupportProjects,
  buildPolicyCounters,
  getAnalysisFingerprint,
  getEquipmentContext,
  mapPolicyToProject,
  rankProjects,
  readAnalysisData,
} from "../supportProjects.utils"

const FINAL_RECOMMENDED_LIMIT = 5
const RECOMMENDATION_PREVIEW_LIMIT = 10

type UnknownRecord = Record<string, unknown>

function getRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

function getPolicyArray(source: unknown, keys: string[]): PolicyApiItem[] {
  const record = getRecord(source)

  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value as PolicyApiItem[]
  }

  return []
}

function getNestedSources(analysisData: unknown) {
  const record = getRecord(analysisData)
  const nestedData = getRecord(record.data)

  return [record, nestedData]
}

function getLocalPolicyItems(analysisData: unknown) {
  const sources = getNestedSources(analysisData)

  const finalPolicies = sources
    .flatMap((source) =>
      getPolicyArray(source, [
        "matched_policies",
        "matchedPolicies",
        "matched_policy",
        "recommendations",
        "recommended_policies",
        "policies",
      ]),
    )
    .filter(Boolean)

  const rawCandidates = sources
    .flatMap((source) =>
      getPolicyArray(source, [
        "raw_candidates",
        "rawCandidates",
        "candidate_policies",
        "candidates",
        "other_policies",
      ]),
    )
    .filter(Boolean)

  return {
    finalPolicies,
    rawCandidates,
  }
}

function getProjectUniqueKey(project: SupportProject) {
  return `${project.rawId || ""}::${project.title || ""}`.trim()
}

function mergeUniqueProjects(
  primaryProjects: SupportProject[],
  candidateProjects: SupportProject[],
) {
  const seen = new Set<string>()
  const merged: SupportProject[] = []

  for (const project of [...primaryProjects, ...candidateProjects]) {
    const key = getProjectUniqueKey(project)
    if (!key || seen.has(key)) continue

    seen.add(key)
    merged.push(project)
  }

  return merged
}

function normalizeProjectIds(projects: SupportProject[]) {
  return projects.map((project, index) => ({
    ...project,
    id: index + 1,
    rawId: project.rawId || `policy-${index + 1}`,
  }))
}

function buildLocalPolicyResult(
  analysisData: unknown,
): { cards: SupportProject[]; counters: PolicyCounters } | null {
  const { finalPolicies, rawCandidates } = getLocalPolicyItems(analysisData)

  if (finalPolicies.length === 0 && rawCandidates.length === 0) return null

  const finalCards = rankProjects(
    finalPolicies.map((policy, index) => mapPolicyToProject(policy, index)),
  )
  const rawCandidateCards = rankProjects(
    rawCandidates.map((policy, index) =>
      mapPolicyToProject(policy, finalCards.length + index),
    ),
  )

  const cards = normalizeProjectIds(mergeUniqueProjects(finalCards, rawCandidateCards))
  const aiRecommendedCount = Math.min(finalCards.length || cards.length, FINAL_RECOMMENDED_LIMIT)

  return {
    cards,
    counters: buildPolicyCounters(cards, {
      totalPolicyCount: 291,
      industryMatchedCount: cards.length,
      aiRecommendedCount,
      priorityCount: aiRecommendedCount > 0 ? 1 : 0,
      otherMatchedCount: Math.max(cards.length - FINAL_RECOMMENDED_LIMIT, 0),
    }),
  }
}

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

    function applyDemoFallback() {
      const demoCards = normalizeProjectIds(rankProjects(buildDemoSupportProjects()))
      setPolicyCards(demoCards)
      setPolicyCounters(DEMO_POLICY_COUNTERS)
      setSelectedProjectId(demoCards[0]?.id ?? null)
      setPolicyState("success")
    }

    const localPolicyResult = buildLocalPolicyResult(analysisData)

    if (localPolicyResult && localPolicyResult.cards.length > 0) {
      setPolicyCards(localPolicyResult.cards)
      setPolicyCounters(localPolicyResult.counters)
      setSelectedProjectId(localPolicyResult.cards[0]?.id ?? null)
      setPolicyState("success")
      return
    }

    if (!companyId) {
      applyDemoFallback()
      return
    }

    let ignore = false

    async function loadPolicies() {
      try {
        setPolicyState("loading")

        const result = await fetchPolicyCards(companyId, analysisFingerprint)

        if (ignore) return

        if (result.cards.length === 0) {
          applyDemoFallback()
          return
        }

        const normalizedCards = normalizeProjectIds(result.cards)
        const aiRecommendedCount = Math.min(normalizedCards.length, FINAL_RECOMMENDED_LIMIT)
        setPolicyCards(normalizedCards)
        setPolicyCounters(
          buildPolicyCounters(normalizedCards, {
            ...result.counters,
            industryMatchedCount:
              result.counters.industryMatchedCount || normalizedCards.length,
            aiRecommendedCount,
            priorityCount: aiRecommendedCount > 0 ? 1 : 0,
            otherMatchedCount: Math.max(
              normalizedCards.length - FINAL_RECOMMENDED_LIMIT,
              0,
            ),
          }),
        )
        setSelectedProjectId(normalizedCards[0]?.id ?? null)
        setPolicyState("success")
      } catch (error) {
        console.error("정책 추천 API 호출 실패:", error)

        if (!ignore) {
          applyDemoFallback()
        }
      }
    }

    void loadPolicies()

    return () => {
      ignore = true
    }
  }, [analysisData, analysisFingerprint])

  const rankedPolicyCards = useMemo(() => rankProjects(policyCards), [policyCards])
  const finalRecommendedProjects = useMemo(
    () => rankedPolicyCards.slice(0, RECOMMENDATION_PREVIEW_LIMIT),
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
