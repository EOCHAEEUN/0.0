import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { simulateRoi } from "../services/api"

type RoiForm = {
  equipmentName: string
  industry: string
  equipmentAge: number
  defectRate: number
  totalInvestment: number
  expectedSupport: number
  annualSaving: number
  maintenanceCost: number
}

type RoiResult = {
  roi: number
  paybackMonths: number
  actualCost: number
  supportFitScore: number
  savingEffectScore: number
  agingScore: number
  safetyRiskScore: number
  statusLabel: string
  description: string
}

type ApiStatus = "idle" | "loading" | "success" | "error" | "empty"

type RoiApiScenario = {
  label?: string
  investment_manwon?: number
  subsidy_manwon?: number
  net_investment_manwon?: number
  annual_net_benefit_manwon?: number
  payback_years?: number
  roi_pct?: number
}

type RoiApiData = {
  scenario_a?: RoiApiScenario
  scenario_b?: RoiApiScenario
  recommended?: string
}

type RoiApiResponse = {
  success?: boolean
  data?: RoiApiData | null
}

const initialForm: RoiForm = {
  equipmentName: "프레스 설비",
  industry: "금속가공 제조업",
  equipmentAge: 11,
  defectRate: 5.8,
  totalInvestment: 3.2,
  expectedSupport: 1.2,
  annualSaving: 1.7,
  maintenanceCost: 0.4,
}

function calculateRoi(form: RoiForm): RoiResult {
  const actualCost = Math.max(form.totalInvestment - form.expectedSupport, 0.1)
  const roi = Math.round((form.annualSaving / actualCost) * 1000) / 10
  const paybackMonths = Math.max(
    Math.round((actualCost / Math.max(form.annualSaving, 0.1)) * 12),
    1,
  )

  const supportFitScore = Math.min(
    Math.round((form.expectedSupport / Math.max(form.totalInvestment, 0.1)) * 220),
    98,
  )

  const savingEffectScore = Math.min(
    Math.round((form.annualSaving / actualCost) * 100),
    96,
  )

  const agingScore = Math.min(Math.round(form.equipmentAge * 7), 95)

  const safetyRiskScore = Math.min(
    Math.round(form.equipmentAge * 5.5 + form.defectRate * 3),
    92,
  )

  let statusLabel = "투자 검토"
  let description =
    "지원금과 절감 효과를 함께 고려해 설비 교체 여부를 검토할 수 있습니다."

  if (roi >= 45 && paybackMonths <= 18) {
    statusLabel = "투자 적합"
    description =
      "정부지원금 적용 후 실부담금이 낮아지고, 에너지 비용과 불량률 개선 효과를 고려할 때 투자 적합도가 높습니다."
  } else if (roi >= 25) {
    statusLabel = "조건부 적합"
    description =
      "ROI는 양호하지만 지원금 확보 여부와 유지보수비 절감 가능성을 추가로 확인하는 것이 좋습니다."
  } else {
    statusLabel = "재검토 필요"
    description =
      "현재 입력값 기준으로는 투자 회수기간이 길 수 있어 지원금, 절감액, 설비 규모를 다시 검토해야 합니다."
  }

  return {
    roi,
    paybackMonths,
    actualCost,
    supportFitScore,
    savingEffectScore,
    agingScore,
    safetyRiskScore,
    statusLabel,
    description,
  }
}

function formatEok(value: number) {
  return `${value.toFixed(1)}억`
}

function safeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function roundTo(value: number, digits = 1) {
  const unit = 10 ** digits
  return Math.round(value * unit) / unit
}

function getEquipmentCategory(equipmentName: string) {
  const normalized = equipmentName.trim().toLowerCase()

  if (normalized.includes("프레스")) return "프레스"
  if (normalized.includes("press")) return "프레스"
  if (normalized.includes("cnc")) return "CNC"
  if (normalized.includes("사출")) return "사출"
  if (normalized.includes("용접")) return "용접"
  if (normalized.includes("컨베이어")) return "컨베이어"

  return equipmentName.trim() || "프레스"
}

function buildRoiPayload(form: RoiForm) {
  const investmentManwon = Math.max(Math.round(form.totalInvestment * 10000), 1)
  const subsidyManwon = Math.min(
    Math.max(Math.round(form.expectedSupport * 10000), 0),
    investmentManwon,
  )

  const scenarioBInvestmentManwon = Math.max(
    Math.round(investmentManwon * 0.8),
    1,
  )

  const scenarioBSubsidyManwon = Math.min(
    Math.max(Math.round(subsidyManwon * 1.1), 0),
    scenarioBInvestmentManwon,
  )

  const energyCostAnnual = Math.max(
    Math.round(form.annualSaving * 100000000),
    1000000,
  )

  const newEnergyCostAnnual = Math.max(Math.round(energyCostAnnual * 0.72), 0)

  const maintenanceCostAnnual = Math.max(
    Math.round(form.maintenanceCost * 100000000),
    0,
  )

  return {
    equipment: {
      name: form.equipmentName || "프레스 설비",
      category: getEquipmentCategory(form.equipmentName),
      age_years: safeNumber(form.equipmentAge, 0),
      energy_cost_annual: energyCostAnnual,
      defect_rate: safeNumber(form.defectRate, 0),
      new_energy_cost_annual: newEnergyCostAnnual,
      new_investment_manwon: investmentManwon,
      maintenance_cost_annual: maintenanceCostAnnual,
      capacity_value: 0,
      production_qty: 100000,
      contribution_margin_won: 1500,
    },
    company_context: {
      industry_name: form.industry || "제조업",
    },
    scenario_a_investment_manwon: investmentManwon,
    scenario_a_subsidy_manwon: subsidyManwon,
    scenario_b_investment_manwon: scenarioBInvestmentManwon,
    scenario_b_subsidy_manwon: scenarioBSubsidyManwon,
  }
}

function normalizeRoiApiData(response: unknown): RoiApiData | null {
  if (!response || typeof response !== "object") {
    return null
  }

  const responseObject = response as RoiApiResponse & RoiApiData

  if (
    responseObject.data &&
    typeof responseObject.data === "object" &&
    (responseObject.data.scenario_a || responseObject.data.scenario_b)
  ) {
    return responseObject.data
  }

  if (responseObject.scenario_a || responseObject.scenario_b) {
    return {
      scenario_a: responseObject.scenario_a,
      scenario_b: responseObject.scenario_b,
      recommended: responseObject.recommended,
    }
  }

  return null
}

function isValidScenario(scenario: RoiApiScenario | undefined) {
  return Boolean(scenario && typeof scenario === "object")
}

function getRecommendedScenario(apiData: RoiApiData) {
  const recommended = String(apiData.recommended || "").toUpperCase()

  if (recommended === "A" && isValidScenario(apiData.scenario_a)) {
    return apiData.scenario_a
  }

  if (recommended === "B" && isValidScenario(apiData.scenario_b)) {
    return apiData.scenario_b
  }

  const scenarioCandidates = [apiData.scenario_a, apiData.scenario_b].filter(
    isValidScenario,
  ) as RoiApiScenario[]

  if (scenarioCandidates.length === 0) {
    return null
  }

  return [...scenarioCandidates].sort(
    (a, b) => safeNumber(b.roi_pct, -999999) - safeNumber(a.roi_pct, -999999),
  )[0]
}

function normalizeDisplayRoi(apiRoi: number, fallbackRoi: number) {
  if (!Number.isFinite(apiRoi) || apiRoi <= 0) {
    return fallbackRoi
  }

  if (apiRoi > 1000) {
    return fallbackRoi
  }

  return roundTo(apiRoi, 1)
}

function normalizePaybackMonths(apiPaybackYears: number, fallbackMonths: number) {
  if (!Number.isFinite(apiPaybackYears) || apiPaybackYears <= 0) {
    return fallbackMonths
  }

  if (apiPaybackYears > 30) {
    return fallbackMonths
  }

  return Math.max(Math.round(apiPaybackYears * 12), 1)
}

function mapApiResultToRoiResult(
  form: RoiForm,
  apiData: RoiApiData,
): RoiResult | null {
  const bestScenario = getRecommendedScenario(apiData)

  if (!bestScenario) {
    return null
  }

  const localResult = calculateRoi(form)

  const investmentManwon = safeNumber(
    bestScenario.investment_manwon,
    form.totalInvestment * 10000,
  )

  const subsidyManwon = safeNumber(
    bestScenario.subsidy_manwon,
    form.expectedSupport * 10000,
  )

  const netInvestmentManwon = safeNumber(
    bestScenario.net_investment_manwon,
    Math.max(investmentManwon - subsidyManwon, 1000),
  )

  const apiRoi = safeNumber(bestScenario.roi_pct, localResult.roi)
  const roi = normalizeDisplayRoi(apiRoi, localResult.roi)

  const paybackYears = safeNumber(bestScenario.payback_years, 0)
  const paybackMonths = normalizePaybackMonths(
    paybackYears,
    localResult.paybackMonths,
  )

  const actualCost = Math.max(netInvestmentManwon / 10000, 0.1)

  const supportFitScore = Math.min(
    Math.round((subsidyManwon / Math.max(investmentManwon, 1)) * 100),
    98,
  )

  const savingEffectScore = Math.min(Math.round(Math.max(roi, 0)), 96)

  const agingScore = Math.min(Math.round(form.equipmentAge * 7), 95)

  const safetyRiskScore = Math.min(
    Math.round(form.equipmentAge * 5.5 + form.defectRate * 3),
    92,
  )

  let statusLabel = "API 분석 완료"
  let description = "백엔드 ROI API 응답값을 바탕으로 투자 판단 결과를 갱신했습니다."

  if (roi >= 45 && paybackMonths <= 18) {
    statusLabel = "투자 적합"
    description = `${
      bestScenario.label || "선택된 투자안"
    } 기준으로 ROI가 높고 회수기간이 짧아 지원사업과 함께 검토하기 좋은 상태입니다.`
  } else if (roi >= 25) {
    statusLabel = "조건부 적합"
    description = `${
      bestScenario.label || "선택된 투자안"
    } 기준으로 ROI는 양호하지만 지원금 확정 여부와 실제 절감액을 추가 확인하는 것이 좋습니다.`
  } else {
    statusLabel = "재검토 필요"
    description = `${
      bestScenario.label || "선택된 투자안"
    } 기준으로는 회수기간이 길 수 있어 투자금, 지원금, 절감액을 다시 검토해야 합니다.`
  }

  return {
    roi,
    paybackMonths,
    actualCost,
    supportFitScore,
    savingEffectScore,
    agingScore,
    safetyRiskScore,
    statusLabel,
    description,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "백엔드 서버에 연결할 수 없습니다. FastAPI 서버가 켜져 있는지 확인해주세요."
    }

    if (error.message.includes("400")) {
      return "입력값을 확인해주세요. 현재 설비 카테고리가 백엔드에서 지원되지 않을 수 있습니다."
    }

    if (error.message.includes("500")) {
      return "백엔드 내부 오류가 발생했습니다. 터미널 로그를 확인해주세요."
    }

    return error.message
  }

  return "알 수 없는 오류가 발생했습니다."
}

export default function RoiPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState<RoiForm>(initialForm)
  const [result, setResult] = useState<RoiResult>(() =>
    calculateRoi(initialForm),
  )
  const [nextActionOpen, setNextActionOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const updateForm = (key: keyof RoiForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        key === "equipmentName" || key === "industry" ? value : Number(value),
    }))
  }

  const handleCalculate = async () => {
    setApiStatus("loading")
    setErrorMessage("")

    try {
      const payload = buildRoiPayload(form)
      const apiResponse = await simulateRoi(payload)
      const apiData = normalizeRoiApiData(apiResponse)

      if (!apiData) {
        setApiStatus("empty")
        setResult(calculateRoi(form))
        return
      }

      const nextResult = mapApiResultToRoiResult(form, apiData)

      if (!nextResult) {
        setApiStatus("empty")
        setResult(calculateRoi(form))
        return
      }

      setResult(nextResult)
      setApiStatus("success")
    } catch (error) {
      setResult(calculateRoi(form))
      setApiStatus("error")
      setErrorMessage(getErrorMessage(error))
    }
  }

  const handleReset = () => {
    setForm(initialForm)
    setResult(calculateRoi(initialForm))
    setNextActionOpen(false)
    setApiStatus("idle")
    setErrorMessage("")
  }

  const maxOldCost = 100

  const electricityOld = 82

  const electricityNew = Math.max(
    32,
    Math.round(82 - result.savingEffectScore * 0.32),
  )

  const defectOld = Math.min(90, Math.round(form.defectRate * 12))
  const defectNew = Math.max(18, Math.round(defectOld * 0.48))

  const maintenanceOld = Math.min(
    95,
    Math.round(form.maintenanceCost * 150 + form.equipmentAge * 2),
  )

  const maintenanceNew = Math.max(24, Math.round(maintenanceOld * 0.52))

  return (
    <main className="page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              marginBottom: "28px",
              height: "44px",
              padding: "0 18px",
              borderRadius: "999px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#061B34",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(6,27,52,.06)",
            }}
          >
            ← 대시보드로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT ROI SIMULATION</div>

              <div className="label">ROI ANALYSIS</div>

              <h2>
                설비투자 전, <br />
                회수기간과 실부담금을 먼저 계산합니다.
              </h2>
            </div>

            <p className="section-desc">
              투자금, 예상 지원금, 절감액, 불량률 개선 효과를 바탕으로 AI가
              설비 교체 의사결정을 도와줍니다.
            </p>
          </div>

          <div className="diagnosis-card-v2" style={{ marginBottom: "28px" }}>
            <div className="diagnosis-step">
              <div className="diagnosis-step-aside">
                <small>STEP 01</small>

                <h3>ROI 입력값</h3>

                <p>
                  설비 정보와 투자금, 예상 지원금, 연간 절감액을 입력하면 투자
                  회수기간과 ROI를 즉시 계산합니다.
                </p>
              </div>

              <div className="diagnosis-step-body">
                <div className="diagnosis-form-grid">
                  <div className="diagnosis-field">
                    <label>설비명</label>

                    <input
                      value={form.equipmentName}
                      onChange={(event) =>
                        updateForm("equipmentName", event.target.value)
                      }
                    />
                  </div>

                  <div className="diagnosis-field">
                    <label>업종</label>

                    <input
                      value={form.industry}
                      onChange={(event) =>
                        updateForm("industry", event.target.value)
                      }
                    />
                  </div>

                  <div className="diagnosis-field">
                    <label>설비 사용연수</label>

                    <input
                      type="number"
                      value={form.equipmentAge}
                      onChange={(event) =>
                        updateForm("equipmentAge", event.target.value)
                      }
                    />
                  </div>

                  <div className="diagnosis-field">
                    <label>현재 불량률 (%)</label>

                    <input
                      type="number"
                      step="0.1"
                      value={form.defectRate}
                      onChange={(event) =>
                        updateForm("defectRate", event.target.value)
                      }
                    />
                  </div>

                  <div className="diagnosis-field">
                    <label>총 투자금 (억원)</label>

                    <input
                      type="number"
                      step="0.1"
                      value={form.totalInvestment}
                      onChange={(event) =>
                        updateForm("totalInvestment", event.target.value)
                      }
                    />
                  </div>

                  <div className="diagnosis-field">
                    <label>예상 지원금 (억원)</label>

                    <input
                      type="number"
                      step="0.1"
                      value={form.expectedSupport}
                      onChange={(event) =>
                        updateForm("expectedSupport", event.target.value)
                      }
                    />
                  </div>

                  <div className="diagnosis-field">
                    <label>연간 절감액 (억원)</label>

                    <input
                      type="number"
                      step="0.1"
                      value={form.annualSaving}
                      onChange={(event) =>
                        updateForm("annualSaving", event.target.value)
                      }
                    />
                  </div>

                  <div className="diagnosis-field">
                    <label>연간 유지보수비 (억원)</label>

                    <input
                      type="number"
                      step="0.1"
                      value={form.maintenanceCost}
                      onChange={(event) =>
                        updateForm("maintenanceCost", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="diagnosis-ready" style={{ marginTop: "24px" }}>
                  <div>
                    <h3>입력값 기준으로 ROI를 다시 계산합니다.</h3>

                    <p>
                      ROI 계산하기를 누르면 백엔드{" "}
                      <b>/api/roi/simulate</b> API를 호출하고, 응답값이 있으면
                      결과 카드에 반영합니다.
                    </p>
                  </div>

                  <button
                    className="btn blue"
                    type="button"
                    onClick={handleCalculate}
                    disabled={apiStatus === "loading"}
                    style={{
                      opacity: apiStatus === "loading" ? 0.7 : 1,
                      cursor: apiStatus === "loading" ? "not-allowed" : "pointer",
                    }}
                  >
                    {apiStatus === "loading" ? "API 분석 중..." : "ROI 계산하기"}
                  </button>
                </div>

                {apiStatus !== "idle" && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "16px 18px",
                      borderRadius: "18px",
                      border:
                        apiStatus === "error"
                          ? "1px solid #FCA5A5"
                          : apiStatus === "empty"
                            ? "1px solid #FDBA74"
                            : "1px solid #BFDBFE",
                      background:
                        apiStatus === "error"
                          ? "#FEF2F2"
                          : apiStatus === "empty"
                            ? "#FFF7ED"
                            : "#EFF6FF",
                      color:
                        apiStatus === "error"
                          ? "#991B1B"
                          : apiStatus === "empty"
                            ? "#9A3412"
                            : "#1E3A8A",
                      fontSize: "14px",
                      lineHeight: 1.7,
                      fontWeight: 800,
                    }}
                  >
                    {apiStatus === "loading" && (
                      <span>
                        백엔드 ROI API를 호출하는 중입니다. Network 탭에서{" "}
                        <b>simulate</b> 요청이 표시되어야 합니다.
                      </span>
                    )}

                    {apiStatus === "success" && (
                      <span>
                        백엔드 ROI API 응답을 결과 카드에 반영했습니다. Network
                        탭에서 <b>POST /api/roi/simulate 200</b>을 확인하세요.
                      </span>
                    )}

                    {apiStatus === "empty" && (
                      <span>
                        API 응답은 도착했지만 결과 데이터가 비어 있습니다. 화면은
                        깨지지 않도록 프론트 기본 계산값을 표시합니다.
                      </span>
                    )}

                    {apiStatus === "error" && (
                      <span>
                        API 호출에 실패했습니다. {errorMessage} 현재 화면은
                        깨지지 않도록 프론트 기본 계산값을 표시합니다.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="roi-main-layout">
            <div className="roi-result-card">
              <span className="badge green">{result.statusLabel}</span>

              <h3>
                {form.equipmentName} 교체 시 <br />
                예상 ROI는 {result.roi}%입니다.
              </h3>

              <p>
                {result.description} 현재 입력값 기준 투자 회수기간은 약{" "}
                {result.paybackMonths}개월입니다.
              </p>

              <div className="roi-number-grid">
                <div className="roi-number">
                  <span>총 투자금</span>
                  <b>{formatEok(form.totalInvestment)}</b>
                </div>

                <div className="roi-number">
                  <span>예상 지원금</span>
                  <b>{formatEok(form.expectedSupport)}</b>
                </div>

                <div className="roi-number">
                  <span>실부담금</span>
                  <b>{formatEok(result.actualCost)}</b>
                </div>

                <div className="roi-number">
                  <span>회수기간</span>
                  <b>{result.paybackMonths}개월</b>
                </div>
              </div>

              <div className="hero-actions">
                <button
                  className="btn blue"
                  type="button"
                  onClick={() => navigate("/application-draft")}
                >
                  신청서 초안 생성하기
                </button>

                <button className="btn dark" type="button" onClick={handleReset}>
                  다시 계산하기
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "22px",
                alignContent: "start",
              }}
            >
              <div className="ai-reason-card">
                <h3>AI 판단 근거</h3>

                <div className="reason-row">
                  <span>지원금 적합도</span>

                  <div className="reason-track">
                    <i style={{ width: `${result.supportFitScore}%` }} />
                  </div>

                  <b>{result.supportFitScore}</b>
                </div>

                <div className="reason-row">
                  <span>비용 절감 효과</span>

                  <div className="reason-track">
                    <i style={{ width: `${result.savingEffectScore}%` }} />
                  </div>

                  <b>{result.savingEffectScore}</b>
                </div>

                <div className="reason-row">
                  <span>설비 노후도</span>

                  <div className="reason-track">
                    <i style={{ width: `${result.agingScore}%` }} />
                  </div>

                  <b>{result.agingScore}</b>
                </div>

                <div className="reason-row">
                  <span>안전 리스크</span>

                  <div className="reason-track">
                    <i style={{ width: `${result.safetyRiskScore}%` }} />
                  </div>

                  <b>{result.safetyRiskScore}</b>
                </div>
              </div>

              <div
                className="card"
                style={{
                  borderRadius: "28px",
                  padding: nextActionOpen ? "28px" : "22px 26px",
                  borderTop: "4px solid #344BA0",
                  boxShadow: "0 18px 44px rgba(6,27,52,.08)",
                  transition: "all .2s ease",
                }}
              >
                <button
                  type="button"
                  onClick={() => setNextActionOpen((prev) => !prev)}
                  style={{
                    width: "100%",
                    border: "0",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "18px",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <span className="badge blue">NEXT ACTION</span>

                    <h3
                      style={{
                        color: "#061B34",
                        fontSize: nextActionOpen ? "28px" : "24px",
                        lineHeight: 1.25,
                        fontWeight: 900,
                        letterSpacing: "-0.7px",
                        marginTop: "12px",
                      }}
                    >
                      다음 추천 액션
                    </h3>

                    {!nextActionOpen && (
                      <p
                        style={{
                          color: "#667085",
                          fontSize: "14px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                          marginTop: "10px",
                        }}
                      >
                        신청서 초안과 지원사업 상세 검토를 이어서 진행하세요.
                      </p>
                    )}
                  </div>

                  <span
                    style={{
                      minWidth: "50px",
                      height: "50px",
                      borderRadius: "16px",
                      background: "#EEF6FF",
                      color: "#344BA0",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "24px",
                      fontWeight: 900,
                      transform: nextActionOpen ? "rotate(90deg)" : "none",
                      transition: "transform .18s ease",
                    }}
                  >
                    →
                  </span>
                </button>

                {nextActionOpen && (
                  <>
                    <p
                      style={{
                        color: "#667085",
                        fontSize: "15px",
                        lineHeight: 1.8,
                        fontWeight: 800,
                        marginTop: "22px",
                        marginBottom: "22px",
                      }}
                    >
                      ROI 결과가 양호하므로 신청서 초안과 지원사업 상세 검토를
                      이어서 진행하는 것이 좋습니다.
                    </p>

                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        marginBottom: "24px",
                      }}
                    >
                      {[
                        [
                          "01",
                          "신청서 초안 생성",
                          "ROI 결과를 신청서 문장으로 정리",
                        ],
                        [
                          "02",
                          "지원사업 상세 확인",
                          "스마트공장·에너지 효율 사업 검토",
                        ],
                        [
                          "03",
                          "안전 리스크 함께 점검",
                          "노후도와 불량률 근거 보강",
                        ],
                      ].map(([step, title, desc]) => (
                        <div
                          key={step}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "42px 1fr",
                            gap: "12px",
                            alignItems: "center",
                            padding: "14px",
                            border: "1px solid #E2E8F0",
                            borderRadius: "18px",
                            background: "#F8FAFC",
                          }}
                        >
                          <span
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "#FFFFFF",
                              color: "#344BA0",
                              border: "1px solid #BFDBFE",
                              display: "grid",
                              placeItems: "center",
                              fontSize: "12px",
                              fontWeight: 900,
                            }}
                          >
                            {step}
                          </span>

                          <div>
                            <strong
                              style={{
                                display: "block",
                                color: "#061B34",
                                fontSize: "15px",
                                fontWeight: 900,
                                marginBottom: "4px",
                              }}
                            >
                              {title}
                            </strong>

                            <span
                              style={{
                                color: "#667085",
                                fontSize: "12px",
                                lineHeight: 1.5,
                                fontWeight: 800,
                              }}
                            >
                              {desc}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                      }}
                    >
                      <button
                        className="btn blue"
                        type="button"
                        onClick={() => navigate("/application-draft")}
                        style={{
                          width: "100%",
                        }}
                      >
                        신청서 생성
                      </button>

                      <button
                        className="btn dark"
                        type="button"
                        onClick={() => navigate("/support-projects")}
                        style={{
                          width: "100%",
                        }}
                      >
                        지원사업 보기
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="roi-evidence-grid">
            <div className="evidence-card">
              <div className="evidence-head">
                <h3>비용 비교</h3>
                <span>단위: 백만원</span>
              </div>

              <div className="legend-row">
                <span>
                  <i className="legend-dot a" />
                  기존 설비 유지
                </span>

                <span>
                  <i className="legend-dot b" />
                  신규 설비 교체
                </span>
              </div>

              <div className="evidence-chart">
                <div className="evidence-chart-row">
                  <strong>연간 전기요금</strong>

                  <div className="evidence-bars">
                    <div className="evidence-bar">
                      <i className="a" style={{ width: `${electricityOld}%` }}>
                        {electricityOld}
                      </i>
                    </div>

                    <div className="evidence-bar">
                      <i className="b" style={{ width: `${electricityNew}%` }}>
                        {electricityNew}
                      </i>
                    </div>
                  </div>
                </div>

                <div className="evidence-chart-row">
                  <strong>불량 손실</strong>

                  <div className="evidence-bars">
                    <div className="evidence-bar">
                      <i className="a" style={{ width: `${defectOld}%` }}>
                        {defectOld}
                      </i>
                    </div>

                    <div className="evidence-bar">
                      <i className="b" style={{ width: `${defectNew}%` }}>
                        {defectNew}
                      </i>
                    </div>
                  </div>
                </div>

                <div className="evidence-chart-row">
                  <strong>유지보수비</strong>

                  <div className="evidence-bars">
                    <div className="evidence-bar">
                      <i className="a" style={{ width: `${maintenanceOld}%` }}>
                        {maintenanceOld}
                      </i>
                    </div>

                    <div className="evidence-bar">
                      <i className="b" style={{ width: `${maintenanceNew}%` }}>
                        {maintenanceNew}
                      </i>
                    </div>
                  </div>
                </div>
              </div>

              <div className="evidence-axis">
                <span>0</span>
                <span>{Math.round(maxOldCost * 0.33)}</span>
                <span>{Math.round(maxOldCost * 0.66)}</span>
                <span>{maxOldCost}</span>
              </div>
            </div>

            <div className="evidence-card">
              <div className="evidence-head">
                <h3>벤치마크 근거</h3>
                <span>AI 분석 요약</span>
              </div>

              <div className="benchmark-table">
                <div className="benchmark-row">
                  <div>업종</div>
                  <div>{form.industry}</div>
                </div>

                <div className="benchmark-row">
                  <div>설비 유형</div>
                  <div>{form.equipmentName}</div>
                </div>

                <div className="benchmark-row">
                  <div>노후도</div>
                  <div>
                    <b>{form.equipmentAge}년</b>
                    <span className="status-chip orange">주의</span>
                  </div>
                </div>

                <div className="benchmark-row">
                  <div>불량률</div>
                  <div>
                    <b>{form.defectRate}%</b>
                    <span className="status-chip red">개선 필요</span>
                  </div>
                </div>

                <div className="benchmark-row">
                  <div>지원사업 적합도</div>
                  <div>
                    <b>{result.supportFitScore}%</b>
                    <span className="status-chip green">높음</span>
                  </div>
                </div>
              </div>

              <p className="section-desc">
                현재 설비는 에너지 비용, 유지보수비, 불량 손실 측면에서 교체
                검토 우선순위가 높습니다.
              </p>
            </div>
          </div>

          <details className="application-accordion">
            <summary>지원사업 신청서 초안 미리보기</summary>

            <div className="application-accordion-body">
              <div className="draft-preview-card">
                <div className="draft-preview-top">
                  <h4>AI 신청서 초안</h4>

                  <button
                    type="button"
                    onClick={() => navigate("/application-draft")}
                  >
                    수정하기
                  </button>
                </div>

                <div className="draft-message">
                  본 기업은 {form.equipmentName} 교체를 통해 에너지 사용량
                  절감, 불량률 개선, 생산 안정성 향상을 목표로 합니다. FactoFit
                  ROI 분석 결과, 지원금 적용 시 투자 회수기간은 약{" "}
                  {result.paybackMonths}개월로 예상됩니다.
                </div>

                <div className="draft-table">
                  <div className="draft-row">
                    <div>신청 목적</div>
                    <div>노후 설비 교체 및 에너지 효율 개선</div>
                  </div>

                  <div className="draft-row">
                    <div>주요 기대효과</div>
                    <div>전기요금 절감, 불량률 감소, 생산성 향상</div>
                  </div>

                  <div className="draft-row">
                    <div>추천 지원사업</div>
                    <div>스마트공장 고도화 / 에너지 효율 개선 지원사업</div>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </section>
    </main>
  )
}