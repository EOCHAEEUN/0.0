import { useState } from "react"
import { AdvisorFloatingButton } from "./components/AdvisorFloatingButton"
import { AdvisorAgentPanel } from "./components/AdvisorAgentPanel"
import "./aiAdvisor.css"

export function GlobalAiAdvisor() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <AdvisorFloatingButton open={open} onClick={() => setOpen((value) => !value)} />
      <AdvisorAgentPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default GlobalAiAdvisor
