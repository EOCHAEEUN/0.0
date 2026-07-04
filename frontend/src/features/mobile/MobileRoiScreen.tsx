import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { MobileCumulativeRoiChart } from "./components/MobileCumulativeRoiChart"
import { MobileScreenFeedback } from "./components/MobileScreenFeedback"
import { MobileTopBar } from "./components/MobileTopBar"
import { resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileRoiViewModel } from "./mobileApp.mapper"
import type { MobileScenarioCard } from "./mobileApp.types"

function ScenarioCardBlock({
  scenario,
  isRecommended,
}: {
  scenario: MobileScenarioCard
  isRecommended: boolean
}) {
  return (
    <article className={`ff-mobile-scenario-card${isRecommended ? " is-recommended" : ""}`}>
      <div className="ff-mobile-card-head">
        <span className="ff-mobile-scenario-badge">{scenario.badge}</span>
        {isRecommended ? <span className="ff-mobile-recommend-pill">추천안</span> : null}
      </div>
      <h3>{scenario.title}</h3>
      <p>{scenario.subtitle}</p>
      {scenario.hasData ? (
        <div className="ff-mobile-scenario-metrics">
          <div>
            <span>투자금</span>
            <strong>{scenario.investmentText}</strong>
          </div>
          <div>
            <span>지원금</span>
            <strong>{scenario.subsidyText}</strong>
          </div>
          <div>
            <span>실부담금</span>
            <strong>{scenario.netInvestmentText}</strong>
          </div>
          <div>
            <span>회수기간</span>
            <strong>{scenario.paybackText}</strong>
          </div>
          <div>
            <span>ROI</span>
            <strong>{scenario.roiText}</strong>
          </div>
          <div>
            <span>연간 순편익</span>
            <strong>{scenario.annualBenefitText}</strong>
          </div>
        </div>
      ) : (
        <p className="ff-mobile-empty-inline">시나리오 분석 데이터가 없습니다.</p>
      )}
    </article>
  )
}

export default function MobileRoiScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard, loading, error, refetch } = useDashboardData({ preferredAnalysisId })
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, dashboard.workspace),
    [dashboard.workspace, searchParams],
  )
  const draftWorkspace = useApplicationDraftWorkspace({
    analysisId: flowContext.analysisId,
    policyId: flowContext.policyId,
    companyId: getStoredCompanyId() || undefined,
  })
  const model = useMemo(
    () =>
      mapMobileRoiViewModel({
        dashboard,
        draftWorkspace: draftWorkspace.data,
      }),
    [dashboard, draftWorkspace.data],
  )

  return (
    <section className="ff-mobile-screen">
      <MobileTopBar companyName={dashboard.workspace.companyName || "FactoFit"} subtitle="ROI 분석" showSubtitle />

      <MobileScreenFeedback loading={loading} error={error} onRetry={refetch} />

      {!loading && !error && !model.hasAnalysis ? (
        <article className="ff-mobile-card">
          <h2>ROI 분석 없음</h2>
          <p>{model.emptyMessage}</p>
          <button type="button" className="ff-mobile-primary-btn" onClick={() => navigate(model.emptyCtaPath)}>
            웹에서 ROI 분석 시작
          </button>
        </article>
      ) : null}

      {!loading && !error && model.hasAnalysis ? (
        <>
          <header className="ff-mobile-page-title">
            <span className="ff-mobile-section-label">ROI INTRO</span>
            <h1>{model.introTitle}</h1>
            <p>{model.introBody}</p>
          </header>

          <article className="ff-mobile-card">
            <div className="ff-mobile-card-head">
              <h2>{model.equipmentName}</h2>
              <span className="ff-mobile-meta">{model.equipmentCategory}</span>
            </div>
            <p className="ff-mobile-meta">{model.recommendedLabel}</p>
          </article>

          <article className="ff-mobile-card">
            <div className="ff-mobile-card-head">
              <h2>A/B 시나리오 비교</h2>
              {model.recommendedKey ? (
                <span className="ff-mobile-recommend-pill">{model.recommendedKey}안 추천</span>
              ) : null}
            </div>
            <div className="ff-mobile-scenario-grid">
              <ScenarioCardBlock
                scenario={model.scenarioA}
                isRecommended={model.recommendedKey === "A"}
              />
              <ScenarioCardBlock
                scenario={model.scenarioB}
                isRecommended={model.recommendedKey === "B"}
              />
            </div>
          </article>

          <article className="ff-mobile-card">
            <h2>핵심 ROI 수치</h2>
            <p className="ff-mobile-kpi">{model.roiMetricValue}</p>
            <p className="ff-mobile-meta">{model.roiMetricLabel}</p>
            <div className="ff-mobile-kpi-grid">
              {model.kpis.map((kpi) => (
                <div key={kpi.label} className="ff-mobile-kpi-cell">
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="ff-mobile-card">
            <h2>누적 ROI 추이</h2>
            <MobileCumulativeRoiChart roiA={model.chartRoiA} roiB={model.chartRoiB} />
            <p>{model.recommendationSummary}</p>
          </article>

          <article className="ff-mobile-card">
            <h2>AI 투자 로드맵</h2>
            <div className="ff-mobile-roadmap-list">
              {model.roadmapSteps.map((step) => (
                <div key={step.phase} className="ff-mobile-roadmap-item">
                  <span>
                    {step.phase} · {step.duration}
                  </span>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
            <p>{model.aiSummary}</p>
            <button
              type="button"
              className="ff-mobile-primary-btn"
              onClick={() => {
                if (flowContext.analysisId && model.webDetailPath.startsWith("/roi/")) {
                  const query = new URLSearchParams({ analysisId: flowContext.analysisId })
                  navigate(`${model.webDetailPath}?${query.toString()}`)
                  return
                }
                navigate(model.webDetailPath)
              }}
            >
              웹에서 상세 분석 보기
            </button>
          </article>
        </>
      ) : null}
    </section>
  )
}
