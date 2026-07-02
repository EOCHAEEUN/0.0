import type { ReactNode } from "react"

import { useDashboardData } from "../../features/dashboard/hooks/useDashboardData"
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

  const supportProjectsPath = analysisId
    ? `/support-projects?analysis_id=${encodeURIComponent(analysisId)}`
    : "/support-projects"

  return (
    <main className={`page ff-dashboard-workspace-page ${pageClassName}`.trim()}>
      <div className="ff-dashboard-layout">
        <DashboardWorkspaceSidebar
          paths={{
            newRoiPath: workspace.newRoiPath,
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
