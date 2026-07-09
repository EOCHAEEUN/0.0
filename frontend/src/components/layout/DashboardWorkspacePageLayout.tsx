import type { ReactNode } from "react"

import { useDashboardData } from "../../features/dashboard/hooks/useDashboardData"
import { buildRoiPath } from "../../features/roi/roiPaths"
import { buildSupportProjectsPath } from "../../features/support/supportProjectsPaths"
import DashboardWorkspaceSidebar from "./DashboardWorkspaceSidebar"
import "../../features/dashboard/dashboard.workspace.css"

type DashboardWorkspacePageLayoutProps = {
  children: ReactNode
  analysisId?: string
  policyId?: string
  pageClassName?: string
  contentClassName?: string
}

export default function DashboardWorkspacePageLayout({
  children,
  analysisId,
  policyId,
  pageClassName = "",
  contentClassName = "",
}: DashboardWorkspacePageLayoutProps) {
  const { dashboard } = useDashboardData({ preferredAnalysisId: analysisId })
  const workspace = dashboard.workspace

  const effectiveAnalysisId = analysisId || workspace.analysisId || undefined
  const supportProjectsPath = buildSupportProjectsPath("priority", { analysisId: effectiveAnalysisId })
  const newRoiPath = effectiveAnalysisId
    ? buildRoiPath("strategy", { analysisId: effectiveAnalysisId })
    : workspace.newRoiPath || "/roi/strategy"

  return (
    <main className={`page ff-dashboard-workspace-page ${pageClassName}`.trim()}>
      <div className="ff-dashboard-layout">
        <DashboardWorkspaceSidebar
          paths={{
            newRoiPath,
            policyPath: workspace.policyPath || supportProjectsPath,
            draftPath: workspace.draftPath || "/application-draft",
            advisorPath: workspace.advisorPath || "/advisor",
            analysisId: analysisId || workspace.analysisId,
            priorityPolicyId: policyId || workspace.priorityPolicyId,
          }}
        />

        <div className={`ff-dashboard-main-content ${contentClassName}`.trim()}>{children}</div>
      </div>
    </main>
  )
}
