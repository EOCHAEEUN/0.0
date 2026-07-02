import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useLocation } from "react-router-dom"
import botIcon from "../../assets/advisor/factofit-ai-bot.png"
import { AdvisorFloatingButton } from "./components/AdvisorFloatingButton"
import { AdvisorFloatingButton as GuestAdvisorFloatingButton } from "../../components/advisor/AdvisorFloatingButton"
import { AdvisorMobilePanel } from "../../components/advisor/AdvisorMobilePanel"
import type { AdvisorScreen } from "../../components/advisor/advisor.types"
import AiAdvisorPage from "../../pages/AiAdvisorPage"
import { getAccessToken } from "../../services/auth"
import "./aiAdvisor.css"
import "../../components/advisor/advisor.css"

export function GlobalAiAdvisor() {
  const location = useLocation()
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getAccessToken()))
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<AdvisorScreen>("home")

  useEffect(() => {
    setIsLoggedIn(Boolean(getAccessToken()))
  }, [location.pathname])

  useEffect(() => {
    const sync = () => setIsLoggedIn(Boolean(getAccessToken()))
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

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

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  if (isEquipmentPage || isEmbeddedAdvisorHost || activeAdvisorRoute) {
    return null
  }

  if (isLoggedIn) {
    return (
      <>
        <AdvisorFloatingButton
          open={open}
          onClick={() => setOpen((prev) => !prev)}
        />
        {open &&
          createPortal(
            <section
              className="ff-advisor-popup-shell"
              aria-label="AI Advisor 팝업"
              role="dialog"
              aria-modal="true"
            >
              <div className="ff-advisor-popup-stage">
                <header className="ff-advisor-popup-head">
                  <div className="ff-advisor-popup-brand">
                    <img src={botIcon} alt="" className="ff-advisor-popup-brand-icon" />
                    <strong>AI Advisor</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="닫기"
                  >
                    닫기
                  </button>
                </header>
                <div className="ff-advisor-popup-body">
                  <AiAdvisorPage popupMode />
                </div>
              </div>
            </section>,
            document.body,
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
