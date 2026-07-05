import { BarChart3, Bot, CheckCircle2, Clock, Sparkles, Wrench, Zap } from "lucide-react"
import { useMemo, useState } from "react"
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

const ROI_TABS = [
  { id: "scenarios", label: "시나리오 비교" },
  { id: "trend", label: "누적 ROI 추이" },
  { id: "strategy", label: "추천 전략 확인" },
] as const

type RoiTabId = (typeof ROI_TABS)[number]["id"]

function ScenarioCardBlock({
  scenario,
  isRecommended,
}: {
  scenario: MobileScenarioCard
  isRecommended: boolean
}) {
  const isScenarioA = scenario.key === "A"

  return (
    <article
      className={`ff-mobile-scenario-card-v2${isRecommended ? " is-recommended" : ""}${
        isScenarioA ? " is-scenario-a" : " is-scenario-b"
      }`}
    >
      <div className="ff-mobile-scenario-card-head">
        <div className="ff-mobile-scenario-card-head-copy">
          <span className="ff-mobile-scenario-badge">{scenario.badge}</span>
          <h3>{scenario.title}</h3>
        </div>
        <div className="ff-mobile-scenario-card-head-side">
          {isRecommended ? (
            <span className="ff-mobile-scenario-recommended">RECOMMENDED (추천)</span>
          ) : null}
          <span className="ff-mobile-scenario-head-icon" aria-hidden="true">
            {isScenarioA ? <Zap size={18} strokeWidth={2.2} /> : <Wrench size={18} strokeWidth={2.2} />}
          </span>
        </div>
      </div>
      <div className="ff-mobile-scenario-card-body">
        {scenario.hasData ? (
          <>
            <div className="ff-mobile-scenario-stats">
              <div>
                <span>총 투자금</span>
                <strong>{scenario.investmentText}</strong>
              </div>
              <div>
                <span>ROI (5년)</span>
                <strong>{scenario.roiText}</strong>
              </div>
              <div>
                <span>회수 기간</span>
                <strong>{scenario.paybackText}</strong>
              </div>
            </div>
            <div className="ff-mobile-scenario-note">{scenario.subtitle}</div>
          </>
        ) : (
          <p className="ff-mobile-empty-inline">시나리오 분석 데이터가 없습니다.</p>
        )}
      </div>
    </article>
  )
}

export default function MobileRoiScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<RoiTabId>("scenarios")
  const [activeStrategyPhaseId, setActiveStrategyPhaseId] = useState("phase-1")
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

  const recommendedPlanLabel = model.recommendedKey ? `${model.recommendedKey}안` : "추천안"
  const activeStrategyPhase =
    model.strategyRoadmap.phases.find((phase) => phase.id === activeStrategyPhaseId) ||
    model.strategyRoadmap.phases[0]

  const openWebDetail = () => {
    if (flowContext.analysisId && model.webDetailPath.startsWith("/roi/")) {
      const query = new URLSearchParams({ analysisId: flowContext.analysisId })
      navigate(`${model.webDetailPath}?${query.toString()}`)
      return
    }
    navigate(model.webDetailPath)
  }

  return (
    <section className="ff-mobile-screen ff-mobile-screen-roi">
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
          <div className="ff-mobile-roi-tabs" role="tablist" aria-label="ROI 분석 탭">
            {ROI_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`ff-mobile-roi-tab${activeTab === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "scenarios" ? (
            <div className="ff-mobile-roi-panel" role="tabpanel">
              <div className="ff-mobile-scenario-stack">
                <ScenarioCardBlock scenario={model.scenarioA} isRecommended={model.recommendedKey === "A"} />
                <ScenarioCardBlock scenario={model.scenarioB} isRecommended={model.recommendedKey === "B"} />
              </div>

              <article className="ff-mobile-roi-ai-card">
                <div className="ff-mobile-roi-ai-head">
                  <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>AI EXPERT ANALYSIS</span>
                  <Bot size={18} strokeWidth={2} className="ff-mobile-roi-ai-icon" aria-hidden="true" />
                </div>
                <h2>
                  {model.recommendedKey ? (
                    <>
                      <u>{recommendedPlanLabel}</u>을 더 추천합니다
                    </>
                  ) : (
                    "추천 전략을 확인해 주세요"
                  )}
                </h2>
                <p>{model.recommendationSummary}</p>
              </article>

              <button type="button" className="ff-mobile-roi-consult-card" onClick={openWebDetail}>
                <span className="ff-mobile-roi-consult-icon" aria-hidden="true">
                  <BarChart3 size={16} strokeWidth={2.2} />
                </span>
                <span className="ff-mobile-roi-consult-copy">
                  <strong>전문가 상담 및 데이터 기반 분석</strong>
                  <span>선택하신 시나리오에 대한 정밀 진단 보고서를 생성할 수 있습니다.</span>
                </span>
              </button>
            </div>
          ) : null}

          {activeTab === "trend" ? (
            <div className="ff-mobile-roi-panel" role="tabpanel">
              <article className="ff-mobile-card">
                <div className="ff-mobile-card-head">
                  <h2>{model.equipmentName}</h2>
                  <span className="ff-mobile-meta">{model.equipmentCategory}</span>
                </div>
                <p className="ff-mobile-meta">{model.recommendedLabel}</p>
              </article>

              <article className="ff-mobile-card">
                <h2>누적 ROI 추이</h2>
                <MobileCumulativeRoiChart roiA={model.chartRoiA} roiB={model.chartRoiB} />
                <p>{model.recommendationSummary}</p>
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
            </div>
          ) : null}

          {activeTab === "strategy" ? (
            <div className="ff-mobile-roi-panel ff-mobile-strategy-panel" role="tabpanel">
              <header className="ff-mobile-strategy-header">
                <span className="ff-mobile-strategy-eyebrow">
                  <Sparkles size={12} strokeWidth={2.2} aria-hidden="true" />
                  {model.strategyRoadmap.eyebrow}
                </span>
                <h1>{model.strategyRoadmap.title}</h1>
                <p>{model.strategyRoadmap.subtitle}</p>
              </header>

              <article className="ff-mobile-strategy-compare-card">
                <div className="ff-mobile-strategy-compare-row">
                  <span className="ff-mobile-strategy-compare-icon" aria-hidden="true">
                    <BarChart3 size={16} strokeWidth={2.2} />
                  </span>
                  <div className="ff-mobile-strategy-compare-copy">
                    <span>ROI COMPARISON</span>
                    <strong>{model.strategyRoadmap.roiComparison.label}</strong>
                    {model.strategyRoadmap.roiComparison.detail ? (
                      <em>{model.strategyRoadmap.roiComparison.detail}</em>
                    ) : null}
                  </div>
                </div>
                <div className="ff-mobile-strategy-compare-divider" aria-hidden="true" />
                <div className="ff-mobile-strategy-compare-row">
                  <span className="ff-mobile-strategy-compare-icon" aria-hidden="true">
                    <Clock size={16} strokeWidth={2.2} />
                  </span>
                  <div className="ff-mobile-strategy-compare-copy">
                    <span>PAYBACK PERIOD</span>
                    <strong>{model.strategyRoadmap.paybackComparison.label}</strong>
                    {model.strategyRoadmap.paybackComparison.detail ? (
                      <em>{model.strategyRoadmap.paybackComparison.detail}</em>
                    ) : (
                      <em>투자비 조기 회수 가능 분석</em>
                    )}
                  </div>
                </div>
              </article>

              <div className="ff-mobile-strategy-phase-tabs" role="tablist" aria-label="로드맵 단계">
                {model.strategyRoadmap.phases.map((phase) => (
                  <button
                    key={phase.id}
                    type="button"
                    role="tab"
                    aria-selected={activeStrategyPhaseId === phase.id}
                    className={`ff-mobile-strategy-phase-tab${
                      activeStrategyPhaseId === phase.id ? " is-active" : ""
                    }`}
                    onClick={() => setActiveStrategyPhaseId(phase.id)}
                  >
                    {phase.phase}
                  </button>
                ))}
              </div>

              {activeStrategyPhase ? (
                <article className="ff-mobile-strategy-phase-panel" role="tabpanel">
                  <div className="ff-mobile-strategy-phase-head">
                    <h2>{activeStrategyPhase.title}</h2>
                    <span className="ff-mobile-strategy-phase-duration">{activeStrategyPhase.duration}</span>
                  </div>
                  <div className="ff-mobile-strategy-task-list">
                    {activeStrategyPhase.items.map((item) => (
                      <div key={item} className="ff-mobile-strategy-task">
                        <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden="true" />
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              <article className="ff-mobile-strategy-summary">
                <span className="ff-mobile-strategy-summary-label">{model.strategyRoadmap.summaryTitle}</span>
                <p>{model.strategyRoadmap.summary}</p>
              </article>

              <button type="button" className="ff-mobile-primary-btn" onClick={openWebDetail}>
                웹에서 상세 분석 보기
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
