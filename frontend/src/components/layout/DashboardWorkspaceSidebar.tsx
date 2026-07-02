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
  buildMainNavItems,
  isSidebarBottomActive,
  isSidebarMainActive,
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
