import type { ReactNode } from "react"
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Landmark,
  Leaf,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react"

export type RoiKpiView = {
  label: string
  value: string
  sub?: string
  accent?: string
}

export type RoiStrategyCardView = {
  icon: ReactNode
  label: string
  level: string
  desc: string
  tone: "blue" | "purple"
}

export type RoiScenarioView = {
  id: "a" | "b"
  title: string
  subLabel: string
  investment: string
  subsidy: string
  net: string
  saving: string
  roi: string
  payback: string
  isRecommended: boolean
  isActive: boolean
}

export type RoiEvidenceMetricsView = {
  agingPct: number
  energySavingRate: number | null
  industryAvgRoi: number
}

type RoiAnalysisResultViewProps = {
  equipmentName: string
  heroMain: string
  heroSub?: string | null
  kpis: RoiKpiView[]
  strategyCards: RoiStrategyCardView[]
  scenarios: [RoiScenarioView, RoiScenarioView]
  hasScenarios: boolean
  aiStrategyTitle: string
  aiStrategySummary: string
  roiDiffLabel?: string | null
  roiDiffDetail?: string | null
  paybackDiffLabel?: string | null
  paybackDiffDetail?: string | null
  evidenceTitle: string
  evidenceBullets: string[]
  evidenceMetrics: RoiEvidenceMetricsView
  reanalysisError?: string
  isResolvingReanalysis?: boolean
  onSupportProjects: () => void
  onReanalysis: () => void
  onSelectScenario: (id: "a" | "b") => void
}

export function RoiAnalysisResultView({
  equipmentName,
  heroMain,
  heroSub,
  kpis,
  strategyCards,
  scenarios,
  hasScenarios,
  aiStrategyTitle,
  aiStrategySummary,
  roiDiffLabel,
  roiDiffDetail,
  paybackDiffLabel,
  paybackDiffDetail,
  evidenceTitle,
  evidenceBullets,
  evidenceMetrics,
  reanalysisError,
  isResolvingReanalysis,
  onSupportProjects,
  onReanalysis,
  onSelectScenario,
}: RoiAnalysisResultViewProps) {
  const [scenarioA, scenarioB] = scenarios

  return (
    <>
      <section className="ff-roi-hero" aria-label="ROI 분석 요약">
        {reanalysisError ? (
          <p className="ff-roi-hero-error" role="alert">
            {reanalysisError}
          </p>
        ) : null}

        <div className="ff-roi-hero-grid">
          <div className="ff-roi-hero-copy">
            <span className="ff-roi-hero-badge">
              <Sparkles size={14} aria-hidden="true" />
              FACTOFIT AI ENGI
            </span>
            <h1>{equipmentName} 투자 검토</h1>
            <p className="ff-roi-hero-lead">{heroMain}</p>
            {heroSub ? <p className="ff-roi-hero-sub">{heroSub}</p> : null}
            <div className="ff-roi-hero-actions">
              <button type="button" className="ff-roi-btn primary" onClick={onSupportProjects}>
                지원사업 상세보기
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ff-roi-btn secondary"
                onClick={onReanalysis}
                disabled={isResolvingReanalysis}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                {isResolvingReanalysis ? "설비 정보 확인 중..." : "투자 조건 다시 설정"}
              </button>
            </div>
          </div>

          <div className="ff-roi-hero-kpis">
            {kpis.map((kpi) => {
              const isPendingSubsidy =
                kpi.label === "적용 가능 지원금" &&
                (kpi.value.includes("확인") || kpi.value.includes("미반영"))
              return (
                <div key={kpi.label} className="ff-roi-hero-kpi">
                  <span className="ff-roi-hero-kpi-label">{kpi.label}</span>
                  <strong
                    className={[
                      "ff-roi-hero-kpi-value",
                      isPendingSubsidy ? "is-pending-subsidy" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={!isPendingSubsidy && kpi.accent ? { color: kpi.accent } : undefined}
                  >
                    {kpi.value}
                  </strong>
                  {kpi.sub ? <em className="ff-roi-hero-kpi-sub">{kpi.sub}</em> : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="ff-roi-panel" aria-label="전략적 투자 결정 이유">
        <h2>ROI를 통한 전략적 투자 결정이 필요한 이유</h2>
        <div className="ff-roi-strategy-grid">
          {strategyCards.map((card) => (
            <article
              key={card.label}
              className={`ff-roi-strategy-card ${card.tone === "purple" ? "is-purple" : ""}`}
            >
              <div className="ff-roi-strategy-icon">{card.icon}</div>
              <div className="ff-roi-strategy-title-row">
                <strong>{card.label}</strong>
                <span className={`ff-roi-level-badge ${card.tone === "purple" ? "purple" : "blue"}`}>
                  {card.level}
                </span>
              </div>
              <p>{card.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {hasScenarios ? (
        <section className="ff-roi-scenario-section" aria-label="시나리오 비교">
          <header className="ff-roi-scenario-head">
            <h2>시나리오 비교</h2>
            <p>초기 부담과 장기 효과를 함께 비교하세요.</p>
          </header>

          <div className="ff-roi-scenario-grid">
            <button
              type="button"
              className={[
                "ff-roi-scenario-card",
                scenarioA.isRecommended ? "is-recommended" : "",
                scenarioA.isActive ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectScenario("a")}
            >
              <ScenarioCardBody scenario={scenarioA} />
            </button>

            <div className="ff-roi-scenario-vs" aria-hidden="true">
              <span>VS</span>
            </div>

            <button
              type="button"
              className={[
                "ff-roi-scenario-card",
                scenarioB.isRecommended ? "is-recommended" : "",
                scenarioB.isActive ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectScenario("b")}
            >
              <ScenarioCardBody scenario={scenarioB} />
            </button>

            <aside className="ff-roi-scenario-summary">
              <span className="ff-roi-summary-eyebrow">{aiStrategyTitle}</span>
              <p className="ff-roi-summary-text">{aiStrategySummary}</p>
              <div className="ff-roi-summary-stats">
                {roiDiffLabel ? (
                  <div className="ff-roi-summary-stat">
                    <span>ROI 차이</span>
                    <strong>{roiDiffLabel}</strong>
                    {roiDiffDetail ? <em>{roiDiffDetail}</em> : null}
                  </div>
                ) : null}
                {paybackDiffLabel ? (
                  <div className="ff-roi-summary-stat">
                    <span>회수기간 단축</span>
                    <strong>{paybackDiffLabel}</strong>
                    {paybackDiffDetail ? <em>{paybackDiffDetail}</em> : null}
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <section className="ff-roi-evidence-panel" aria-label="AI 분석 상세 근거">
        <header className="ff-roi-evidence-head">
          <span className="ff-roi-evidence-head-icon" aria-hidden="true">
            <BrainCircuit size={20} />
          </span>
          <h2>AI 분석 상세 근거</h2>
        </header>
        <div className="ff-roi-evidence-grid">
          <div className="ff-roi-evidence-summary">
            <p className="ff-roi-evidence-eyebrow">추천 요약</p>
            <p className="ff-roi-evidence-lead">{evidenceTitle}</p>
            <ul className="ff-roi-evidence-bullets">
              {evidenceBullets.map((bullet) => (
                <li key={bullet}>
                  <span className="ff-roi-evidence-check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <aside className="ff-roi-evidence-metrics">
            <p className="ff-roi-evidence-metrics-title">참고 지표 데이터</p>
            <div className="ff-roi-evidence-metric">
              <span>기존 설비 노후도</span>
              <strong className="is-danger">{evidenceMetrics.agingPct}% (매우 높음)</strong>
            </div>
            <div className="ff-roi-evidence-metric">
              <span>예상 에너지 절감율</span>
              <strong className="is-success">
                {evidenceMetrics.energySavingRate !== null
                  ? `${evidenceMetrics.energySavingRate}%`
                  : "-"}
              </strong>
            </div>
            <div className="ff-roi-evidence-metric">
              <span>동종업계 평균 ROI</span>
              <strong>{evidenceMetrics.industryAvgRoi.toFixed(1)}%</strong>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

export const ROI_STRATEGY_ICONS = {
  subsidy: <Landmark size={18} aria-hidden="true" />,
  equipment: <Zap size={18} aria-hidden="true" />,
  energy: <Leaf size={18} aria-hidden="true" />,
  safety: <ShieldCheck size={18} aria-hidden="true" />,
}

function ScenarioCardBody({ scenario }: { scenario: RoiScenarioView }) {
  return (
    <>
      <div className="ff-roi-scenario-card-head">
        <div className="ff-roi-scenario-card-tags">
          {scenario.isRecommended ? <span className="ff-roi-rec-badge">추천</span> : null}
          <span className={scenario.isRecommended ? "is-accent" : ""}>{scenario.subLabel}</span>
        </div>
        <h3>{scenario.title}</h3>
      </div>

      <dl className="ff-roi-scenario-rows">
        <div>
          <dt>총 투자금</dt>
          <dd>{scenario.investment}</dd>
        </div>
        <div>
          <dt>적용 가능 지원금</dt>
          <dd className="is-green">{scenario.subsidy}</dd>
        </div>
        <div>
          <dt>실부담금</dt>
          <dd>{scenario.net}</dd>
        </div>
        <div>
          <dt>연간 순편익</dt>
          <dd>{scenario.saving}</dd>
        </div>
      </dl>

      <div className="ff-roi-scenario-footer">
        <div>
          <span>ROI</span>
          <strong className={scenario.isRecommended ? "is-accent" : ""}>{scenario.roi}</strong>
        </div>
        <div>
          <span>회수기간</span>
          <strong className={scenario.isRecommended ? "is-accent" : ""}>{scenario.payback}</strong>
        </div>
      </div>
    </>
  )
}
