export type SideNavKey =
  | "dashboard"
  | "roi"
  | "support"
  | "application"
  | "advisor"
  | "mypage"
  | "equipment"

export type SidebarWorkspacePaths = {
  newRoiPath?: string
  policyPath?: string
  draftPath?: string
  advisorPath?: string
  analysisId?: string | null
  priorityPolicyId?: string | null
}

export function buildMainNavItems(paths: SidebarWorkspacePaths) {
  return [
    { key: "dashboard" as const, label: "종합현황", path: "/dashboard" },
    { key: "roi" as const, label: "ROI투자분석", path: paths.newRoiPath || "/roi" },
    { key: "support" as const, label: "지원사업 일정", path: paths.policyPath || "/support-projects" },
    {
      key: "application" as const,
      label: "신청서 작성",
      path:
        paths.analysisId && paths.priorityPolicyId
          ? paths.draftPath || "/application-draft"
          : "/application-draft",
    },
    { key: "advisor" as const, label: "AI advisor", path: paths.advisorPath || "/advisor" },
  ]
}

export const BOTTOM_NAV_ITEMS = [
  { key: "mypage" as const, label: "마이페이지", path: "/mypage" },
  { key: "equipment" as const, label: "설비현황", path: "/equipment" },
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
    return (
      pathname.startsWith("/support-projects") ||
      pathname.startsWith("/support-detail") ||
      /^\/analysis\/[^/]+\/policies(?:\/.*)?$/.test(pathname)
    )
  }
  if (key === "application") {
    return pathname.startsWith("/application-draft") || /\/application(?:\/|$)/.test(pathname)
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

export function isSidebarBottomActive(key: "mypage" | "equipment", pathname: string): boolean {
  if (key === "mypage") {
    return pathname === "/mypage" || pathname === "/company"
  }
  return pathname === "/equipment"
}
