import { useNavigate } from "react-router-dom"

type AdvisorResponseCardsProps = {
  cards: unknown[]
  analysisId?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ff-advisor-card-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatManwon(value: unknown) {
  const number = readNumber(value)
  if (number === null) return "-"
  return `${number.toLocaleString("ko-KR")}만원`
}

function formatPct(value: unknown) {
  const number = readNumber(value)
  return number === null ? "-" : `${number.toFixed(1)}%`
}

function formatYears(value: unknown) {
  const number = readNumber(value)
  return number === null ? "-" : `${number.toFixed(2)}년`
}

export default function AdvisorResponseCards({ cards, analysisId }: AdvisorResponseCardsProps) {
  const navigate = useNavigate()
  if (!cards.length) return null

  return (
    <div className="ff-advisor-response-cards">
      {cards.map((item, index) => {
        const card = asRecord(item)
        const type = String(card.type || "")
        const data = asRecord(card.data)

        if (type === "roi_snapshot" || type === "roi_compare") {
          const scenarioA = asRecord(data.scenario_a)
          const scenarioB = asRecord(data.scenario_b)
          const recommended = String(data.recommended || "A")
          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>{type === "roi_compare" ? "A/B 투자안 비교" : "ROI 상세"}</strong>
              <div className="ff-advisor-card-grid">
                <div>
                  <h4>A안 (전체 교체)</h4>
                  <MetricRow
                    label="투자금"
                    value={`${(readNumber(scenarioA.investment) ?? 0).toLocaleString("ko-KR")}만원`}
                  />
                  <MetricRow
                    label="ROI"
                    value={`${readNumber(scenarioA.roi_pct)?.toFixed(1) ?? "-"}%`}
                  />
                  <MetricRow
                    label="회수기간"
                    value={`${readNumber(scenarioA.payback_years)?.toFixed(2) ?? "-"}년`}
                  />
                </div>
                <div>
                  <h4>B안 (부분 교체)</h4>
                  <MetricRow
                    label="투자금"
                    value={`${(readNumber(scenarioB.investment) ?? 0).toLocaleString("ko-KR")}만원`}
                  />
                  <MetricRow
                    label="ROI"
                    value={`${readNumber(scenarioB.roi_pct)?.toFixed(1) ?? "-"}%`}
                  />
                  <MetricRow
                    label="회수기간"
                    value={`${readNumber(scenarioB.payback_years)?.toFixed(2) ?? "-"}년`}
                  />
                </div>
              </div>
              <p className="ff-advisor-card-footnote">추천 시나리오: {recommended}안</p>
            </article>
          )
        }

        if (type === "roi_simulation") {
          const baseline = asRecord(data.baseline)
          const baselineA = asRecord(baseline.scenario_a)
          const baselineB = asRecord(baseline.scenario_b)
          const simulated = asRecord(data.simulated)
          const simulatedA = asRecord(simulated.scenario_a)
          const simulatedB = asRecord(simulated.scenario_b)
          const recommended = String(simulated.recommended || "-").toUpperCase()
          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card is-simulation">
              <strong>임시 시뮬레이션 결과</strong>
              <div className="ff-advisor-card-grid">
                <div>
                  <h4>A안 (전체 교체)</h4>
                  <MetricRow label="기존 투자금" value={formatManwon(baselineA.investment)} />
                  <MetricRow label="변경 투자금" value={formatManwon(simulatedA.investment_manwon)} />
                  <MetricRow label="ROI" value={formatPct(simulatedA.roi_pct)} />
                  <MetricRow label="회수기간" value={formatYears(simulatedA.payback_years)} />
                </div>
                <div>
                  <h4>B안 (부분 교체)</h4>
                  <MetricRow label="기존 투자금" value={formatManwon(baselineB.investment)} />
                  <MetricRow label="변경 투자금" value={formatManwon(simulatedB.investment_manwon)} />
                  <MetricRow label="ROI" value={formatPct(simulatedB.roi_pct)} />
                  <MetricRow label="회수기간" value={formatYears(simulatedB.payback_years)} />
                </div>
              </div>
              <p className="ff-advisor-card-footnote">
                추천 시나리오: {recommended}안 · 기존 분석값은 변경되지 않았습니다.
              </p>
            </article>
          )
        }

        if (type === "policy_snapshot_cards") {
          const policies = Array.isArray(card.data) ? card.data : []
          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>매칭 지원사업</strong>
              <ul className="ff-advisor-policy-list">
                {policies.slice(0, 5).map((policy, policyIndex) => {
                  const row = asRecord(policy)
                  const deadline = String(row.deadline_display || row.deadline || "마감일 미정")
                  const support = String(
                    row.max_amount_actual ||
                      (readNumber(row.max_amount_numeric_manwon) ?? 0).toLocaleString("ko-KR") + "만원",
                  )
                  return (
                    <li key={policyIndex}>
                      <strong>{String(row.title || "정책명 미확인")}</strong>
                      <span>{support} · {deadline}</span>
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        }

        if (type === "legacy_policy_snapshot_missing") {
          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card is-warning">
              <strong>정책 snapshot 없음</strong>
              <p>이 분석은 정책 이력 저장 전 생성되었습니다. 재분석 또는 최신 지원사업 보기를 이용해 주세요.</p>
              <div className="ff-advisor-card-actions">
                <button type="button" className="ff-support-btn ghost" onClick={() => navigate("/analysis/new")}>
                  재분석
                </button>
                <button type="button" className="btn blue" onClick={() => navigate("/support-projects")}>
                  최신 지원사업
                </button>
              </div>
            </article>
          )
        }

        if (type === "application_draft_status") {
          const status = String(data.status || "")
          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>신청서 초안 상태</strong>
              <p>
                {status === "ready"
                  ? "초안이 준비되어 있습니다. 신청서 탭에서 확인하세요."
                  : "초안이 아직 없습니다. 신청서 탭에서 생성해 주세요."}
              </p>
              {analysisId && (
                <button
                  type="button"
                  className="btn blue"
                  onClick={() =>
                    navigate(`/application-draft?analysisId=${encodeURIComponent(analysisId)}`)
                  }
                >
                  신청서 탭 열기
                </button>
              )}
            </article>
          )
        }

        return null
      })}
    </div>
  )
}
