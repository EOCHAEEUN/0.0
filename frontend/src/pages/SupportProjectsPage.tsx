import { Navigate, useNavigate } from "react-router-dom"
import { getAnalysisResult } from "../features/onboarding/onboardingState"
import "../features/support/AnalysisPoliciesPage.css"

export default function SupportProjectsPage() {
  const navigate = useNavigate()
  const latestResult = getAnalysisResult()

  if (latestResult?.id) {
    return <Navigate to={`/analysis/${latestResult.id}/policies`} replace />
  }

  return (
    <main className="ff-policy-page">
      <section className="ff-policy-shell">
        <div className="ff-policy-empty">
          <span className="ff-policy-badge gray">분석 결과 없음</span>
          <h2>아직 연결할 투자 분석 결과가 없습니다.</h2>
          <p>
            기업 정보와 투자 조건을 입력하면
            <br />
            현재 조건에 맞는 지원사업을 확인할 수 있습니다.
          </p>
          <div className="ff-policy-actions">
            <button
              type="button"
              className="ff-policy-primary"
              onClick={() => navigate("/analysis/new")}
            >
              투자 분석 시작
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
