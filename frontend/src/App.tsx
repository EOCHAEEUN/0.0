import { BrowserRouter, Navigate, Routes, Route, useParams } from "react-router-dom"

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
import EquipmentSetupPage from "./features/onboarding/pages/EquipmentSetupPage"
import AnalysisNewPage from "./features/onboarding/pages/AnalysisNewPage"
import AnalysisReviewPage from "./features/onboarding/pages/AnalysisReviewPage"
import AnalysisResultPage from "./features/onboarding/pages/AnalysisResultPage"

// 공통 레이아웃 (GlobalHeader + 인증 가드 포함)
import AuthenticatedLayout from "./components/layout/AuthenticatedLayout"

function AnalysisPoliciesRedirect() {
  const { id, policyId } = useParams()
  const query = new URLSearchParams()
  if (id) query.set("analysisId", id)
  if (policyId) query.set("policyId", policyId)
  const queryText = query.toString()
  return <Navigate to={queryText ? `/support-projects?${queryText}` : "/support-projects"} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/*
         * ── 공개 페이지: 로그인 여부와 관계없이 항상 접근 가능 ──
         */}
        {/* / 는 항상 랜딩 페이지 — 로그인 상태여도 대시보드로 강제 이동하지 않음 */}
        <Route path="/" element={<MainPage />} />
        {/* /main 은 레거시 경로 — / 로 리다이렉트 */}
        <Route path="/main" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/setup/company" element={<CompanySetupPage />} />
        <Route path="/setup/equipment" element={<EquipmentSetupPage />} />
        {/* 분석 생성/검토는 온보딩 UI 흐름이므로 공통 헤더 제외 */}
        <Route path="/analysis/new" element={<AnalysisNewPage />} />
        <Route path="/analysis/review" element={<AnalysisReviewPage />} />

        {/*
         * ── 보호된 서비스 페이지: 로그인 필요 (AuthenticatedLayout이 인증 가드 역할) ──
         * 미인증 시 /login?redirect=<현재경로> 로 이동하며, 로그인 후 원래 경로로 복귀합니다.
         */}
        <Route element={<AuthenticatedLayout />}>
          {/* 대시보드 */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* ROI 분석 */}
          <Route path="/roi" element={<RoiPage />} />

          {/* 투자 분석 결과 */}
          <Route path="/analysis/:id/result" element={<AnalysisResultPage />} />
          <Route path="/analysis/:id" element={<AnalysisResultPage />} />

          {/* 지원사업 추천 */}
          <Route path="/analysis/:id/policies" element={<AnalysisPoliciesRedirect />} />
          <Route path="/analysis/:id/policies/:policyId" element={<AnalysisPoliciesRedirect />} />
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
