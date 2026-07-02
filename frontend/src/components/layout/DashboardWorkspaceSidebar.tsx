import { useEffect, useState } from "react"
import {
  Bot,
  CalendarDays,
  FilePenLine,
  HelpCircle,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  BOTTOM_NAV_ITEMS,
  SUPPORT_SUB_NAV_ITEMS,
  buildMainNavItems,
  buildSupportSubNavPath,
  isSidebarBottomActive,
  isSidebarMainActive,
  isSidebarSupportSubActive,
  type SidebarWorkspacePaths,
} from "./dashboardSidebarNav"

const SIDE_NAV_ICONS = {
  dashboard: LayoutDashboard,
  roi: TrendingUp,
  support: CalendarDays,
  application: FilePenLine,
  advisor: Bot,
  mypage: Settings,
  help: HelpCircle,
} as const

type DashboardWorkspaceSidebarProps = {
  paths: SidebarWorkspacePaths
}

export default function DashboardWorkspaceSidebar({ paths }: DashboardWorkspaceSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const mainNavItems = buildMainNavItems(paths)
  const supportActive = isSidebarMainActive("support", location.pathname)
  const [supportExpanded, setSupportExpanded] = useState(supportActive)

  useEffect(() => {
    if (supportActive) {
      setSupportExpanded(true)
    }
  }, [supportActive])

  return (
    <aside className="ff-dashboard-sidebar" aria-label="FactoFit 워크스페이스 메뉴">
      <div className="ff-sidebar-brand">
        <strong className="ff-sidebar-brand-name">FactoFit</strong>
        <span className="ff-sidebar-brand-tagline">산업 데이터 분석 플랫폼</span>
      </div>

      <nav className="ff-sidebar-nav" aria-label="주요 메뉴">
        {mainNavItems.map((item) => {
          const Icon = SIDE_NAV_ICONS[item.key]
          const isActive = isSidebarMainActive(item.key, location.pathname)

          if (item.key === "support") {
            return (
              <div key={item.key} className="ff-sidebar-nav-group">
                <button
                  type="button"
                  className={isActive ? "is-active" : ""}
                  aria-expanded={supportExpanded}
                  onClick={() => {
                    setSupportExpanded(true)
                    navigate(item.path)
                  }}
                >
                  <Icon aria-hidden="true" size={18} />
                  {item.label}
                </button>

                {supportExpanded ? (
                  <div className="ff-sidebar-subitems" aria-label="지원사업 하위 메뉴">
                    {SUPPORT_SUB_NAV_ITEMS.map((subItem) => {
                      const subActive = isSidebarSupportSubActive(subItem.view, location.pathname)
                      return (
                        <button
                          key={subItem.key}
                          type="button"
                          className={subActive ? "is-active" : ""}
                          onClick={() =>
                            navigate(
                              buildSupportSubNavPath(
                                subItem.view,
                                location.search,
                                paths.policyPath,
                              ),
                            )
                          }
                        >
                          {subItem.label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          }

          return (
            <button
              key={item.key}
              type="button"
              className={isActive ? "is-active" : ""}
              onClick={() => navigate(item.path)}
            >
              <Icon aria-hidden="true" size={18} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="ff-sidebar-footer">
        <nav className="ff-sidebar-subnav" aria-label="설정 및 지원">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = SIDE_NAV_ICONS[item.key]
            const isActive = isSidebarBottomActive(item.key, location.pathname)
            return (
              <button
                key={item.key}
                type="button"
                className={isActive ? "is-active" : ""}
                onClick={() => navigate(item.path)}
              >
                <Icon aria-hidden="true" size={17} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
