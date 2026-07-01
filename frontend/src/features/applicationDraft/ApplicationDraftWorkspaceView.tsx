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
import { ApplicationDraftWorkspaceLayout } from "./components/ApplicationDraftWorkspaceLayout"
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

  const layoutProps = {
    analysisId: routeAnalysisId || routeState.analysisId,
    policyId: resolvedPolicyId || routeState.policyId,
  }

  if (workspace.isLoading) {
    return (
      <ApplicationDraftWorkspaceLayout {...layoutProps}>
        <div className="ff-draft-loading">신청서 초안 화면을 불러오는 중...</div>
      </ApplicationDraftWorkspaceLayout>
    )
  }

  if (workspace.isAnalysisRequired) {
    return (
      <ApplicationDraftWorkspaceLayout {...layoutProps}>
        <div className="ff-draft-alert warning">{workspace.analysisRequiredMessage}</div>
      </ApplicationDraftWorkspaceLayout>
    )
  }

  if (workspace.errorMessage) {
    return (
      <ApplicationDraftWorkspaceLayout {...layoutProps}>
        <div className="ff-draft-alert warning">{workspace.errorMessage}</div>
      </ApplicationDraftWorkspaceLayout>
    )
  }

  return (
    <ApplicationDraftWorkspaceLayout {...layoutProps}>
      <div className="ff-draft-page-container">
        <ApplicationDraftHero model={workspace} />

        <ApplicationDraftWorkspace model={workspace} onGoRoi={() => navigate(roiPath)} />

        <ApplicationDraftPdfPreview model={workspace} />
      </div>
    </ApplicationDraftWorkspaceLayout>
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
