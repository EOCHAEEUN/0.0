export type RoiView = "strategy" | "analysis" | "roadmap"

export type RoiPathParams = {
  analysisId?: string
  analysis_id?: string
  companyId?: string
  company_id?: string
  equipmentId?: string
  equipment_id?: string
  source?: string
}

function pickParam(params: RoiPathParams, ...keys: (keyof RoiPathParams)[]) {
  for (const key of keys) {
    const value = params[key]
    if (value) return String(value).trim()
  }
  return ""
}

export function buildRoiPath(view: RoiView = "strategy", params: RoiPathParams = {}): string {
  const query = new URLSearchParams()
  const analysisId = pickParam(params, "analysisId", "analysis_id")
  const companyId = pickParam(params, "companyId", "company_id")
  const equipmentId = pickParam(params, "equipmentId", "equipment_id")
  const source = pickParam(params, "source")

  if (analysisId) query.set("analysisId", analysisId)
  if (companyId) query.set("company_id", companyId)
  if (equipmentId) query.set("equipment_id", equipmentId)
  if (source) query.set("source", source)

  const qs = query.toString()
  return qs ? `/roi/${view}?${qs}` : `/roi/${view}`
}

export function upgradeRoiPath(path: string, view: RoiView = "strategy"): string {
  if (path.includes("/roi/strategy") || path.includes("/roi/analysis") || path.includes("/roi/roadmap")) {
    return path
  }
  if (path === "/roi" || path.startsWith("/roi?")) {
    const queryIndex = path.indexOf("?")
    const qs = queryIndex >= 0 ? path.slice(queryIndex) : ""
    return `/roi/${view}${qs}`
  }
  return path
}

export function getRoiViewFromPathname(pathname: string): RoiView | null {
  if (pathname === "/roi/strategy" || pathname.startsWith("/roi/strategy/")) return "strategy"
  if (pathname === "/roi/analysis" || pathname.startsWith("/roi/analysis/")) return "analysis"
  if (pathname === "/roi/roadmap" || pathname.startsWith("/roi/roadmap/")) return "roadmap"
  if (pathname === "/roi") return "strategy"
  return null
}

export function buildRoiSubNavPath(
  view: RoiView,
  locationSearch: string,
  roiPath?: string,
): string {
  if (locationSearch) {
    return `/roi/${view}${locationSearch.startsWith("?") ? locationSearch : `?${locationSearch}`}`
  }
  if (roiPath?.includes("?")) {
    const baseView = roiPath.match(/\/roi\/(strategy|analysis|roadmap)/)?.[1] as RoiView | undefined
    const qs = roiPath.slice(roiPath.indexOf("?"))
    return `/roi/${baseView ?? view}${qs}`
  }
  return `/roi/${view}`
}
