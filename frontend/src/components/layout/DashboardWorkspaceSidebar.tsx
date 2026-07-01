import {
  Bot,
  CalendarDays,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  Settings2,
  TrendingUp,
  User,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { clearUserOnboardingData } from "../../features/onboarding/onboardingState"
import { clearAuthSession } from "../../services/auth"
import {
  BOTTOM_NAV_ITEMS,
  buildMainNavItems,
  isSidebarBottomActive,
  isSidebarMainActive,
  type SidebarWorkspacePaths,
  type SideNavKey,
} from "./dashboardSidebarNav"

const SIDE_NAV_ICONS = {
  dashboard: LayoutDashboard,
  roi: TrendingUp,
  support: CalendarDays,
  application: FilePenLine,
  advisor: Bot,
  mypage: User,
  equipment: Settings2,
} as const

type DashboardWorkspaceSidebarProps = {
  paths: SidebarWorkspacePaths
  stats: {
    equipmentCount: number
    closingSoonCount?: number
    matchedPolicyCount: string
    recentAnalysisCount: number
  }
}

export default function DashboardWorkspaceSidebar({
  paths,
  stats,
}: DashboardWorkspaceSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const mainNavItems = buildMainNavItems(paths)

  const handleLogout = () => {
    clearUserOnboardingData()
    clearAuthSession()
    navigate("/", { replace: true })
  }

  return (
    <aside className="ff-dashboard-sidebar" aria-label="설비 투자 대시보드 메뉴">
      <div className="ff-sidebar-brand">
        <span className="ff-sidebar-brand-mark" aria-hidden="true">
          F
        </span>
        <strong className="ff-sidebar-brand-name">FactoFit</strong>
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
        <nav className="ff-sidebar-subnav" aria-label="계정 및 설비 메뉴">
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

        <div className="ff-sidebar-stats">
          <div>
            <span>등록설비</span>
            <strong>{stats.equipmentCount}대</strong>
          </div>
          <div>
            <span>마감임박</span>
            <strong>{stats.closingSoonCount ?? 0}건</strong>
          </div>
          <div>
            <span>지원사업 매칭</span>
            <strong>{stats.matchedPolicyCount}건</strong>
          </div>
          <div>
            <span>최근 분석</span>
            <strong>{stats.recentAnalysisCount}건</strong>
          </div>
        </div>

        <button type="button" className="ff-sidebar-logout" onClick={handleLogout}>
          <LogOut aria-hidden="true" size={16} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
