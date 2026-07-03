import { useState } from "react"
import { AdvisorFloatingButton } from "./AdvisorFloatingButton"
import { AdvisorMobilePanel } from "./AdvisorMobilePanel"
import type { AdvisorScreen } from "./advisor.types"
import "./advisor.css"

export function GlobalAiAdvisor() {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<AdvisorScreen>("home")

  const handleOpen = () => {
    setOpen((value) => !value)
    if (!open) {
      setScreen("home")
    }
  }

  const handleClose = () => {
    setOpen(false)
    setScreen("home")
  }

  return (
    <div className="factofit-global-advisor" data-version="FACTOFIT_FLOATING_ADVISOR_V1">
      <AdvisorFloatingButton open={open} onClick={handleOpen} />
      {open && (
        <AdvisorMobilePanel
          screen={screen}
          onScreenChange={setScreen}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

export default GlobalAiAdvisor
