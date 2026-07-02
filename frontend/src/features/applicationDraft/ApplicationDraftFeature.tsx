import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { ApplicationDraftDashboard } from "./components/ApplicationDraftDashboard"
import { ApplicationDraftWorkspaceLayout } from "./components/ApplicationDraftWorkspaceLayout"
import {
  ApplicationDraftWorkspaceView,
  useApplicationDraftRouteState,
} from "./ApplicationDraftWorkspaceView"
import { computeDraftNavigationParams } from "./applicationDraftDashboard.utils"
import { ErrorPolicyState } from "../support/components/SupportProjectStates"
import { useSupportProjects } from "../support/hooks/useSupportProjects"
import type { SupportProject } from "../support/supportProjects.contract"

function findProjectByRouteId(projects: SupportProject[], policyId?: string) {
  const decodedId = decodeURIComponent(policyId || "")
  return projects.find((project) => String(project.rawId || project.id) === decodedId) || null
}

export function ApplicationDraftFeature() {
  const navigate = useNavigate()
  const { location, routeAnalysisId, resolvedPolicyId, isAnalysisPolicyRoute } =
    useApplicationDraftRouteState()

  const support = useSupportProjects({ analysisId: routeAnalysisId })
  const routeProject = useMemo(
    () => findProjectByRouteId(support.policyCards, resolvedPolicyId),
    [resolvedPolicyId, support.policyCards],
  )

  const routeState = useMemo(
    () => ({
      analysisId: routeAnalysisId,
      policyId: resolvedPolicyId,
      selectedProject: routeProject,
    }),
    [resolvedPolicyId, routeAnalysisId, routeProject],
  )

  const draftNavigationParams = useMemo(
    () => computeDraftNavigationParams(location.state, routeState),
    [location.state, routeState],
  )

  const analysisPoliciesPath = routeAnalysisId
    ? `/support-projects/priority?analysis_id=${encodeURIComponent(routeAnalysisId)}`
    : "/support-projects/priority"

  if (isAnalysisPolicyRoute && support.policyState === "loading") {
    return (
      <ApplicationDraftWorkspaceLayout analysisId={routeAnalysisId} policyId={resolvedPolicyId}>
        <div className="ff-draft-loading">지원사업 정보를 불러오는 중...</div>
      </ApplicationDraftWorkspaceLayout>
    )
  }

  if (isAnalysisPolicyRoute && support.policyState === "error") {
    return (
      <ApplicationDraftWorkspaceLayout analysisId={routeAnalysisId} policyId={resolvedPolicyId}>
        <ErrorPolicyState onBackToRoi={() => navigate(analysisPoliciesPath)} />
      </ApplicationDraftWorkspaceLayout>
    )
  }

  if (isAnalysisPolicyRoute && support.policyState === "success" && !routeProject) {
    return (
      <ApplicationDraftWorkspaceLayout analysisId={routeAnalysisId} policyId={resolvedPolicyId}>
        <button
          type="button"
          onClick={() => navigate(analysisPoliciesPath)}
          className="ff-draft-back-button"
        >
          ← 맞춤 지원사업 목록
        </button>
        <div className="ff-draft-not-found">
          <div className="screen-tag">FACTOFIT APPLICATION DRAFT</div>
          <div className="label">POLICY NOT FOUND</div>
          <h2>선택한 지원사업 정보를 찾지 못했습니다.</h2>
          <p>
            이 분석 이력의 정책 스냅샷에 없는 지원사업입니다. 목록에서 다시 선택해주세요.
          </p>
        </div>
      </ApplicationDraftWorkspaceLayout>
    )
  }

  if (!draftNavigationParams) {
    return <ApplicationDraftDashboard navigate={navigate} />
  }

  return (
    <ApplicationDraftWorkspaceView
      routeState={routeState}
      isAnalysisPolicyRoute={isAnalysisPolicyRoute}
      routeAnalysisId={routeAnalysisId}
      resolvedPolicyId={resolvedPolicyId}
    />
  )
}
