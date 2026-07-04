import { useCallback, useMemo, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import DashboardWorkspaceSidebar from "../../components/layout/DashboardWorkspaceSidebar"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { resolveApplicationDraftNavigationPath } from "../roi/roiNavigation"
import { LiveDiscoverySection } from "./components/LiveDiscoverySection"
import { PolicyDetailDrawer } from "./components/PolicyDetailDrawer"
import { PriorityPolicyCard } from "./components/PriorityPolicyCard"
import { PriorityPolicyList } from "./components/PriorityPolicyList"
import { SupportProjectsToolbar } from "./components/SupportProjectsToolbar"
import { SupportTypeGuideSection } from "./components/SupportTypeGuideSection"
import { useSupportProjectsOverview } from "./hooks/useSupportProjectsOverview"
import type { SupportProject } from "./supportProjects.contract"
import {
  computeSupportTypeGuideStats,
  matchesPolicyFilters,
} from "./supportProjectsDisplay.utils"
import {
  getEquipmentGroupLabel,
  isEquipmentGroup,
  resolveEquipmentGroupFromCategory,
  type EquipmentGroup,
} from "./supportProjectsEquipmentGroups"
import { filterPriorityPolicies } from "./supportProjectsFilters"
import {
  type SupportProjectsView,
} from "./supportProjectsPaths"
import type {
  SupportProjectsOverviewViewModel,
  SupportProjectsPolicyCard,
} from "./supportProjectsOverview.types"
import "../dashboard/dashboard.workspace.css"
import "./supportProjects.workspace.css"



function readLocalStorage(key: string) {

  try {

    return window.localStorage.getItem(key)?.trim() ?? ""

  } catch {

    return ""

  }

}



function writeLocalStorage(key: string, value: string) {

  try {

    if (value) window.localStorage.setItem(key, value)

  } catch {

    // ignore

  }

}



function writeJsonLocalStorage(key: string, value: unknown) {

  try {

    window.localStorage.setItem(key, JSON.stringify(value))

  } catch {

    // ignore

  }

}



function removeLocalStorage(key: string) {

  try {

    window.localStorage.removeItem(key)

  } catch {

    // ignore

  }

}



function pickString(...values: unknown[]) {

  for (const value of values) {

    if (value === null || value === undefined) continue

    const text = String(value).trim()

    if (text) return text

  }

  return ""

}



function getProjectPolicyId(project: SupportProject) {

  return pickString(project.rawId, (project as { policy_id?: string }).policy_id)

}

function normalizeDateKey(value: string) {
  const match = value.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (!match) return ""
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function getPolicyDeadlineDate(policy: SupportProjectsPolicyCard) {
  const raw = pickString(policy.deadline, policy.deadline_display)
  return raw ? normalizeDateKey(raw) : ""
}

function isRollingPolicy(policy: SupportProjectsPolicyCard) {
  const raw = pickString(policy.deadline, policy.deadline_display)
  if (getPolicyDeadlineDate(policy)) return false
  return /상시|수시|예산|소진|미정|확인/.test(raw)
}

function matchesCalendarQuery(
  policy: SupportProjectsPolicyCard,
  selectedDate: string,
  rollingOnly: boolean,
) {
  if (selectedDate) return getPolicyDeadlineDate(policy) === selectedDate
  if (rollingOnly) return isRollingPolicy(policy)
  return true
}

function collectSearchablePolicies(
  model: SupportProjectsOverviewViewModel,
  excludePolicyId?: string,
) {
  const seen = new Set<string>()
  const result: SupportProjectsPolicyCard[] = []
  const pool = [
    ...model.priorityPolicies,
    ...model.liveDiscovery.items,
    ...model.allMatched,
    ...(model.priorityPolicy ? [model.priorityPolicy] : []),
  ]

  for (const policy of pool) {
    if (!policy.policy_id || seen.has(policy.policy_id)) continue
    if (excludePolicyId && policy.policy_id === excludePolicyId) continue
    seen.add(policy.policy_id)
    result.push(policy)
  }

  return result
}



export default function SupportProjectsFeature({ view }: { view: SupportProjectsView }) {

  const location = useLocation()

  const navigate = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()

  const [detailPolicy, setDetailPolicy] = useState<SupportProjectsPolicyCard | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [activeSearchQuery, setActiveSearchQuery] = useState("")
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false)
  const shouldFocusSearch = searchParams.get("focus") === "search"
  const selectedDeadlineDate = normalizeDateKey(searchParams.get("date") || "")
  const rollingOnly = searchParams.get("filter") === "rolling"
  const supportType = searchParams.get("supportType") || "all"
  const purpose = searchParams.get("purpose") || "all"

  const urgentListKey = `${view}:${activeSearchQuery}:${selectedDeadlineDate}:${rollingOnly ? "rolling" : "dated"}`
  const [urgentListState, setUrgentListState] = useState({ expanded: false, key: urgentListKey })
  const showAllUrgent = urgentListState.expanded && urgentListState.key === urgentListKey

  const analysisId = useMemo(() => {

    return (

      pickString(searchParams.get("analysis_id"), searchParams.get("analysisId")) || undefined

    )

  }, [searchParams])



  const companyId = useMemo(() => {

    return pickString(

      searchParams.get("company_id"),

      searchParams.get("companyId"),

      readLocalStorage("factofit_company_id"),

      readLocalStorage("company_id"),

    )

  }, [searchParams])



  const equipmentId = useMemo(() => {

    return (

      pickString(

        searchParams.get("equipment_id"),

        searchParams.get("equipmentId"),

        readLocalStorage("factofit_selected_equipment_id"),

        readLocalStorage("factofit_equipment_id"),

      ) || undefined

    )

  }, [searchParams])



  const policyIdFromQuery = useMemo(() => {

    return pickString(searchParams.get("policy_id"), searchParams.get("policyId"))

  }, [searchParams])



  const { dashboard } = useDashboardData({ preferredAnalysisId: analysisId })

  const workspace = dashboard.workspace



  const { state, reload } = useSupportProjectsOverview({

    companyId,

    analysisId,

    equipmentId,

  })

  const syncFiltersToUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete("q")
          for (const [key, value] of Object.entries(updates)) {
            const trimmed = value?.trim() ?? ""
            if (trimmed && trimmed !== "all") {
              next.set(key, trimmed)
            } else {
              next.delete(key)
            }
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const handleSearch = useCallback(() => {
    const trimmed = searchInput.trim()
    setActiveSearchQuery(trimmed)
    setHasSubmittedSearch(true)
  }, [searchInput])

  const handleEquipmentGroupChange = useCallback(
    (value: EquipmentGroup) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete("q")
          next.set("equipmentGroup", value)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const handleSupportTypeChange = useCallback(
    (value: string) => {
      syncFiltersToUrl({ supportType: value })
    },
    [syncFiltersToUrl],
  )

  const handlePurposeChange = useCallback(
    (value: string) => {
      syncFiltersToUrl({ purpose: value })
    },
    [syncFiltersToUrl],
  )



  const buildPolicyDetailPath = useCallback(

    (policy: SupportProjectsPolicyCard) => {

      const next = new URLSearchParams(searchParams)
      if (policy.policy_id) next.set("policy_id", policy.policy_id)
      return `/support-projects/${view}?${next.toString()}`

    },

    [searchParams, view],

  )



  const handleCloseDetail = useCallback(() => {

    setDetailPolicy(null)

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("policy_id")
        next.delete("policyId")
        return next
      },
      { replace: true },
    )

  }, [setSearchParams])



  const handleOpenDetail = useCallback(

    (policy: SupportProjectsPolicyCard) => {

      setDetailPolicy(policy)

      navigate(buildPolicyDetailPath(policy))

    },

    [buildPolicyDetailPath, navigate],

  )



  const handleGoDraft = useCallback(

    async (project: SupportProject) => {

      const resolvedCompanyId = pickString(companyId, readLocalStorage("factofit_company_id"))

      const resolvedEquipmentId = pickString(

        equipmentId,

        readLocalStorage("factofit_selected_equipment_id"),

        readLocalStorage("factofit_equipment_id"),

      )

      const policyId = getProjectPolicyId(project)

      const draftNavigationPath = await resolveApplicationDraftNavigationPath(

        location.pathname,

        location.search,

      )

      const draftUrl = new URL(draftNavigationPath, window.location.origin)

      draftUrl.searchParams.set("policyId", policyId)

      const resolvedAnalysisId = pickString(draftUrl.searchParams.get("analysisId")) || undefined



      if (!resolvedCompanyId || !resolvedEquipmentId || !policyId) {

        window.alert(

          [

            "신청서 초안 생성에 필요한 값이 부족합니다.",

            "",

            `company_id: ${resolvedCompanyId || "없음"}`,

            `equipment_id: ${resolvedEquipmentId || "없음"}`,

            `policy_id: ${policyId || "없음"}`,

            "",

            "마이페이지에서 기업/설비 정보를 저장하고, ROI 분석 후 지원사업을 다시 선택해주세요.",

          ].join("\n"),

        )

        return

      }



      const selectedProjectForDraft = {

        ...project,

        companyId: resolvedCompanyId,

        company_id: resolvedCompanyId,

        equipmentId: resolvedEquipmentId,

        equipment_id: resolvedEquipmentId,

        policyId,

        policy_id: policyId,

      }



      writeLocalStorage("factofit_company_id", resolvedCompanyId)

      writeLocalStorage("factofit_selected_equipment_id", resolvedEquipmentId)

      writeLocalStorage("factofit_equipment_id", resolvedEquipmentId)

      writeLocalStorage("factofit_selected_policy_id", policyId)

      writeLocalStorage("factofit_policy_id", policyId)

      if (resolvedAnalysisId) {

        writeLocalStorage("factofit_analysis_id", resolvedAnalysisId)

      } else {

        removeLocalStorage("factofit_analysis_id")

      }

      writeJsonLocalStorage("factofit_selected_project", selectedProjectForDraft)

      const draftSearchParams = draftUrl.searchParams



      navigate(`/application-draft?${draftSearchParams.toString()}`, {

        state: {

          companyId: resolvedCompanyId,

          equipmentId: resolvedEquipmentId,

          policyId,

          ...(resolvedAnalysisId ? { analysisId: resolvedAnalysisId } : {}),

          selectedProject: {

            ...selectedProjectForDraft,

            ...(resolvedAnalysisId ? { analysisId: resolvedAnalysisId } : {}),

          },

        },

      })

    },

    [companyId, equipmentId, location.pathname, location.search, navigate],

  )



  const model =

    state.kind === "ready" ||

    state.kind === "empty" ||

    state.kind === "legacy_missing"

      ? state.model

      : null

  const defaultEquipmentGroup = useMemo(
    () => resolveEquipmentGroupFromCategory(model?.equipmentCategory),
    [model?.equipmentCategory],
  )

  const equipmentGroupFromUrl = searchParams.get("equipmentGroup")
  const equipmentGroup: EquipmentGroup =
    equipmentGroupFromUrl && isEquipmentGroup(equipmentGroupFromUrl)
      ? equipmentGroupFromUrl
      : defaultEquipmentGroup

  const equipmentGroupLabel =
    equipmentGroup === "all" ? undefined : getEquipmentGroupLabel(equipmentGroup)

  const filterCriteria = useMemo(
    () => ({
      query: activeSearchQuery,
      equipmentGroup,
      supportType,
      purpose,
      defaultEquipmentGroup,
    }),
    [activeSearchQuery, defaultEquipmentGroup, equipmentGroup, purpose, supportType],
  )

  const matchesActiveFilters = useCallback(
    (policy: SupportProjectsPolicyCard) =>
      matchesPolicyFilters(policy, filterCriteria) &&
      matchesCalendarQuery(policy, selectedDeadlineDate, rollingOnly),
    [filterCriteria, rollingOnly, selectedDeadlineDate],
  )

  const toolbarProps = {
    searchInput,
    onSearchInputChange: setSearchInput,
    onSearch: handleSearch,
    isSearching: false,
    equipmentGroup,
    onEquipmentGroupChange: handleEquipmentGroupChange,
    supportType,
    onSupportTypeChange: handleSupportTypeChange,
    purpose,
    onPurposeChange: handlePurposeChange,
    autoFocusSearch: shouldFocusSearch,
  }



  const autoOpenPolicy = useMemo(() => {

    if (detailPolicy) return null

    if (!policyIdFromQuery || !model || state.kind !== "ready") return null

    if (model.priorityPolicy?.policy_id === policyIdFromQuery) return model.priorityPolicy

    const fromList =

      model.priorityPolicies.find((item) => item.policy_id === policyIdFromQuery) ??

      model.liveDiscovery.items.find((item) => item.policy_id === policyIdFromQuery) ??

      model.allMatched.find((item) => item.policy_id === policyIdFromQuery) ??

      null

    return fromList

  }, [detailPolicy, model, policyIdFromQuery, state.kind])



  const activeDetail = detailPolicy ?? autoOpenPolicy



  const filtered = useMemo(() => {

    if (!model) return { visibleMain: null, visibleList: [] as SupportProjectsPolicyCard[] }

    return filterPriorityPolicies(model.priorityPolicy, model.priorityPolicies, "all")

  }, [model])



  const reanalysisPath =

    analysisId && equipmentId

      ? `/analysis/new?mode=reanalysis&equipmentId=${encodeURIComponent(equipmentId)}&parentAnalysisId=${encodeURIComponent(analysisId)}`

      : "/analysis/new"

  const discoveryProjectsPath = useMemo(() => {
    const qs = searchParams.toString()
    return qs ? `/support-projects/discovery?${qs}` : "/support-projects/discovery"
  }, [searchParams])

  const supportProjectsPath = useMemo(() => {
    const next = new URLSearchParams(searchParams)
    next.delete("policy_id")
    next.delete("policyId")
    const qs = next.toString()
    return qs ? `/support-projects/priority?${qs}` : "/support-projects/priority"
  }, [searchParams])

  const isPriorityView = view === "priority"
  const isDiscoveryView = view === "discovery"

  const searchablePolicies = useMemo(() => {
    if (!model) return [] as SupportProjectsPolicyCard[]
    return [...model.priorityPolicies, ...model.liveDiscovery.items, ...model.allMatched]
  }, [model])

  const guideStats = useMemo(
    () => computeSupportTypeGuideStats(searchablePolicies),
    [searchablePolicies],
  )

  const calendarFilteredLiveDiscovery = useMemo(() => {
    if (!model) return null
    return {
      ...model.liveDiscovery,
      items: model.liveDiscovery.items.filter((policy) => matchesActiveFilters(policy)),
    }
  }, [matchesActiveFilters, model])

  const filteredDiscoveryPolicies = useMemo(() => {
    if (!model) return [] as SupportProjectsPolicyCard[]
    const base = model.isAnalysisMode ? filtered.visibleList : model.priorityPolicies
    return base.filter((policy) => matchesActiveFilters(policy))
  }, [filtered.visibleList, matchesActiveFilters, model])

  const roiPriorityPolicy = useMemo(() => {
    if (!model) return null
    return model.isAnalysisMode ? filtered.visibleMain : model.priorityPolicy
  }, [filtered.visibleMain, model])

  const hasActiveSearch = activeSearchQuery.trim().length > 0

  const hasUserChangedEquipmentGroup =
    equipmentGroupFromUrl &&
    isEquipmentGroup(equipmentGroupFromUrl) &&
    equipmentGroupFromUrl !== defaultEquipmentGroup

  const hasActiveToolbarFilters =
    hasSubmittedSearch ||
    hasActiveSearch ||
    supportType !== "all" ||
    purpose !== "all" ||
    Boolean(hasUserChangedEquipmentGroup)

  const filteredSearchPolicies = useMemo(() => {
    if (!model) return [] as SupportProjectsPolicyCard[]
    return collectSearchablePolicies(model).filter((policy) => matchesActiveFilters(policy))
  }, [matchesActiveFilters, model])



  return (

    <main className="page ff-dashboard-workspace-page">

      <PolicyDetailDrawer

        policy={activeDetail}

        onClose={handleCloseDetail}

        onCreateDraft={handleGoDraft}

      />



      <div className="ff-dashboard-layout">

        <DashboardWorkspaceSidebar

          paths={{

            newRoiPath: workspace.newRoiPath,

            policyPath: workspace.policyPath || supportProjectsPath,

            draftPath: workspace.draftPath,

            advisorPath: workspace.advisorPath,

            analysisId: analysisId || workspace.analysisId,

            priorityPolicyId: model?.priorityPolicy?.policy_id || workspace.priorityPolicyId,

          }}

        />



        <div className="ff-dashboard-main-content ff-support-workspace-content">

          {state.kind === "loading" && (

            <div className="ff-support-loading">지원사업 정보를 불러오는 중입니다.</div>

          )}



          {state.kind === "error" && (

            <section className="ff-support-state-card">

              <span className="ff-support-badge blue">오류</span>

              <h2>지원사업 정보를 불러오지 못했습니다</h2>

              <p>{state.message}</p>

              <div className="ff-support-state-actions">

                {state.isAuthError ? (

                  <button

                    type="button"

                    className="ff-support-primary-btn"

                    onClick={() => navigate("/login")}

                  >

                    다시 로그인

                  </button>

                ) : null}

                <button type="button" className="ff-support-secondary-btn" onClick={() => void reload()}>

                  다시 시도

                </button>

              </div>

            </section>

          )}



          {state.kind === "legacy_missing" && model && (

            <>

              {isPriorityView ? (
                <>
                  <SupportProjectsToolbar {...toolbarProps} />

                  <section className="ff-support-state-card">
                    <span className="ff-support-badge purple">정책 이력 없음</span>
                    <h2>분석 당시 정책 이력이 없습니다</h2>
                    <p>
                      최신 정책 DB 결과를 자동으로 붙이지 않습니다. 재분석 또는 최신 정책 탐색을
                      진행해 주세요.
                    </p>
                    <div className="ff-support-state-actions">
                      <button
                        type="button"
                        className="ff-support-primary-btn"
                        onClick={() => navigate(discoveryProjectsPath)}
                      >
                        최신 지원사업 탐색하기
                      </button>
                      <button
                        type="button"
                        className="ff-support-secondary-btn"
                        onClick={() => navigate(reanalysisPath)}
                      >
                        ROI 분석 다시 실행하기
                      </button>
                    </div>
                  </section>

                  <SupportTypeGuideSection
                    stats={guideStats}
                    onViewDiscovery={() => navigate(discoveryProjectsPath)}
                  />
                </>
              ) : null}

              {isDiscoveryView ? (
                <>
                  <SupportProjectsToolbar {...toolbarProps} />
                  <LiveDiscoverySection
                    liveDiscovery={calendarFilteredLiveDiscovery ?? model.liveDiscovery}
                    items={calendarFilteredLiveDiscovery?.items}
                    onOpenDetail={handleOpenDetail}
                    onViewAll={() => navigate(discoveryProjectsPath)}
                    onRetry={() => void reload()}
                  />
                </>
              ) : null}

            </>

          )}



          {state.kind === "empty" && model && (

            <>

              {isPriorityView ? (
                <>
                  <SupportProjectsToolbar {...toolbarProps} />

                  <section className="ff-support-state-card">
                    <h2>표시할 우선 검토 정책이 없습니다</h2>
                    <p>추가 후보 정책을 확인하거나 ROI 분석을 다시 실행해 주세요.</p>
                  </section>

                  <SupportTypeGuideSection
                    stats={guideStats}
                    onViewDiscovery={() => navigate(discoveryProjectsPath)}
                  />
                </>
              ) : null}

              {isDiscoveryView ? (
                <>
                  <SupportProjectsToolbar {...toolbarProps} />
                  <LiveDiscoverySection
                    liveDiscovery={calendarFilteredLiveDiscovery ?? model.liveDiscovery}
                    items={calendarFilteredLiveDiscovery?.items}
                    onOpenDetail={handleOpenDetail}
                    onViewAll={() => navigate(discoveryProjectsPath)}
                    onRetry={() => void reload()}
                  />
                </>
              ) : null}

            </>

          )}



          {state.kind === "ready" && model && (

            <>

              {isPriorityView ? (
                <>
                  <SupportProjectsToolbar {...toolbarProps} />

                  {roiPriorityPolicy ? (
                    <PriorityPolicyCard
                      policy={roiPriorityPolicy}
                      onOpenDetail={handleOpenDetail}
                    />
                  ) : null}

                  <SupportTypeGuideSection
                    stats={guideStats}
                    onViewDiscovery={() => navigate(discoveryProjectsPath)}
                  />

                  {hasActiveToolbarFilters ? (
                    <PriorityPolicyList
                      policies={filteredSearchPolicies}
                      variant="list"
                      onOpenDetail={handleOpenDetail}
                      hasActiveSearch={hasActiveSearch}
                    />
                  ) : null}
                </>
              ) : null}

              {isDiscoveryView ? (
                <>
                  <SupportProjectsToolbar {...toolbarProps} />

                  <PriorityPolicyList
                    policies={filteredDiscoveryPolicies}
                    expanded={showAllUrgent}
                    onViewMore={() =>
                      setUrgentListState({ expanded: true, key: urgentListKey })
                    }
                    onOpenDetail={handleOpenDetail}
                    equipmentGroupLabel={equipmentGroupLabel}
                  />

                  <LiveDiscoverySection
                    liveDiscovery={calendarFilteredLiveDiscovery ?? model.liveDiscovery}
                    items={calendarFilteredLiveDiscovery?.items}
                    onOpenDetail={handleOpenDetail}
                    onViewAll={() => navigate(discoveryProjectsPath)}
                    onRetry={() => void reload()}
                  />

                  
                </>
              ) : null}

            </>

          )}

        </div>

      </div>

    </main>

  )

}


