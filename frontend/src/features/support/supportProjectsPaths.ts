import type { EquipmentGroup } from "./supportProjectsEquipmentGroups"

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
  q?: string
  equipmentGroup?: EquipmentGroup
  supportType?: string
  purpose?: string
  date?: string
  filter?: string
  focus?: string
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

  const q = pickParam(params, "q")
  const equipmentGroup = pickParam(params, "equipmentGroup")
  const supportType = pickParam(params, "supportType")
  const purpose = pickParam(params, "purpose")
  const date = pickParam(params, "date")
  const filter = pickParam(params, "filter")
  const focus = pickParam(params, "focus")

  if (q) query.set("q", q)
  if (equipmentGroup && equipmentGroup !== "all") query.set("equipmentGroup", equipmentGroup)
  if (supportType && supportType !== "all") query.set("supportType", supportType)
  if (purpose && purpose !== "all") query.set("purpose", purpose)
  if (date) query.set("date", date)
  if (filter) query.set("filter", filter)
  if (focus) query.set("focus", focus)

  const qs = query.toString()
  return qs ? `/support-projects/${view}?${qs}` : `/support-projects/${view}`
}

export function mergeSupportProjectsSearchParams(
  current: URLSearchParams,
  updates: SupportProjectsPathParams,
): URLSearchParams {
  const next = new URLSearchParams(current)

  const setOrDelete = (key: string, value: string | undefined, omitWhen = ["", "all"]) => {
    const trimmed = value?.trim() ?? ""
    if (!trimmed || omitWhen.includes(trimmed)) {
      next.delete(key)
      return
    }
    next.set(key, trimmed)
  }

  if ("companyId" in updates || "company_id" in updates) {
    setOrDelete("company_id", pickParam(updates, "companyId", "company_id"), [""])
  }
  if ("analysisId" in updates || "analysis_id" in updates) {
    setOrDelete("analysis_id", pickParam(updates, "analysisId", "analysis_id"), [""])
  }
  if ("equipmentId" in updates || "equipment_id" in updates) {
    setOrDelete("equipment_id", pickParam(updates, "equipmentId", "equipment_id"), [""])
  }
  if ("policyId" in updates || "policy_id" in updates) {
    setOrDelete("policy_id", pickParam(updates, "policyId", "policy_id"), [""])
  }
  if ("q" in updates) setOrDelete("q", updates.q, [""])
  if ("equipmentGroup" in updates) setOrDelete("equipmentGroup", updates.equipmentGroup, ["", "all"])
  if ("supportType" in updates) setOrDelete("supportType", updates.supportType, ["", "all"])
  if ("purpose" in updates) setOrDelete("purpose", updates.purpose, ["", "all"])
  if ("date" in updates) setOrDelete("date", updates.date, [""])
  if ("filter" in updates) setOrDelete("filter", updates.filter, [""])
  if ("focus" in updates) setOrDelete("focus", updates.focus, [""])

  return next
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
