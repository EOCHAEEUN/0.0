import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { AdvisorFloatingButton } from "./components/AdvisorFloatingButton"
import { AdvisorFloatingButton as GuestAdvisorFloatingButton } from "../../components/advisor/AdvisorFloatingButton"
import { AdvisorMobilePanel } from "../../components/advisor/AdvisorMobilePanel"
import type { AdvisorScreen } from "../../components/advisor/advisor.types"
import { getAccessToken } from "../../services/auth"
import "./aiAdvisor.css"
import "../../components/advisor/advisor.css"

export function GlobalAiAdvisor() {
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

  const isEquipmentPage =
    location.pathname === "/equipment" || location.pathname.startsWith("/equipment/")

  const isEmbeddedAdvisorHost =
    new URLSearchParams(location.search).get("embeddedAdvisor") === "1"

  const activeAdvisorRoute =
    location.pathname === "/advisor" ||
    location.pathname === "/ai-advisor" ||
    location.pathname === "/ai"

  useEffect(() => {
    if (activeAdvisorRoute) {
      setOpen(false)
    }
  }, [activeAdvisorRoute])

  const advisorIframeUrl = useMemo(() => {
    const query = new URLSearchParams()
    query.set("embeddedAdvisor", "1")
    const currentQuery = new URLSearchParams(location.search)
    const analysisId =
      currentQuery.get("analysisId") ||
      currentQuery.get("analysis_id") ||
      location.pathname.match(/^\/analysis\/([^/]+)\//)?.[1] ||
      ""
    if (analysisId) query.set("analysisId", analysisId)
    return `/advisor?${query.toString()}`
  }, [location.pathname, location.search])

  // 설비현황 페이지는 페이지 내부 EquipmentGuideChatLauncher가 챗봇을 담당
  if (isEquipmentPage || isEmbeddedAdvisorHost) {
    return null
  }

  if (isLoggedIn) {
    return (
      <>
        <AdvisorFloatingButton
          open={open}
          onClick={() => {
            if (activeAdvisorRoute) return
            setOpen((prev) => !prev)
          }}
        />
        {open && !activeAdvisorRoute && (
          <section
            className="ff-advisor-popup-shell"
            aria-label="AI Advisor 팝업"
            onClick={() => setOpen(false)}
          >
            <div className="ff-advisor-popup-stage" onClick={(event) => event.stopPropagation()}>
              <header className="ff-advisor-popup-head">
                <strong>AI Advisor</strong>
                <button type="button" onClick={() => setOpen(false)} aria-label="닫기">
                  닫기
                </button>
              </header>
              <iframe
                title="FactoFit AI Advisor"
                className="ff-advisor-popup-iframe"
                src={advisorIframeUrl}
              />
            </div>
          </section>
        )}
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
