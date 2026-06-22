import { BrowserRouter, Route, Routes } from "react-router-dom"

import GlobalAiAdvisor from "./components/GlobalAiAdvisor"
import {
  GuestRoute,
  ProtectedRoute,
  SessionExpiryRedirect,
} from "./components/auth/RouteGuards"
import AiAdvisorPage from "./pages/AiAdvisorPage"
import ApplicationDraftPage from "./pages/ApplicationDraftPage"
import DashboardPage from "./pages/DashboardPage"
import LoginPage from "./pages/LoginPage"
import MainPage from "./pages/MainPage"
import MyPage from "./pages/MyPage"
import RoiPage from "./pages/RoiPage"
import SafetyPage from "./pages/SafetyPage"
import SupportDetailPage from "./pages/SupportDetailPage"
import SupportProjectsPage from "./pages/SupportProjectsPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/" element={<MainPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/roi" element={<RoiPage />} />
          <Route path="/application-draft" element={<ApplicationDraftPage />} />
          <Route path="/support-projects" element={<SupportProjectsPage />} />
          <Route path="/support-detail" element={<SupportDetailPage />} />
          <Route path="/advisor" element={<AiAdvisorPage />} />
          <Route path="/ai" element={<AiAdvisorPage />} />
          <Route path="/ai-advisor" element={<AiAdvisorPage />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/mypage" element={<MyPage />} />
        </Route>
      </Routes>

      <SessionExpiryRedirect />
      <GlobalAiAdvisor />
    </BrowserRouter>
  )
}

export default App
