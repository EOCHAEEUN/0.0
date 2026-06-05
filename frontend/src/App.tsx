import { BrowserRouter, Routes, Route } from "react-router-dom"

import DashboardPage from "./pages/DashboardPage"
import RoiPage from "./pages/RoiPage"
import ApplicationDraftPage from "./pages/ApplicationDraftPage"
import SupportProjectsPage from "./pages/SupportProjectsPage"
import SupportDetailPage from "./pages/SupportDetailPage"
import AiAdvisorPage from "./pages/AiAdvisorPage"
import SafetyPage from "./pages/SafetyPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dashboard */}
        <Route path="/" element={<DashboardPage />} />

        {/* ROI */}
        <Route path="/roi" element={<RoiPage />} />

        {/* Application Draft */}
        <Route
          path="/application-draft"
          element={<ApplicationDraftPage />}
        />

        {/* Support Projects */}
        <Route
          path="/support-projects"
          element={<SupportProjectsPage />}
        />

        {/* Support Detail */}
        <Route
          path="/support-detail"
          element={<SupportDetailPage />}
        />

        {/* AI Advisor */}
        <Route
          path="/advisor"
          element={<AiAdvisorPage />}
        />

        {/* Safety */}
        <Route
          path="/safety"
          element={<SafetyPage />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App