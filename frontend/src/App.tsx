import { BrowserRouter, Routes, Route } from "react-router-dom"

import MainPage from "./pages/MainPage"
import LoginPage from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import RoiPage from "./pages/RoiPage"
import ApplicationDraftPage from "./pages/ApplicationDraftPage"
import SupportProjectsPage from "./pages/SupportProjectsPage"
import SupportDetailPage from "./pages/SupportDetailPage"
import AiAdvisorPage from "./pages/AiAdvisorPage"
import SafetyPage from "./pages/SafetyPage"
import MyPage from "./pages/MyPage"
import GlobalAiAdvisor from "./features/aiAdvisor/GlobalAiAdvisor"
import WelcomePage from "./features/onboarding/pages/WelcomePage"
import CompanySetupPage from "./features/onboarding/pages/CompanySetupPage"
import AnalysisNewPage from "./features/onboarding/pages/AnalysisNewPage"
import AnalysisReviewPage from "./features/onboarding/pages/AnalysisReviewPage"
import AnalysisResultPage from "./features/onboarding/pages/AnalysisResultPage"
import {
  AnalysisPoliciesPage,
  AnalysisPolicyDetailPage,
} from "./features/support/AnalysisPoliciesPage"

// 공통 레이아웃 (GlobalHeader 포함)
import AuthenticatedLayout from "./components/layout/AuthenticatedLayout"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/*
         * ── 공통 헤더가 없는 독립 페이지 ──
         * 메인 랜딩, 로그인, 온보딩 플로우는 자체 헤더를 사용합니다.
         */}
        <Route path="/main" element={<MainPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/setup/company" element={<CompanySetupPage />} />
        {/* 분석 생성/검토는 온보딩 UI 흐름이므로 공통 헤더 제외 */}
        <Route path="/analysis/new" element={<AnalysisNewPage />} />
        <Route path="/analysis/review" element={<AnalysisReviewPage />} />

        {/*
         * ── 서비스 페이지: 공통 글로벌 헤더 (AuthenticatedLayout) 적용 ──
         * AuthenticatedLayout이 GlobalHeader + Outlet을 렌더링합니다.
         */}
        <Route element={<AuthenticatedLayout />}>
          {/* 대시보드 */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* ROI 분석 */}
          <Route path="/roi" element={<RoiPage />} />

          {/* 투자 분석 결과 */}
          <Route path="/analysis/:id/result" element={<AnalysisResultPage />} />
          <Route path="/analysis/:id" element={<AnalysisResultPage />} />

          {/* 지원사업 추천 */}
          <Route path="/analysis/:id/policies" element={<AnalysisPoliciesPage />} />
          <Route
            path="/analysis/:id/policies/:policyId"
            element={<AnalysisPolicyDetailPage />}
          />
          <Route
            path="/analysis/:id/policies/:policyId/application"
            element={<ApplicationDraftPage />}
          />

          {/* 신청서 작성 */}
          <Route path="/application-draft" element={<ApplicationDraftPage />} />

          {/* 지원사업 목록 */}
          <Route path="/support-projects" element={<SupportProjectsPage />} />
          <Route path="/support-detail" element={<SupportDetailPage />} />

          {/* AI Advisor (Engi) */}
          <Route path="/advisor" element={<AiAdvisorPage />} />
          <Route path="/ai" element={<AiAdvisorPage />} />
          <Route path="/ai-advisor" element={<AiAdvisorPage />} />

          {/* 안전개선 근거 */}
          <Route path="/safety" element={<SafetyPage />} />

          {/* 설비 관리 / 마이페이지 */}
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/company" element={<MyPage />} />
        </Route>
      </Routes>

      {/* GlobalAiAdvisor는 모든 페이지에서 플로팅으로 유지 */}
      <GlobalAiAdvisor />
    </BrowserRouter>
  )
}

export default App
