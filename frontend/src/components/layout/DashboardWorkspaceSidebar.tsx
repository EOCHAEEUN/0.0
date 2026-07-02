import { useEffect, useState } from "react"
import {
  Bot,
  CalendarDays,
  FilePenLine,
  LayoutDashboard,
  LogOut,
  Settings,
  TrendingUp,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { clearUserOnboardingData } from "../../features/onboarding/onboardingState"
import { clearAuthSession } from "../../services/auth"
import {
  BOTTOM_NAV_ITEMS,
  ROI_SUB_NAV_ITEMS,
  SETTINGS_SUB_NAV_ITEMS,
  SUPPORT_SUB_NAV_ITEMS,
  buildMainNavItems,
  buildRoiSubNavPath,
  buildSupportSubNavPath,
  isSidebarBottomActive,
  isSidebarMainActive,
  isSidebarRoiSubActive,
  isSidebarSettingsSubActive,
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
  logout: LogOut,
} as const

type DashboardWorkspaceSidebarProps = {
  paths: SidebarWorkspacePaths
}

export default function DashboardWorkspaceSidebar({ paths }: DashboardWorkspaceSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const mainNavItems = buildMainNavItems(paths)
  const roiActive = isSidebarMainActive("roi", location.pathname)
  const supportActive = isSidebarMainActive("support", location.pathname)
  const [roiExpanded, setRoiExpanded] = useState(roiActive)
  const [supportExpanded, setSupportExpanded] = useState(supportActive)
  const settingsActive = isSidebarBottomActive("mypage", location.pathname)
  const [settingsExpanded, setSettingsExpanded] = useState(settingsActive)

  const handleLogout = () => {
    clearUserOnboardingData()
    clearAuthSession()
    navigate("/", { replace: true })
  }

  useEffect(() => {
    if (settingsActive) {
      setSettingsExpanded(true)
    }
  }, [settingsActive])

  useEffect(() => {
    if (roiActive) {
      setRoiExpanded(true)
    }
  }, [roiActive])

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

          if (item.key === "roi") {
            return (
              <div key={item.key} className="ff-sidebar-nav-group">
                <button
                  type="button"
                  className={isActive ? "is-active" : ""}
                  aria-expanded={roiExpanded}
                  onClick={() => {
                    setRoiExpanded(true)
                    navigate(item.path)
                  }}
                >
                  <Icon aria-hidden="true" size={18} />
                  {item.label}
                </button>

                {roiExpanded ? (
                  <div className="ff-sidebar-subitems" aria-label="ROI 분석 하위 메뉴">
                    {ROI_SUB_NAV_ITEMS.map((subItem) => {
                      const subActive = isSidebarRoiSubActive(subItem.view, location.pathname)
                      return (
                        <button
                          key={subItem.key}
                          type="button"
                          className={subActive ? "is-active" : ""}
                          onClick={() =>
                            navigate(
                              buildRoiSubNavPath(
                                subItem.view,
                                location.search,
                                paths.newRoiPath,
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
        <nav className="ff-sidebar-subnav" aria-label="설정 및 계정">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = SIDE_NAV_ICONS[item.key]
            const isActive = isSidebarBottomActive(item.key, location.pathname)

            if (item.key === "mypage") {
              return (
                <div key={item.key} className="ff-sidebar-nav-group ff-sidebar-footer-group">
                  <button
                    type="button"
                    className={isActive ? "is-active" : ""}
                    aria-expanded={settingsExpanded}
                    onClick={() => {
                      setSettingsExpanded(true)
                      navigate("/mypage")
                    }}
                  >
                    <Icon aria-hidden="true" size={17} />
                    {item.label}
                  </button>

                  {settingsExpanded ? (
                    <div className="ff-sidebar-subitems" aria-label="설정 하위 메뉴">
                      {SETTINGS_SUB_NAV_ITEMS.map((subItem) => {
                        const subActive = isSidebarSettingsSubActive(subItem.view, location.pathname)
                        return (
                          <button
                            key={subItem.key}
                            type="button"
                            className={subActive ? "is-active" : ""}
                            onClick={() => navigate(subItem.path)}
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

            if (item.key === "logout") {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={handleLogout}
                >
                  <Icon aria-hidden="true" size={17} />
                  {item.label}
                </button>
              )
            }

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
