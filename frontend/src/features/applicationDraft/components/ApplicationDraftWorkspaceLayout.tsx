import type { ReactNode } from "react"

import DashboardWorkspacePageLayout from "../../../components/layout/DashboardWorkspacePageLayout"

export function ApplicationDraftWorkspaceLayout({
  children,
  analysisId,
  policyId,
}: {
  children: ReactNode
  analysisId?: string
  policyId?: string
}) {
  return (
    <DashboardWorkspacePageLayout
      analysisId={analysisId}
      policyId={policyId}
      pageClassName="ff-draft-workspace-page"
      contentClassName="ff-draft-workspace-content"
    >
      {children}
    </DashboardWorkspacePageLayout>
  )
}
