import { useState } from "react"
import { useNavigate } from "react-router-dom"

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
    Math.round((actualCost / form.annualSaving) * 12),
    1,
  )

  const supportFitScore = Math.min(
    Math.round((form.expectedSupport / form.totalInvestment) * 220),
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

export default function RoiPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState<RoiForm>(initialForm)
  const [result, setResult] = useState<RoiResult>(() =>
    calculateRoi(initialForm),
  )
  const [nextActionOpen, setNextActionOpen] = useState(false)

  const updateForm = (key: keyof RoiForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]:
        key === "equipmentName" || key === "industry" ? value : Number(value),
    }))
  }

  const handleCalculate = () => {
    const nextResult = calculateRoi(form)
    setResult(nextResult)
  }

  const handleReset = () => {
    setForm(initialForm)
    setResult(calculateRoi(initialForm))
    setNextActionOpen(false)
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
                      지금은 프론트엔드 내부 계산식으로 결과를 갱신하고, 이후
                      `/api/roi/simulate` 응답값과 연결하면 됩니다.
                    </p>
                  </div>

                  <button
                    className="btn blue"
                    type="button"
                    onClick={handleCalculate}
                  >
                    ROI 계산하기
                  </button>
                </div>
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