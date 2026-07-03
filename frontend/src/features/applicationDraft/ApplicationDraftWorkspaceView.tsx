import { useMemo } from "react"
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

import { getStoredCompanyId } from "../support/supportProjects.api"
import { ApplicationDraftHero } from "./components/ApplicationDraftHero"
import { ApplicationDraftPdfPreview } from "./components/ApplicationDraftPdfPreview"
import { ApplicationDraftWorkspace } from "./components/ApplicationDraftWorkspace"
import { useApplicationDraftWorkspace } from "./hooks/useApplicationDraftWorkspace"

type RoutePolicyContext = {
  analysisId?: string
  policyId?: string
  selectedProject?: unknown
}

export function ApplicationDraftWorkspaceView({
  routeState,
  isAnalysisPolicyRoute,
  routeAnalysisId,
  resolvedPolicyId,
}: {
  routeState: RoutePolicyContext
  isAnalysisPolicyRoute: boolean
  routeAnalysisId?: string
  resolvedPolicyId?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const companyId = useMemo(() => {
    const state = (location.state || {}) as Record<string, unknown>
    const fromState = String(state.companyId || state.company_id || "").trim()
    return fromState || getStoredCompanyId()
  }, [location.state])

  const workspace = useApplicationDraftWorkspace({
    analysisId: routeAnalysisId || routeState.analysisId,
    policyId: resolvedPolicyId || routeState.policyId,
    companyId,
  })

  const roiPath = routeAnalysisId
    ? `/roi?analysisId=${encodeURIComponent(routeAnalysisId)}`
    : "/roi"

  if (workspace.isLoading) {
    return (
      <main className="page ff-draft-page">
        <section className="section white">
          <div className="container">
            <div className="ff-draft-loading">신청서 초안 화면을 불러오는 중...</div>
          </div>
        </section>
      </main>
    )
  }

  if (workspace.isAnalysisRequired) {
    return (
      <main className="page ff-draft-page">
        <section className="section white">
          <div className="container">
            <div className="ff-draft-alert warning">
              {workspace.analysisRequiredMessage}
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (workspace.errorMessage) {
    return (
      <main className="page ff-draft-page">
        <section className="section white">
          <div className="container">
            <div className="ff-draft-alert warning">{workspace.errorMessage}</div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page ff-draft-page">
      <section className="section white">
        <div className="container ff-draft-page-container">
          <button
            type="button"
            onClick={() =>
              isAnalysisPolicyRoute
                ? navigate(
                    `/analysis/${encodeURIComponent(routeAnalysisId || "")}/policies/${encodeURIComponent(resolvedPolicyId || "")}`,
                  )
                : navigate("/support-projects")
            }
            className="ff-draft-back-button"
          >
            {isAnalysisPolicyRoute
              ? "← 지원사업 상세로 돌아가기"
              : "← 지원사업 목록으로 돌아가기"}
          </button>

          <ApplicationDraftHero model={workspace} />

          <ApplicationDraftWorkspace
            model={workspace}
            onGoRoi={() => navigate(roiPath)}
          />

          <ApplicationDraftPdfPreview model={workspace} />
        </div>
      </section>
    </main>
  )
}

export function useApplicationDraftRouteState() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { id, policyId } = useParams()

  const queryAnalysisId = searchParams.get("analysisId")?.trim() || undefined
  const queryPolicyId = searchParams.get("policyId")?.trim() || undefined
  const routeAnalysisId = (id && id !== "latest" ? id : undefined) || queryAnalysisId
  const resolvedPolicyId = policyId || queryPolicyId

  return {
    location,
    routeAnalysisId,
    resolvedPolicyId,
    isAnalysisPolicyRoute: Boolean(routeAnalysisId && resolvedPolicyId),
  }
}
