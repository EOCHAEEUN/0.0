import { Link, useLocation, useNavigate } from "react-router-dom"
import { resolveRoiNavigationPath } from "../../features/roi/roiNavigation"

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleRoiNavigation = async () => {
    navigate(await resolveRoiNavigationPath(location.pathname, location.search))
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 items-center justify-between px-8">

        <h1 className="text-2xl font-bold text-blue-600">
          FactoFit
        </h1>

        <nav className="flex items-center gap-8 text-sm font-semibold">
          <Link to="/">대시보드</Link>
          <button type="button" onClick={() => void handleRoiNavigation()}>
            ROI 분석
          </button>
          <Link to="/advisor">AI 어드바이저</Link>
          <Link to="/support-projects">지원사업</Link>
          <Link to="/safety">안전점검</Link>
        </nav>

        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold">
          안산금속(주)
        </div>

      </div>
    </header>
  )
}
