import { BrowserRouter, Routes, Route } from "react-router-dom"

import DashboardPage from "./pages/DashboardPage"
import RoiPage from "./pages/RoiPage"
import ApplicationDraftPage from "./pages/ApplicationDraftPage"
import SupportProjectsPage from "./pages/SupportProjectsPage"
import SupportDetailPage from "./pages/SupportDetailPage"
import AiAdvisorPage from "./pages/AiAdvisorPage"
import SafetyPage from "./pages/SafetyPage"
import GlobalAiAdvisor from "./components/GlobalAiAdvisor"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/roi" element={<RoiPage />} />
        <Route path="/application-draft" element={<ApplicationDraftPage />} />
        <Route path="/support-projects" element={<SupportProjectsPage />} />
        <Route path="/support-detail" element={<SupportDetailPage />} />
        <Route path="/advisor" element={<AiAdvisorPage />} />
        <Route path="/ai" element={<AiAdvisorPage />} />
        <Route path="/ai-advisor" element={<AiAdvisorPage />} />
        <Route path="/safety" element={<SafetyPage />} />
      </Routes>

      <GlobalAiAdvisor />
    </BrowserRouter>
  )
}

export default App