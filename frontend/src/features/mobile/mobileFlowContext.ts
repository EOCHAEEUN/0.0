import type { DashboardWorkspace } from "../dashboard/mappers/dashboardMapper"

export type MobileFlowContext = {
  analysisId?: string
  policyId?: string
  equipmentId?: string
}

function pickText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ""
}

export function resolveMobileFlowContext(
  searchParams: URLSearchParams,
  workspace: DashboardWorkspace,
): MobileFlowContext {
  const queryAnalysisId = pickText(
    searchParams.get("analysisId"),
    searchParams.get("analysis_id"),
  )
  const analysisId = pickText(
    workspace.analysisId || undefined,
    queryAnalysisId,
  )
  const policyId = pickText(
    searchParams.get("policyId"),
    searchParams.get("policy_id"),
    workspace.priorityPolicyId || undefined,
  )
  const shouldIgnoreQueryEquipment =
    Boolean(workspace.analysisId) &&
    Boolean(queryAnalysisId) &&
    workspace.analysisId !== queryAnalysisId
  const equipmentId = shouldIgnoreQueryEquipment
    ? ""
    : pickText(searchParams.get("equipmentId"), searchParams.get("equipment_id"))

  return {
    analysisId: analysisId || undefined,
    policyId: policyId || undefined,
    equipmentId: equipmentId || undefined,
  }
}

export function buildMobilePath(
  pathname: string,
  context: MobileFlowContext,
  extraQuery?: Record<string, string | undefined>,
) {
  const query = new URLSearchParams()
  if (context.analysisId) query.set("analysisId", context.analysisId)
  if (context.policyId) query.set("policyId", context.policyId)
  if (context.equipmentId) query.set("equipmentId", context.equipmentId)
  if (extraQuery) {
    Object.entries(extraQuery).forEach(([key, value]) => {
      if (!value) return
      query.set(key, value)
    })
  }
  const queryText = query.toString()
  return queryText ? `${pathname}?${queryText}` : pathname
}

export function buildWebSupportProjectsPath(context: MobileFlowContext) {
  const query = new URLSearchParams()
  if (context.analysisId) query.set("analysis_id", context.analysisId)
  if (context.policyId) query.set("policy_id", context.policyId)
  if (context.equipmentId) query.set("equipment_id", context.equipmentId)
  const queryText = query.toString()
  return queryText ? `/support-projects/priority?${queryText}` : "/support-projects/priority"
}
