export type SupportProjectsView = "priority" | "discovery"

export type SupportProjectsPathParams = {
  analysisId?: string
  analysis_id?: string
  companyId?: string
  company_id?: string
  equipmentId?: string
  equipment_id?: string
  policyId?: string
  policy_id?: string
}

function pickParam(params: SupportProjectsPathParams, ...keys: (keyof SupportProjectsPathParams)[]) {
  for (const key of keys) {
    const value = params[key]
    if (value) return String(value).trim()
  }
  return ""
}

export function buildSupportProjectsPath(
  view: SupportProjectsView = "priority",
  params: SupportProjectsPathParams = {},
): string {
  const query = new URLSearchParams()
  const companyId = pickParam(params, "companyId", "company_id")
  const analysisId = pickParam(params, "analysisId", "analysis_id")
  const equipmentId = pickParam(params, "equipmentId", "equipment_id")
  const policyId = pickParam(params, "policyId", "policy_id")

  if (companyId) query.set("company_id", companyId)
  if (analysisId) query.set("analysis_id", analysisId)
  if (equipmentId) query.set("equipment_id", equipmentId)
  if (policyId) query.set("policy_id", policyId)

  const qs = query.toString()
  return qs ? `/support-projects/${view}?${qs}` : `/support-projects/${view}`
}

export function upgradeSupportProjectsPath(
  path: string,
  view: SupportProjectsView = "priority",
): string {
  if (path.includes("/support-projects/priority") || path.includes("/support-projects/discovery")) {
    return path
  }

  const queryIndex = path.indexOf("?")
  const qs = queryIndex >= 0 ? path.slice(queryIndex) : ""
  return `/support-projects/${view}${qs}`
}

export function getSupportViewFromPathname(pathname: string): SupportProjectsView | null {
  if (pathname === "/support-projects/priority" || pathname.startsWith("/support-projects/priority/")) {
    return "priority"
  }
  if (pathname === "/support-projects/discovery" || pathname.startsWith("/support-projects/discovery/")) {
    return "discovery"
  }
  if (pathname === "/support-projects") return "priority"
  return null
}

export function buildSupportSubNavPath(
  view: SupportProjectsView,
  locationSearch: string,
  policyPath?: string,
): string {
  if (locationSearch) {
    return `/support-projects/${view}${locationSearch.startsWith("?") ? locationSearch : `?${locationSearch}`}`
  }

  if (policyPath?.includes("?")) {
    return `/support-projects/${view}${policyPath.slice(policyPath.indexOf("?"))}`
  }

  return `/support-projects/${view}`
}
