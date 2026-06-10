import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { simulateRoi } from "../services/api"

type RoiScenario = {
  label?: string
  investment_manwon: number
  subsidy_manwon: number
  net_investment_manwon: number
  annual_net_benefit_manwon?: number
  payback_years: number
  roi_pct?: number
  breakdown?: {
    energy_saving_manwon?: number
    maintenance_saving_manwon?: number
    defect_saving_manwon?: number
    energy_saving_method?: string
    defect_saving_method?: string
  }
}

type RecommendationItem =
  | string
  | {
      factor?: string
      impact?: string
      message?: string
      source?: string
      [key: string]: unknown
    }

type RoiResult = {
  scenario_a: RoiScenario
  scenario_b: RoiScenario
  risk?: {
    score?: number
    level?: string
  }
  ai_recommendation?: {
    summary?: string
    top_reasons?: RecommendationItem[]
    risks?: RecommendationItem[]
  }
}

const demoInput = {
  equipment: {
    name: "유압 프레스 라인 A",
    category: "press",
    age_years: 15,
    energy_cost_annual: 4800,
    defect_rate: 3.2,
    new_energy_cost_annual: 3360,
    new_investment_manwon: 15000,
    maintenance_cost_annual: 660,
    capacity_value: 250,
    production_qty: 10000,
    contribution_margin_won: 5000,
  },
  company_context: {},
  scenario_a_investment_manwon: 15000,
  scenario_a_subsidy_manwon: 12400,
  scenario_b_investment_manwon: 3250,
  scenario_b_subsidy_manwon: 1500,
}

function formatManwon(value?: number) {
  if (value === undefined || value === null) return "-"

  if (value >= 10000) {
    const eok = value / 10000
    return `${
      Number.isInteger(eok)
        ? eok.toFixed(0)
        : eok.toFixed(2).replace(/\.?0+$/, "")
    }억`
  }

  return `${value.toLocaleString()}만`
}

function formatManwonWithUnit(value?: number) {
  const formatted = formatManwon(value)
  if (formatted === "-") return "-"
  return formatted.includes("억") ? formatted : `${formatted}원`
}

function renderRecommendationText(item: RecommendationItem) {
  if (typeof item === "string") return item

  return (
    item.message ??
    item.impact ??
    item.factor ??
    item.source ??
    JSON.stringify(item)
  )
}

export default function RoiPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RoiResult | null>(null)

  useEffect(() => {
    async function fetchRoiResult() {
      try {
        setLoading(true)
        setError(null)

        const data = await simulateRoi(demoInput)
        setResult(data)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "ROI API 호출 중 오류가 발생했습니다."
        )
      } finally {
        setLoading(false)
      }
    }

    fetchRoiResult()
  }, [])

  if (loading) {
    return (

        <main className="factofit-page">
          <section className="factofit-section">
            <div className="factofit-container">
              <button
                onClick={() => navigate("/")}
                className="factofit-back-button"
              >
                ← 이전으로 돌아가기
              </button>

              <div className="roi-loading-card">
                <p className="factofit-label">FactoFit ROI Analysis</p>
                <h1 className="factofit-title">
                  ROI 분석 결과를 불러오는 중입니다
                </h1>
                <p className="factofit-desc">
                  백엔드 API에서 설비 투자 시나리오를 계산하고 있습니다.
                </p>
              </div>
            </div>
          </section>
        </main>

    )
  }

  if (error) {
    return (

        <main className="factofit-page">
          <section className="factofit-section">
            <div className="factofit-container">
            <button
              onClick={() => navigate("/?screen=dashboard")}
              className="factofit-back-button"
            >
              ← 이전으로 돌아가기
            </button>

              <div className="roi-error-card">
                <p className="factofit-label">ROI API 연결 오류</p>
                <h1 className="factofit-title">
                  ROI 분석 결과를 불러오지 못했습니다
                </h1>
                <p className="factofit-desc">{error}</p>
                <p className="mt-3 text-sm font-semibold text-slate-400">
                  백엔드 서버가 켜져 있는지, /api/roi/simulate 응답이
                  200인지 확인해 주세요.
                </p>
              </div>
            </div>
          </section>
        </main>

    )
  }

  if (!result) {
    return (

        <main className="factofit-page">
          <section className="factofit-section">
            <div className="factofit-container">
              <div className="roi-error-card">
                <h1 className="factofit-title">
                  ROI 결과 데이터가 없습니다.
                </h1>
              </div>
            </div>
          </section>
        </main>

    )
  }

  const scenarioA = result.scenario_a
  const scenarioB = result.scenario_b

  return (

      <main className="factofit-page">
        <section className="factofit-section">
          <div className="factofit-container">
            <button
              onClick={() => navigate("/?screen=dashboard")}
              className="factofit-back-button">
              ← 대시보드로 돌아가기
            </button>

            <div className="mt-10">
              <p className="factofit-label">FactoFit ROI Analysis</p>
              <h1 className="factofit-title">
                {demoInput.equipment.name} ROI 분석 결과
              </h1>
              <p className="factofit-desc">
                설비 노후도, 에너지 비용, 고장 이력, 지원사업 매칭을
                기준으로 투자 회수 가능성을 분석했습니다.
              </p>
            </div>

            <div className="roi-kpi-grid">
              <div className="roi-kpi-card red">
                <span>설비 연식</span>
                <b>{demoInput.equipment.age_years}년</b>
                <p>교체 권고 기준 초과</p>
              </div>

              <div className="roi-kpi-card">
                <span>예상 투자금</span>
                <b>{formatManwon(scenarioA.investment_manwon)}</b>
                <p>고효율 프레스 교체 기준</p>
              </div>

              <div className="roi-kpi-card green">
                <span>예상 지원금</span>
                <b>{formatManwon(scenarioA.subsidy_manwon)}</b>
                <p>에너지공단 지원사업 매칭</p>
              </div>

              <div className="roi-kpi-card blue">
                <span>회수기간</span>
                <b>{scenarioA.payback_years}년</b>
                <p>예상 ROI {scenarioA.roi_pct ?? "-"}%</p>
              </div>
            </div>

            <div className="roi-main-layout">
              <article className="roi-result-card">
                <span className="roi-card-label">AI 추천 시나리오 A</span>

                <h3>{scenarioA.label ?? "고효율 프레스 교체"}</h3>

                <p>
                  초기 투자금은 크지만, 에너지 비용 절감과 불량률 개선
                  효과가 높아 가장 추천되는 선택입니다.
                </p>

                <div className="roi-value-list">
                  <div className="roi-value-row">
                    <span>연간 에너지 절감</span>
                    <strong>
                      {formatManwonWithUnit(
                        scenarioA.breakdown?.energy_saving_manwon
                      )}
                    </strong>
                  </div>

                  <div className="roi-value-row">
                    <span>불량 감소 효과</span>
                    <strong>
                      {formatManwonWithUnit(
                        scenarioA.breakdown?.defect_saving_manwon
                      )}
                    </strong>
                  </div>

                  <div className="roi-value-row">
                    <span>유지보수 절감</span>
                    <strong>
                      {formatManwonWithUnit(
                        scenarioA.breakdown?.maintenance_saving_manwon
                      )}
                    </strong>
                  </div>

                  <div className="roi-value-row">
                    <span>실부담 투자금</span>
                    <strong className="dark">
                      {formatManwonWithUnit(
                        scenarioA.net_investment_manwon
                      )}
                    </strong>
                  </div>
                </div>

                <button
                  onClick={() => navigate("/application-draft")}
                  className="roi-primary-button"
                >
                  시나리오 A 신청서 초안 생성
                </button>
              </article>

              <article className="roi-secondary-card">
                <span className="roi-secondary-label">비교 시나리오 B</span>

                <h3>{scenarioB.label ?? "부분 정비 + 스마트 모니터링"}</h3>

                <p>
                  초기 비용은 낮지만 절감 효과가 제한적이며, 장기적으로는
                  교체보다 효율이 낮습니다.
                </p>

                <div className="roi-value-list">
                  <div className="roi-value-row">
                    <span>연간 에너지 절감</span>
                    <strong>
                      {formatManwonWithUnit(
                        scenarioB.breakdown?.energy_saving_manwon
                      )}
                    </strong>
                  </div>

                  <div className="roi-value-row">
                    <span>예상 지원금</span>
                    <strong>
                      {formatManwonWithUnit(scenarioB.subsidy_manwon)}
                    </strong>
                  </div>

                  <div className="roi-value-row">
                    <span>실부담 투자금</span>
                    <strong className="dark">
                      {formatManwonWithUnit(
                        scenarioB.net_investment_manwon
                      )}
                    </strong>
                  </div>

                  <div className="roi-value-row">
                    <span>회수기간</span>
                    <strong className="dark">
                      {scenarioB.payback_years}년
                    </strong>
                  </div>
                </div>

                <button className="roi-secondary-button">
                  시나리오 B 상세 보기
                </button>
              </article>
            </div>

            <div className="roi-ai-summary">
              <h3>팩토핏 AI 종합 의견</h3>

              <p>
                {result.ai_recommendation?.summary ??
                  "시나리오 A는 지원금 규모와 회수기간 측면에서 가장 유리한 선택입니다."}
              </p>

              {result.ai_recommendation?.top_reasons &&
                result.ai_recommendation.top_reasons.length > 0 && (
                  <ul className="mt-4">
                    {result.ai_recommendation.top_reasons.map(
                      (reason, index) => (
                        <li key={index}>
                          {renderRecommendationText(reason)}
                        </li>
                      )
                    )}
                  </ul>
                )}

              {result.ai_recommendation?.risks &&
                result.ai_recommendation.risks.length > 0 && (
                  <div className="mt-5">
                    <h4 className="mb-2 text-sm font-black text-white">
                      주의할 점
                    </h4>
                    <ul>
                      {result.ai_recommendation.risks.map((risk, index) => (
                        <li key={index}>
                          {renderRecommendationText(risk)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        </section>
      </main>

  )
}