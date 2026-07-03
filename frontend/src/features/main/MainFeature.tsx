import { useNavigate } from "react-router-dom"
import MainHeader from "../../components/main/MainHeader"
import MainDialog from "../../components/main/MainDialog"
import { BusinessSection } from "./components/BusinessSection"
import { DashboardPreviewSection } from "./components/DashboardPreviewSection"
import { InsightsSection } from "./components/InsightsSection"
import { MainFooter } from "./components/MainFooter"
import { MainHeroSection } from "./components/MainHeroSection"
import { SustainabilitySection } from "./components/SustainabilitySection"
import { WhyTeaserSection } from "./components/WhyTeaserSection"
import { useMainPage } from "./hooks/useMainPage"

export default function MainFeature() {
  const navigate = useNavigate()
  const {
    dialogType,
    setDialogType,
    newsletterEmail,
    setNewsletterEmail,
    whyTeaserRef,
    handleHeroScroll,
    handleNewsletterSubmit,
  } = useMainPage()

  const openWhyDialog = () => setDialogType("why")
  const openServicesDialog = () => setDialogType("services")
  const openDashboardDialog = () => setDialogType("dashboard")
  const openSupportDialog = () => setDialogType("support")

  return (
    <main className="ff-main-page">
      <MainHeader
        onLoginClick={() => navigate("/login")}
        onWhyClick={openWhyDialog}
        onServicesClick={openServicesDialog}
        onDashboardClick={openDashboardDialog}
        onSupportClick={openSupportDialog}
      />

      <MainHeroSection onScrollToWhy={handleHeroScroll} />

      <WhyTeaserSection sectionRef={whyTeaserRef} onOpenWhy={openWhyDialog} />

      <BusinessSection onOpenServices={openServicesDialog} />

      <DashboardPreviewSection onOpenDashboard={openDashboardDialog} />

      <SustainabilitySection onOpenDashboard={openDashboardDialog} />

      <InsightsSection
        newsletterEmail={newsletterEmail}
        onNewsletterEmailChange={setNewsletterEmail}
        onNewsletterSubmit={handleNewsletterSubmit}
      />

      <MainFooter />

      <MainDialog
        type={dialogType}
        onClose={() => setDialogType(null)}
        onLoginClick={() => navigate("/login")}
      />
    </main>
  )
}
