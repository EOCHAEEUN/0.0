export type SideNavKey =
  | "dashboard"
  | "roi"
  | "support"
  | "application"
  | "advisor"
  | "mypage"
  | "equipment"
  | "help"

export type SidebarWorkspacePaths = {
  newRoiPath?: string
  policyPath?: string
  draftPath?: string
  advisorPath?: string
  analysisId?: string | null
  priorityPolicyId?: string | null
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
    { key: "roi" as const, label: "ROI 분석", path: paths.newRoiPath || "/roi" },
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

export const BOTTOM_NAV_ITEMS = [
  { key: "mypage" as const, label: "설정", path: "/mypage" },
  { key: "help" as const, label: "고객지원", path: "/" },
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
    return pathname === "/mypage" || pathname === "/company"
  }
  return false
}

export function isSidebarBottomActive(key: "mypage" | "help", pathname: string): boolean {
  if (key === "mypage") {
    return pathname === "/mypage" || pathname === "/company"
  }
  return pathname === "/"
}
