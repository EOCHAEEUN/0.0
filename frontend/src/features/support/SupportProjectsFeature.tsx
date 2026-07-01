import { useCallback, useMemo, useState } from "react"

import { useLocation, useNavigate, useSearchParams } from "react-router-dom"



import DashboardWorkspaceSidebar from "../../components/layout/DashboardWorkspaceSidebar"

import { useDashboardData } from "../dashboard/hooks/useDashboardData"

import { resolveApplicationDraftNavigationPath } from "../roi/roiNavigation"

import { LiveDiscoverySection } from "./components/LiveDiscoverySection"

import { PolicyDetailDrawer } from "./components/PolicyDetailDrawer"

import { PriorityPolicyCard } from "./components/PriorityPolicyCard"

import { PriorityPolicyList } from "./components/PriorityPolicyList"

import { SupportProjectsHero } from "./components/SupportProjectsHero"

import { SupportTypeGuideSection } from "./components/SupportTypeGuideSection"

import { useSupportProjectsOverview } from "./hooks/useSupportProjectsOverview"

import type { SupportProject } from "./supportProjects.contract"

import { filterPriorityPolicies } from "./supportProjectsFilters"

import type {

  SupportProjectsFilter,

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



export default function SupportProjectsFeature() {

  const location = useLocation()

  const navigate = useNavigate()

  const [searchParams] = useSearchParams()

  const [detailPolicy, setDetailPolicy] = useState<SupportProjectsPolicyCard | null>(null)

  const [activeFilter, setActiveFilter] = useState<SupportProjectsFilter>("all")



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



  const buildPolicyDetailPath = useCallback(

    (policy: SupportProjectsPolicyCard) => {

      const query = new URLSearchParams()

      if (companyId) query.set("company_id", companyId)

      if (analysisId) query.set("analysis_id", analysisId)

      if (equipmentId) query.set("equipment_id", equipmentId)

      if (policy.policy_id) query.set("policy_id", policy.policy_id)

      return `/support-projects?${query.toString()}`

    },

    [analysisId, companyId, equipmentId],

  )



  const handleCloseDetail = useCallback(() => {

    setDetailPolicy(null)

    const next = new URLSearchParams(searchParams)

    const hadPolicyInQuery = next.has("policy_id") || next.has("policyId")

    next.delete("policy_id")

    next.delete("policyId")

    if (hadPolicyInQuery) {

      const qs = next.toString()

      navigate(qs ? `/support-projects?${qs}` : "/support-projects", { replace: true })

    }

  }, [navigate, searchParams])



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

    return filterPriorityPolicies(model.priorityPolicy, model.priorityPolicies, activeFilter)

  }, [activeFilter, model])



  const reanalysisPath =

    analysisId && equipmentId

      ? `/analysis/new?mode=reanalysis&equipmentId=${encodeURIComponent(equipmentId)}&parentAnalysisId=${encodeURIComponent(analysisId)}`

      : "/analysis/new"



  const supportProjectsPath = analysisId

    ? `/support-projects?analysis_id=${encodeURIComponent(analysisId)}`

    : companyId

      ? `/support-projects?company_id=${encodeURIComponent(companyId)}`

      : "/support-projects"



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

          stats={{

            equipmentCount: workspace.equipmentCount,

            closingSoonCount: workspace.closingSoonCount,

            matchedPolicyCount: workspace.policySummary.matchedPolicyCount,

            recentAnalysisCount: workspace.recentAnalysisCount,

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

              <SupportProjectsHero

                trustLabel={model.heroTrustLabel}

                heroTitle="분석 당시 정책 이력이 없습니다"

                heroSubtitle="이 분석 결과에는 당시 매칭된 정책 스냅샷이 저장되어 있지 않습니다. 최신 정책을 과거 분석 결과처럼 보여주지 않습니다."

                counts={model.counts}

                activeFilter={activeFilter}

                onFilterChange={setActiveFilter}

                showFilters={false}

              />

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

                    onClick={() =>

                      navigate(

                        companyId

                          ? `/support-projects?company_id=${encodeURIComponent(companyId)}`

                          : "/support-projects",

                      )

                    }

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

              <LiveDiscoverySection

                liveDiscovery={model.liveDiscovery}

                onOpenDetail={handleOpenDetail}

                onViewAll={() =>

                  navigate(

                    companyId

                      ? `/support-projects?company_id=${encodeURIComponent(companyId)}`

                      : "/support-projects",

                  )

                }

              />

              <SupportTypeGuideSection />

            </>

          )}



          {state.kind === "empty" && model && (

            <>

              <SupportProjectsHero

                trustLabel={model.heroTrustLabel}

                heroTitle={model.heroTitle}

                heroSubtitle={model.heroSubtitle}

                counts={model.counts}

                activeFilter={activeFilter}

                onFilterChange={setActiveFilter}

                showFilters={model.isAnalysisMode}

              />

              <section className="ff-support-state-card">

                <h2>표시할 우선 검토 정책이 없습니다</h2>

                <p>추가 후보 정책을 확인하거나 ROI 분석을 다시 실행해 주세요.</p>

              </section>

              <LiveDiscoverySection

                liveDiscovery={model.liveDiscovery}

                onOpenDetail={handleOpenDetail}

                onViewAll={() =>

                  navigate(

                    companyId

                      ? `/support-projects?company_id=${encodeURIComponent(companyId)}`

                      : "/support-projects",

                  )

                }

              />

              <SupportTypeGuideSection />

            </>

          )}



          {state.kind === "ready" && model && (

            <>

              <SupportProjectsHero

                trustLabel={model.heroTrustLabel}

                heroTitle={model.heroTitle}

                heroSubtitle={model.heroSubtitle}

                counts={model.counts}

                activeFilter={activeFilter}

                onFilterChange={setActiveFilter}

                showFilters={model.isAnalysisMode}

              />



              {model.isAnalysisMode && filtered.visibleMain ? (

                <PriorityPolicyCard policy={filtered.visibleMain} onOpenDetail={handleOpenDetail} />

              ) : null}



              {model.isAnalysisMode ? (

                <PriorityPolicyList

                  policies={filtered.visibleList}

                  onOpenDetail={handleOpenDetail}

                />

              ) : null}



              {!model.isAnalysisMode && model.priorityPolicy ? (

                <PriorityPolicyCard policy={model.priorityPolicy} onOpenDetail={handleOpenDetail} />

              ) : null}



              {!model.isAnalysisMode && model.priorityPolicies.length > 0 ? (

                <PriorityPolicyList

                  policies={model.priorityPolicies}

                  onOpenDetail={handleOpenDetail}

                />

              ) : null}



              <LiveDiscoverySection

                liveDiscovery={model.liveDiscovery}

                onOpenDetail={handleOpenDetail}

                onViewAll={() =>

                  navigate(

                    companyId

                      ? `/support-projects?company_id=${encodeURIComponent(companyId)}`

                      : "/support-projects",

                  )

                }

              />



              <SupportTypeGuideSection />

            </>

          )}

        </div>

      </div>

    </main>

  )

}


