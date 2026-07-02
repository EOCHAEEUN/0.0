import { NavLink, useLocation, useNavigate } from "react-router-dom"

import { resolveApplicationDraftNavigationPath } from "../../features/roi/roiNavigation"

const menuItems = [
  { label: "홈 대시보드", path: "/" },
  { label: "ROI 분석", path: "/roi" },
  { label: "신청서 초안", path: "/application-draft" },
  { label: "지원사업", path: "/support-projects/priority" },
  { label: "AI 어드바이저", path: "/advisor" },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleApplicationDraftNavigation = async () => {
    const path = await resolveApplicationDraftNavigationPath(location.pathname, location.search)
    navigate(path)
  }

  return (
    <aside className="w-64 bg-slate-900 p-5 text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-black">
          Facto<span className="text-blue-400">Fit</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          제조기업 설비투자 AI 어드바이저
        </p>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) =>
          item.path === "/application-draft" ? (
            <button
              key={item.path}
              type="button"
              onClick={() => void handleApplicationDraftNavigation()}
              className={[
                "block w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition",
                location.pathname === "/application-draft" ||
                location.pathname.startsWith("/application-draft/")
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </button>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                [
                  "block rounded-xl px-4 py-3 text-sm font-bold transition",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
    </aside>
  )
}