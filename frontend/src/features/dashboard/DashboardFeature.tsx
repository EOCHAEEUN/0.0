import { useNavigate } from "react-router-dom"
import AppHeader from "../../components/AppHeader"
import { DashboardHeroSection } from "./components/DashboardHeroSection"
import { PolicyMatchingSection } from "./components/PolicyMatchingSection"
import { ServiceShortcutSection } from "./components/ServiceShortcutSection"
import { useDashboardData } from "./hooks/useDashboardData"
import { useDashboardPanels } from "./hooks/useDashboardPanels"

export default function DashboardFeature() {
  const navigate = useNavigate()
  const { dashboard } = useDashboardData()
  const panels = useDashboardPanels()

  const selectedProcess =
    dashboard.processItems.find(
      (item) => item.step === panels.hoveredProcessStep,
    ) ?? null

  const summaryProcess =
    dashboard.processItems.find(
      (item) => item.step === panels.hoveredProcessStep,
    ) ??
    dashboard.processItems[2] ??
    dashboard.processItems[0]

  const visibleReasons = panels.showAllReasons
    ? dashboard.reasonItems
    : dashboard.reasonItems.slice(0, 1)
  const visibleDdays = panels.showAllDdays
    ? dashboard.ddayItems
    : dashboard.ddayItems.slice(0, 1)

  return (
    <main className="page">
      <AppHeader />

      <DashboardHeroSection
        openPanel={panels.openPanel}
        togglePanel={panels.togglePanel}
        companyRows={dashboard.companyRows}
        equipmentRows={dashboard.equipmentRows}
        kpiCards={dashboard.kpiCards}
      />

      <PolicyMatchingSection
        processItems={dashboard.processItems}
        hoveredProcessStep={panels.hoveredProcessStep}
        selectedProcess={selectedProcess}
        summaryProcess={summaryProcess}
        visibleReasons={visibleReasons}
        visibleDdays={visibleDdays}
        showGradeGuide={panels.showGradeGuide}
        onGradeGuideChange={panels.setShowGradeGuide}
        onHoveredProcessStepChange={panels.setHoveredProcessStep}
        showAllReasons={panels.showAllReasons}
        onToggleReasons={panels.toggleShowAllReasons}
        showAllDdays={panels.showAllDdays}
        onToggleDdays={panels.toggleShowAllDdays}
      />

      <ServiceShortcutSection
        serviceCards={dashboard.serviceCards}
        onNavigate={navigate}
      />
    </main>
  )
}
