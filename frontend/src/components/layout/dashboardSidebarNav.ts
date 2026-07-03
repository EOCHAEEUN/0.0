export type SideNavKey =
  | "dashboard"
  | "roi"
  | "support"
  | "application"
  | "advisor"
  | "mypage"
  | "equipment"
  | "logout"

export type SidebarWorkspacePaths = {
  newRoiPath?: string
  policyPath?: string
  draftPath?: string
  advisorPath?: string
  analysisId?: string | null
  priorityPolicyId?: string | null
}

export const ROI_SUB_NAV_ITEMS = [
  { key: "strategy" as const, label: "투자 전략 개요", view: "strategy" as const },
  { key: "analysis" as const, label: "상세 시나리오 분석", view: "analysis" as const },
  { key: "roadmap" as const, label: "AI 추천 로드맵", view: "roadmap" as const },
] as const

export function buildRoiSubNavPath(
  view: "strategy" | "analysis" | "roadmap",
  locationSearch: string,
  roiPath?: string,
): string {
  if (locationSearch) {
    return `/roi/${view}${locationSearch.startsWith("?") ? locationSearch : `?${locationSearch}`}`
  }

  if (roiPath?.includes("?")) {
    return `/roi/${view}${roiPath.slice(roiPath.indexOf("?"))}`
  }

  return `/roi/${view}`
}

export function getRoiViewFromPathname(pathname: string): "strategy" | "analysis" | "roadmap" | null {
  if (pathname === "/roi/strategy" || pathname.startsWith("/roi/strategy/")) return "strategy"
  if (pathname === "/roi/analysis" || pathname.startsWith("/roi/analysis/")) {
    return "analysis"
  }
  if (pathname === "/roi/roadmap" || pathname.startsWith("/roi/roadmap/")) return "roadmap"
  if (pathname === "/roi") return "strategy"
  return null
}

export function isSidebarRoiSubActive(
  view: "strategy" | "analysis" | "roadmap",
  pathname: string,
): boolean {
  return getRoiViewFromPathname(pathname) === view
}

export const SUPPORT_SUB_NAV_ITEMS = [
  { key: "priority" as const, label: "최우선 지원사업 분석", view: "priority" as const },
  { key: "discovery" as const, label: "추가 맞춤 지원사업", view: "discovery" as const },
] as const

export function buildSupportSubNavPath(
  view: "priority" | "discovery",
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

export function getSupportViewFromPathname(pathname: string): "priority" | "discovery" | null {
  if (pathname === "/support-projects/priority" || pathname.startsWith("/support-projects/priority/")) {
    return "priority"
  }
  if (pathname === "/support-projects/discovery" || pathname.startsWith("/support-projects/discovery/")) {
    return "discovery"
  }
  if (pathname === "/support-projects") return "priority"
  return null
}

export function isSidebarSupportSubActive(
  view: "priority" | "discovery",
  pathname: string,
): boolean {
  return getSupportViewFromPathname(pathname) === view
}

export function buildMainNavItems(paths: SidebarWorkspacePaths) {
  return [
    { key: "dashboard" as const, label: "종합현황", path: "/dashboard" },
    { key: "roi" as const, label: "ROI 분석", path: paths.newRoiPath || "/roi/strategy" },
    { key: "support" as const, label: "지원사업 일정", path: paths.policyPath || "/support-projects/priority" },
    {
      key: "application" as const,
      label: "신청서 작성",
      path:
        paths.analysisId && paths.priorityPolicyId
          ? paths.draftPath || "/application-draft"
          : "/application-draft",
    },
    { key: "advisor" as const, label: "AI 어드바이저", path: paths.advisorPath || "/advisor" },
  ]
}

export const SETTINGS_SUB_NAV_ITEMS = [
  { key: "mypage" as const, label: "마이페이지", view: "mypage" as const, path: "/mypage" },
  { key: "equipment" as const, label: "내설비관리", view: "equipment" as const, path: "/equipment" },
] as const

export function getSettingsViewFromPathname(pathname: string): "mypage" | "equipment" | null {
  if (pathname === "/equipment" || pathname.startsWith("/equipment/")) return "equipment"
  if (pathname === "/mypage" || pathname === "/company" || pathname.startsWith("/mypage/")) {
    return "mypage"
  }
  return null
}

export function isSidebarSettingsSubActive(
  view: "mypage" | "equipment",
  pathname: string,
): boolean {
  return getSettingsViewFromPathname(pathname) === view
}

export const BOTTOM_NAV_ITEMS = [
  { key: "mypage" as const, label: "설정", path: "/mypage" },
  { key: "logout" as const, label: "로그아웃" },
] as const

export function isSidebarMainActive(key: SideNavKey, pathname: string): boolean {
  if (key === "dashboard") return pathname === "/dashboard"
  if (key === "roi") {
    return (
      pathname === "/roi" ||
      pathname.startsWith("/roi/") ||
      pathname === "/analysis/new" ||
      pathname.startsWith("/analysis/new/") ||
      pathname === "/analysis/review" ||
      pathname.startsWith("/analysis/review/") ||
      /^\/analysis\/[^/]+(?:\/result)?$/.test(pathname)
    )
  }
  if (key === "support") {
    if (/\/analysis\/[^/]+\/policies\/[^/]+\/application$/.test(pathname)) {
      return false
    }
    return (
      pathname.startsWith("/support-projects") ||
      pathname.startsWith("/support-detail") ||
      /^\/analysis\/[^/]+\/policies(?:\/.*)?$/.test(pathname)
    )
  }
  if (key === "application") {
    return (
      pathname.startsWith("/application-draft") ||
      /\/analysis\/[^/]+\/policies\/[^/]+\/application$/.test(pathname) ||
      /\/application(?:\/|$)/.test(pathname)
    )
  }
  if (key === "advisor") {
    return (
      pathname === "/advisor" ||
      pathname.startsWith("/advisor/") ||
      pathname === "/ai" ||
      pathname === "/ai-advisor"
    )
  }
  if (key === "equipment") return pathname === "/equipment"
  if (key === "mypage") {
    return (
      pathname === "/mypage" ||
      pathname === "/company" ||
      pathname.startsWith("/mypage/") ||
      pathname === "/equipment" ||
      pathname.startsWith("/equipment/")
    )
  }
  return false
}

export function isSidebarBottomActive(key: "mypage" | "logout", pathname: string): boolean {
  if (key === "mypage") {
    return (
      pathname === "/mypage" ||
      pathname === "/company" ||
      pathname.startsWith("/mypage/") ||
      pathname === "/equipment" ||
      pathname.startsWith("/equipment/")
    )
  }
  return false
}
