import { useState } from "react"
import type { OpenPanel } from "../dashboard.parts"

export function useDashboardPanels() {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [showGradeGuide, setShowGradeGuide] = useState(false)
  const [hoveredProcessStep, setHoveredProcessStep] = useState<string | null>(
    null,
  )
  const [showAllReasons, setShowAllReasons] = useState(false)
  const [showAllDdays, setShowAllDdays] = useState(false)

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  const toggleShowAllReasons = () => {
    setShowAllReasons((prev) => !prev)
  }

  const toggleShowAllDdays = () => {
    setShowAllDdays((prev) => !prev)
  }

  return {
    openPanel,
    togglePanel,
    showGradeGuide,
    setShowGradeGuide,
    hoveredProcessStep,
    setHoveredProcessStep,
    showAllReasons,
    toggleShowAllReasons,
    showAllDdays,
    toggleShowAllDdays,
  }
}
