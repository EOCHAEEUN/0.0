import { Check, Lightbulb, Settings, Zap } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { RoiEvidenceMetricsView, RoiKpiView, RoiScenarioView, RoiStrategyCardView } from "./RoiAnalysisResultView"

export type RoiWorkspaceViewProps = {
  view: "strategy" | "analysis" | "roadmap"
  equipmentName: string
  recLabel: string
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
  onGoAnalysis: () => void
  onGoRoadmap: () => void
}

const STRATEGY_RECOMMENDATION_COPY: Record<"a" | "b", string> = {
  a: "A안은 초기 투자비가 높으나, 에너지 절감 효과와 장기적인 ROI 관점에서 압도적인 수익성을 보장하므로 전체 교체 안을 강력 추천합니다.",
  b: "B안은 초기 투자 부담을 낮추면서 병목 공정 개선에 집중할 수 있어, 단계적 예산 집행과 리스크 관리에 유리합니다.",
}

function StrategyRecommendationSection({
  scenarioA,
  scenarioB,
  aiStrategySummary,
  onGoAnalysis,
}: {
  scenarioA: RoiScenarioView
  scenarioB: RoiScenarioView
  aiStrategySummary: string
  onGoAnalysis: () => void
}) {
  const navigate = useNavigate()
  const recommendedScenario = scenarioA.isRecommended
    ? scenarioA
    : scenarioB.isRecommended
      ? scenarioB
      : scenarioA
  const recShortLabel = recommendedScenario.id === "b" ? "B안" : "A안"
  const recommendationBody =
    recommendedScenario.id === "a" || recommendedScenario.id === "b"
      ? STRATEGY_RECOMMENDATION_COPY[recommendedScenario.id]
      : aiStrategySummary

  return (
    <>
      <section className="ff-roi-strategy-action" aria-label="추천 및 상세 분석">
        <div className="ff-roi-strategy-action-bar">
          <div className="ff-roi-strategy-action-intro">
            <strong>전문가 상담 및 데이터 기반 분석</strong>
            <p>선택하신 시나리오에 대한 정밀 진단 보고서를 생성할 수 있습니다.</p>
          </div>

          <div className="ff-roi-strategy-action-rec">
            <strong>{recShortLabel}을 더 추천합니다</strong>
            <p>{recommendationBody}</p>
          </div>

          <button type="button" className="ff-roi-strategy-action-btn" onClick={onGoAnalysis}>
            상세 분석 보기 →
          </button>
        </div>
      </section>

      <footer className="ff-dashboard-workspace-footer ff-roi-strategy-footer">
        <p>© 2024 FactoFit Industrial Analytics. All rights reserved.</p>
        <div className="ff-dashboard-workspace-footer-links">
          <button type="button" onClick={() => navigate("/")}>
            이용약관
          </button>
          <button type="button" onClick={() => navigate("/")}>
            개인정보처리방침
          </button>
          <button type="button" onClick={() => navigate("/")}>
            문의하기
          </button>
        </div>
      </footer>
    </>
  )
}

function StrategyScenarioCard({
  scenario,
  onSelect,
}: {
  scenario: RoiScenarioView
  onSelect: () => void
}) {
  const isA = scenario.id === "a"

  return (
    <button
      type="button"
      className={[
        "ff-roi-strategy-scenario-card",
        isA ? "is-a" : "is-b",
        scenario.isRecommended ? "is-recommended" : "",
        scenario.isActive ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
    >
      <div className="ff-roi-strategy-scenario-head">
        <div className="ff-roi-strategy-scenario-head-text">
          <span className="ff-roi-strategy-scenario-code">{isA ? "Scenario A" : "Scenario B"}</span>
          <h3>{scenario.title}</h3>
        </div>
        <div className="ff-roi-strategy-scenario-head-side">
          {scenario.isRecommended ? (
            <span className="ff-roi-strategy-scenario-rec">RECOMMENDED</span>
          ) : null}
          <span className="ff-roi-strategy-scenario-icon" aria-hidden="true">
            {isA ? <Zap size={22} strokeWidth={2.2} /> : <Settings size={22} strokeWidth={2.2} />}
          </span>
        </div>
      </div>

      <div className="ff-roi-strategy-scenario-body">
        <dl className="ff-roi-strategy-scenario-kpis">
          <div>
            <dt>총 투자금</dt>
            <dd>{scenario.investment}</dd>
          </div>
          <div>
            <dt>ROI (5년)</dt>
            <dd className={scenario.isRecommended ? "is-accent" : ""}>{scenario.roi}</dd>
          </div>
          <div>
            <dt>회수 기간</dt>
            <dd>{scenario.payback}</dd>
          </div>
        </dl>
        <p className="ff-roi-strategy-scenario-note">{scenario.summary}</p>
      </div>
    </button>
  )
}

function AnalysisTopKpiRow({
  kpis,
  scenarioA,
}: {
  kpis: RoiKpiView[]
  scenarioA: RoiScenarioView
}) {
  const recommendedLabel = scenarioA.isRecommended ? "A" : "B"
  const roiKpi = kpis.find((item) => item.label === "예상 ROI")
  const netKpi = kpis.find((item) => item.label === "실부담금")
  const subsidyKpi = kpis.find((item) => item.label === "적용 가능 지원금")

  return (
    <div className="ff-roi-analysis-kpi-row">
      <article className="ff-roi-analysis-kpi-card ff-roi-analysis-kpi-card--roi">
        <span>EXPECTED ROI ({recommendedLabel})</span>
        <div className="ff-roi-analysis-kpi-value-row">
          <strong>{roiKpi?.value ?? "-"}</strong>
          <em>/ 24개월 기준</em>
        </div>
        <p>연간 비용 절감 효과를 반영한 기대 수익률입니다.</p>
      </article>

      <article className="ff-roi-analysis-kpi-card ff-roi-analysis-kpi-card--subsidy">
        <span>예상 지원금 수혜</span>
        <dl className="ff-roi-analysis-subsidy-rows">
          <div>
            <dt>자기부담금</dt>
            <dd>{netKpi?.value ?? "-"}</dd>
          </div>
          <div>
            <dt>지원금</dt>
            <dd>{subsidyKpi?.value ?? "-"}</dd>
          </div>
        </dl>
        <div className="ff-roi-analysis-subsidy-total">
          <span>총합</span>
          <strong>{subsidyKpi?.value ?? "-"}</strong>
        </div>
      </article>
    </div>
  )
}

function AnalysisScenarioCard({ scenario }: { scenario: RoiScenarioView }) {
  const isA = scenario.id === "a"
  const displayTitle = isA ? "A안 (전체 교체)" : "B안 (부분 교체)"

  return (
    <article
      className={[
        "ff-roi-analysis-scenario-card",
        isA ? "is-a" : "is-b",
        scenario.isRecommended ? "is-recommended" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="ff-roi-analysis-scenario-head">
        <h3>{displayTitle}</h3>
        {scenario.isRecommended ? (
          <span className="ff-roi-analysis-scenario-badge">최적 제안</span>
        ) : null}
      </header>

      <div className="ff-roi-analysis-scenario-body">
        <dl className="ff-roi-analysis-scenario-metrics">
          <div>
            <dt>총 투자금</dt>
            <dd>{scenario.investmentDetail}</dd>
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

        <div className="ff-roi-analysis-scenario-footer">
          <div>
            <span>ROI</span>
            <strong className={scenario.isRecommended ? "is-accent" : ""}>{scenario.roi}</strong>
          </div>
          <div>
            <span>회수기간</span>
            <strong className={scenario.isRecommended ? "is-accent" : ""}>{scenario.payback}</strong>
          </div>
        </div>
      </div>
    </article>
  )
}

function RoiCumulativeChart({
  scenarioA,
  scenarioB,
}: {
  scenarioA: RoiScenarioView
  scenarioB: RoiScenarioView
}) {
  const parseRoi = (value: string) => {
    const parsed = Number.parseFloat(value.replace("%", ""))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const roiA = parseRoi(scenarioA.roi)
  const roiB = parseRoi(scenarioB.roi)
  const maxRoi = Math.max(roiA, roiB, 100)
  const pointsA = [0, 0.25, 0.5, 0.75, 1].map((t, index) => {
    const x = 40 + t * 520
    const y = 180 - (roiA * t * 160) / maxRoi
    return `${index === 0 ? "M" : "L"}${x},${y}`
  })
  const pointsB = [0, 0.25, 0.5, 0.75, 1].map((t, index) => {
    const x = 40 + t * 520
    const y = 180 - (roiB * t * 160) / maxRoi
    return `${index === 0 ? "M" : "L"}${x},${y}`
  })

  const xLabels = ["투자시점", "6개월", "12개월", "18개월", "24개월"]
  const xPositions = [40, 170, 300, 430, 560]

  return (
    <section className="ff-roi-chart-panel" aria-label="시나리오별 누적 ROI 추이">
      <header className="ff-roi-chart-head ff-roi-chart-head--split">
        <h2>시나리오별 누적 ROI 추이</h2>
        <div className="ff-roi-chart-legend ff-roi-chart-legend--top">
          <span>
            <i className="dot solid" /> 시나리오 A (전체 교체)
          </span>
          <span>
            <i className="dot dashed" /> 시나리오 B (부분 교체)
          </span>
        </div>
      </header>
      <div className="ff-roi-chart-canvas-wrap">
        <svg viewBox="0 0 600 220" className="ff-roi-chart-canvas" role="img" aria-hidden="true">
          <line x1="40" y1="180" x2="560" y2="180" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="40" y1="40" x2="40" y2="180" stroke="#e2e8f0" strokeWidth="1" />
          <path d={pointsA.join(" ")} fill="none" stroke="#123b6d" strokeWidth="3" />
          <path d={pointsB.join(" ")} fill="none" stroke="#64748b" strokeWidth="3" strokeDasharray="8 6" />
          {xLabels.map((label, index) => (
            <text
              key={label}
              x={xPositions[index]}
              y={200}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
              fontWeight="700"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>
    </section>
  )
}

const ROADMAP_PHASES = [
  {
    phase: "PHASE 1",
    duration: "3개월",
    title: "데이터 통합 및 기반 구축",
    items: [
      "설비 가동·에너지 소비 데이터 실시간 수집 체계 구축",
      "병목 공정 식별 및 데이터 정밀도 검증",
    ],
  },
  {
    phase: "PHASE 2",
    duration: "6개월",
    title: "AI 모델 최적화 및 시뮬레이션",
    items: [
      "과거 생산 데이터 기반 예지보전 AI 모델 도입",
      "가상 시나리오를 통한 공정 효율 시뮬레이션 및 ROI 검증",
    ],
  },
  {
    phase: "PHASE 3",
    duration: "12개월",
    title: "지능형 자율 공정 확산",
    items: [
      "ERP·MES 연동 자동화",
      "AI 기반 실시간 의사결정 지원 시스템 현장 적용",
    ],
  },
]

export function RoiWorkspaceViews(props: RoiWorkspaceViewProps) {
  const {
    view,
    equipmentName,
    recLabel,
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
    kpis,
    onSelectScenario,
    onGoAnalysis,
    onGoRoadmap,
  } = props

  const [scenarioA, scenarioB] = scenarios

  if (view === "strategy") {
    return (
      <>
        <header className="ff-roi-page-intro">
          <div>
            <h1>ROI 기반 전략적 투자 분석</h1>
            <p className="ff-roi-page-sub">
              산업 현장의 고도화를 위한 정밀 투자 분석 솔루션입니다. 정책 지원금과 운영 효율성을 결합하여
              가장 합리적인 의사결정 지표를 제공합니다.
            </p>
          </div>
        </header>

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
          <section className="ff-roi-scenario-section ff-roi-scenario-section--strategy" aria-label="시나리오 비교">
            <header className="ff-roi-scenario-head">
              <div className="ff-roi-scenario-head-row">
                <div>
                  <p className="ff-roi-live-badge">Live Simulation</p>
                  <h2>시나리오 비교 분석</h2>
                </div>
              </div>
              <p>초기 부담과 장기 효과를 함께 비교하세요.</p>
            </header>

            <div className="ff-roi-scenario-grid ff-roi-scenario-grid--strategy">
              <StrategyScenarioCard scenario={scenarioA} onSelect={() => onSelectScenario("a")} />
              <StrategyScenarioCard scenario={scenarioB} onSelect={() => onSelectScenario("b")} />
            </div>
          </section>
        ) : null}

        <StrategyRecommendationSection
          scenarioA={scenarioA}
          scenarioB={scenarioB}
          aiStrategySummary={aiStrategySummary}
          onGoAnalysis={onGoAnalysis}
        />
      </>
    )
  }

  if (view === "analysis") {
    return (
      <>
        <header className="ff-roi-page-intro ff-roi-page-intro--analysis">
          <div>
            <h1>ROI 상세 시나리오 및 분석 근거</h1>
            <p className="ff-roi-page-sub">누적 기대 수익률과 지원금 반영 효과를 상세히 비교합니다.</p>
          </div>
          <div className="ff-roi-page-actions">
            <button type="button" className="ff-roi-inline-btn" onClick={onGoRoadmap}>
              AI 추천 전략 확인
            </button>
          </div>
        </header>

        {hasScenarios ? (
          <>
            <AnalysisTopKpiRow kpis={kpis} scenarioA={scenarioA} />
            <section className="ff-roi-analysis-scenario-section" aria-label="시나리오 상세 비교">
              <div className="ff-roi-analysis-scenario-grid">
                <AnalysisScenarioCard scenario={scenarioA} />
                <AnalysisScenarioCard scenario={scenarioB} />
              </div>
            </section>
            <RoiCumulativeChart scenarioA={scenarioA} scenarioB={scenarioB} />
          </>
        ) : null}

        <section className="ff-roi-analysis-bottom" aria-label="추천 요약 및 참고 지표">
          <article className="ff-roi-analysis-rec-card">
            <header className="ff-roi-analysis-rec-head">
              <Lightbulb size={16} strokeWidth={2.2} aria-hidden="true" />
              <h2>추천 요약</h2>
            </header>
            <div className="ff-roi-analysis-rec-box">
              <p>{aiStrategySummary || evidenceTitle}</p>
            </div>
            <div className="ff-roi-analysis-rec-chips">
              {evidenceBullets.slice(0, 2).map((bullet) => (
                <div key={bullet} className="ff-roi-analysis-rec-chip">
                  <span className="ff-roi-analysis-rec-chip-check" aria-hidden="true">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <p>{bullet}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="ff-roi-analysis-ref-card">
            <h2 className="ff-roi-analysis-ref-title">참고 지표 데이터</h2>
            <div className="ff-roi-analysis-ref-rows">
              <div className="ff-roi-analysis-ref-row">
                <span>기존 설비 노후도</span>
                <div className="ff-roi-analysis-ref-value">
                  <strong className="is-danger">{evidenceMetrics.agingPct}%</strong>
                  <em>(매우 높음)</em>
                </div>
              </div>
              <div className="ff-roi-analysis-ref-row">
                <span>예상 에너지 절감율</span>
                <strong className="is-success">
                  {evidenceMetrics.energySavingRate !== null
                    ? `${evidenceMetrics.energySavingRate}%`
                    : "-"}
                </strong>
              </div>
              <div className="ff-roi-analysis-ref-row">
                <span>동종업계 평균 ROI</span>
                <strong>{evidenceMetrics.industryAvgRoi.toFixed(1)}%</strong>
              </div>
            </div>
          </aside>
        </section>
      </>
    )
  }

  return (
    <>
      <header className="ff-roi-page-intro ff-roi-page-intro--roadmap">
        <div>
          <p className="ff-roi-page-eyebrow ai">AI INSIGHT</p>
          <h1>제조 공정 효율화를 위한 3단계 AI 추천 로드맵</h1>
          <p className="ff-roi-page-sub">
            {recLabel}을 우선 검토안으로 선정했습니다. 정책 반영, 실투자금, 연간 절감 효과, 설비 노후도를
            종합해 단계별 실행 로드맵을 제안합니다.
          </p>
        </div>
      </header>

      <section className="ff-roi-roadmap-compare" aria-label="ROI 비교 요약">
        <div>
          <span>ROI COMPARISON</span>
          <strong>{roiDiffLabel ?? "ROI 비교 데이터 준비 중"}</strong>
          {roiDiffDetail ? <em>{roiDiffDetail}</em> : null}
        </div>
        <div>
          <span>PAYBACK PERIOD</span>
          <strong>{paybackDiffLabel ? `회수 기간 약 ${paybackDiffLabel}` : "회수기간 비교 준비 중"}</strong>
          {paybackDiffDetail ? <em>{paybackDiffDetail}</em> : null}
        </div>
      </section>

      <section className="ff-roi-roadmap-section" aria-label="단계별 AI 추천 로드맵">
        <h2>단계별 AI 추천 로드맵</h2>
        <div className="ff-roi-roadmap-grid">
          {ROADMAP_PHASES.map((phase) => (
            <article key={phase.phase} className="ff-roi-roadmap-card">
              <div className="ff-roi-roadmap-card-head">
                <span className="ff-roi-roadmap-phase">{phase.phase}</span>
                <span className="ff-roi-roadmap-duration">{phase.duration}</span>
              </div>
              <h3>{phase.title}</h3>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>
                    <span className="ff-roi-roadmap-check" aria-hidden="true">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="ff-roi-roadmap-summary">
        <span className="ff-roi-summary-eyebrow">{aiStrategyTitle}</span>
        <p>{aiStrategySummary}</p>
      </section>
    </>
  )
}
