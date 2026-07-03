import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AdvisorFloatingButton } from "./components/AdvisorFloatingButton"
import { AdvisorFloatingButton as GuestAdvisorFloatingButton } from "../../components/advisor/AdvisorFloatingButton"
import { AdvisorMobilePanel } from "../../components/advisor/AdvisorMobilePanel"
import type { AdvisorScreen } from "../../components/advisor/advisor.types"
import { getAccessToken } from "../../services/auth"
import "./aiAdvisor.css"
import "../../components/advisor/advisor.css"

export function GlobalAiAdvisor() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getAccessToken()))
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<AdvisorScreen>("home")

  // 경로 변경마다 로그인 상태 재동기화 (로그인/로그아웃 후 navigate 시 반영)
  useEffect(() => {
    setIsLoggedIn(Boolean(getAccessToken()))
  }, [location.pathname])

  // 다른 탭에서 발생한 storage 변경 보조 동기화
  useEffect(() => {
    const sync = () => setIsLoggedIn(Boolean(getAccessToken()))
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  // 로그인 상태 전환 시 패널 닫기 및 화면 초기화
  useEffect(() => {
    setOpen(false)
    setScreen("home")
  }, [isLoggedIn])

  const activeAdvisorRoute =
    location.pathname === "/advisor" ||
    location.pathname === "/ai-advisor" ||
    location.pathname === "/ai"

  if (isLoggedIn) {
    return (
      <>
        <AdvisorFloatingButton
          open={activeAdvisorRoute}
          onClick={() => {
            if (!activeAdvisorRoute) {
              const query = new URLSearchParams(location.search)
              const analysisId =
                query.get("analysisId") ||
                query.get("analysis_id") ||
                location.pathname.match(/^\/analysis\/([^/]+)\//)?.[1] ||
                ""
              const path = analysisId
                ? `/advisor?analysisId=${encodeURIComponent(analysisId)}`
                : "/advisor"
              navigate(path)
            }
          }}
        />
      </>
    )
  }

  return (
    <div className="factofit-global-advisor" data-version="FACTOFIT_FLOATING_ADVISOR_V1">
      <GuestAdvisorFloatingButton
        open={open}
        onClick={() => {
          if (!open) setScreen("home")
          setOpen((v) => !v)
        }}
      />
      {open && (
        <AdvisorMobilePanel
          screen={screen}
          onScreenChange={setScreen}
          onClose={() => {
            setOpen(false)
            setScreen("home")
          }}
        />
      )}
    </div>
  )
}

export default GlobalAiAdvisor
