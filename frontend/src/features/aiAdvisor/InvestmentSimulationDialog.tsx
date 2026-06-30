import { useEffect, useState } from "react"

type InvestmentSimulationDialogProps = {
  open: boolean
  scenarioAInvestment: number | null
  scenarioBInvestment: number | null
  loading?: boolean
  onClose: () => void
  onSubmit: (input: {
    scenario_a_investment_manwon?: number
    scenario_b_investment_manwon?: number
  }) => void
}

function formatManwon(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-"
  return `${value.toLocaleString("ko-KR")}만원`
}

function parseManwonInput(value: string) {
  const digits = value.replace(/[^\d]/g, "")
  if (!digits) return undefined
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatInputValue(value: string) {
  const parsed = parseManwonInput(value)
  if (parsed === undefined) return ""
  return parsed.toLocaleString("ko-KR")
}

export default function InvestmentSimulationDialog({
  open,
  scenarioAInvestment,
  scenarioBInvestment,
  loading = false,
  onClose,
  onSubmit,
}: InvestmentSimulationDialogProps) {
  const [scenarioA, setScenarioA] = useState("")
  const [scenarioB, setScenarioB] = useState("")

  useEffect(() => {
    if (!open) return
    setScenarioA(
      scenarioAInvestment !== null && Number.isFinite(scenarioAInvestment)
        ? scenarioAInvestment.toLocaleString("ko-KR")
        : "",
    )
    setScenarioB(
      scenarioBInvestment !== null && Number.isFinite(scenarioBInvestment)
        ? scenarioBInvestment.toLocaleString("ko-KR")
        : "",
    )
  }, [open, scenarioAInvestment, scenarioBInvestment])

  if (!open) return null

  const handleSubmit = () => {
    const scenario_a_investment_manwon = parseManwonInput(scenarioA)
    const scenario_b_investment_manwon = parseManwonInput(scenarioB)
    if (scenario_a_investment_manwon === undefined && scenario_b_investment_manwon === undefined) {
      return
    }
    onSubmit({
      ...(scenario_a_investment_manwon !== undefined
        ? { scenario_a_investment_manwon }
        : {}),
      ...(scenario_b_investment_manwon !== undefined
        ? { scenario_b_investment_manwon }
        : {}),
    })
  }

  return (
    <section className="ff-advisor-simulation-shell" aria-label="투자금 변경 시뮬레이션">
      <div className="ff-advisor-simulation-panel">
        <header className="ff-advisor-simulation-header">
          <h3>투자금 변경 시뮬레이션</h3>
          <button type="button" onClick={onClose} aria-label="닫기" disabled={loading}>
            ×
          </button>
        </header>
        <div className="ff-advisor-simulation-body">
          <p className="ff-advisor-simulation-note">
            이 결과는 임시 시뮬레이션이며 기존 분석 결과는 변경되지 않습니다.
          </p>
          <div className="ff-advisor-simulation-field">
            <label htmlFor="sim-scenario-a">전체 교체 투자금 (A안, 만원)</label>
            <span className="ff-advisor-simulation-current">
              현재 저장값: {formatManwon(scenarioAInvestment)}
            </span>
            <input
              id="sim-scenario-a"
              inputMode="numeric"
              value={scenarioA}
              onChange={(event) => setScenarioA(formatInputValue(event.target.value))}
              placeholder="변경할 A안 투자금"
              disabled={loading}
            />
          </div>
          <div className="ff-advisor-simulation-field">
            <label htmlFor="sim-scenario-b">부분 교체 투자금 (B안, 만원)</label>
            <span className="ff-advisor-simulation-current">
              현재 저장값: {formatManwon(scenarioBInvestment)}
            </span>
            <input
              id="sim-scenario-b"
              inputMode="numeric"
              value={scenarioB}
              onChange={(event) => setScenarioB(formatInputValue(event.target.value))}
              placeholder="변경할 B안 투자금"
              disabled={loading}
            />
          </div>
        </div>
        <footer className="ff-advisor-simulation-footer">
          <button type="button" className="ff-support-btn ghost" onClick={onClose} disabled={loading}>
            취소
          </button>
          <button type="button" className="btn blue" onClick={handleSubmit} disabled={loading}>
            {loading ? "시뮬레이션 중…" : "시뮬레이션 실행"}
          </button>
        </footer>
      </div>
    </section>
  )
}
