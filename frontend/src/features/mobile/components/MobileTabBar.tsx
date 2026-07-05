import { Bot, Calculator, FileText, Home, Landmark } from "lucide-react"
import { NavLink, useLocation, useSearchParams } from "react-router-dom"
import { buildMobilePath } from "../mobileFlowContext"

const TABS = [
  { path: "/mobile", label: "홈", icon: Home },
  { path: "/mobile/roi", label: "ROI", icon: Calculator },
  { path: "/mobile/policies", label: "지원사업", icon: Landmark },
  { path: "/mobile/application", label: "신청서", icon: FileText },
  { path: "/mobile/ai", label: "AI", icon: Bot },
] as const

export function MobileTabBar() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const context = {
    analysisId: searchParams.get("analysisId") || undefined,
    policyId: searchParams.get("policyId") || undefined,
    equipmentId: searchParams.get("equipmentId") || undefined,
  }

  return (
    <nav className="ff-mobile-tabbar" aria-label="모바일 탭">
      <div className="ff-mobile-tabbar-inner">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive =
            location.pathname === tab.path ||
            (tab.path === "/mobile" && location.pathname === "/mobile/") ||
            (tab.path === "/mobile/application" &&
              (location.pathname === "/mobile/safety" || location.pathname === "/mobile/application"))
          return (
            <NavLink
              key={tab.path}
              to={buildMobilePath(tab.path, context)}
              className={`ff-mobile-tab${isActive ? " is-active" : ""}`}
            >
              <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
