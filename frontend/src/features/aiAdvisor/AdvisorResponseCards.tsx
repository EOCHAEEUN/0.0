import { useMemo, useState } from "react"

type AdvisorResponseCardsProps = {
  cards: unknown[]
  analysisId?: string
  inPopup?: boolean
  onApplyDraftRequirements?: (params: {
    analysisId?: string
    policyId?: string
    mustIncludeText?: string
  }) => Promise<void>
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

function readText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
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

function DraftStatusCard({
  data,
  analysisId,
  onApplyDraftRequirements,
}: {
  data: Record<string, unknown>
  analysisId?: string
  onApplyDraftRequirements?: (params: {
    analysisId?: string
    policyId?: string
    mustIncludeText?: string
  }) => Promise<void>
}) {
  const status = String(data.status || "")
  const cardAnalysisId = readText(data.analysis_id, analysisId)
  const selectedPolicyId = readText(data.policy_id)
  const policyRows = Array.isArray(data.policies) ? data.policies : []

  const policies = useMemo(
    () =>
      policyRows
        .slice(0, 5)
        .map((policy) => {
          const row = asRecord(policy)
          return {
            policyId: readText(row.policy_id),
            title: readText(row.title) || "정책명 미확인",
            deadline: readText(row.deadline) || "마감일 미정",
          }
        })
        .filter((item) => Boolean(item.policyId)),
    [policyRows],
  )

  const [policyId, setPolicyId] = useState(
    () => selectedPolicyId || policies[0]?.policyId || "",
  )
  const [mustIncludeText, setMustIncludeText] = useState(() =>
    readText(data.additional_info),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState("")
  const [submitError, setSubmitError] = useState("")

  const canSubmit = Boolean(policyId) && Boolean(onApplyDraftRequirements) && !isSubmitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitError("")
    setSubmitMessage("")
    setIsSubmitting(true)
    try {
      await onApplyDraftRequirements?.({
        analysisId: cardAnalysisId || undefined,
        policyId,
        mustIncludeText: mustIncludeText.trim() || undefined,
      })
      setSubmitMessage("요청 내용을 반영해 신청서 초안을 업데이트했습니다.")
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "초안 반영에 실패했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <article className="ff-advisor-result-card">
      <strong>신청서 초안 상태</strong>
      <p>
        {status === "ready"
          ? "현재 초안이 있습니다. 정책과 추가 요청을 입력해 다시 반영할 수 있습니다."
          : "초안이 아직 없습니다. 정책을 선택하고 요청사항을 입력하면 초안을 생성합니다."}
      </p>
      {readText(data.additional_info) ? (
        <p className="ff-advisor-card-footnote">
          최근 반영 요청: {readText(data.additional_info)}
        </p>
      ) : null}

      {policies.length > 0 ? (
        <div className="ff-advisor-draft-form">
          <label className="ff-advisor-draft-field">
            <span>정책 선택</span>
            <select
              value={policyId}
              onChange={(event) => setPolicyId(event.target.value)}
              disabled={isSubmitting}
            >
              {policies.map((policy) => (
                <option key={policy.policyId} value={policy.policyId}>
                  {policy.title} ({policy.deadline})
                </option>
              ))}
            </select>
          </label>

          <label className="ff-advisor-draft-field">
            <span>초안에 꼭 넣고 싶은 내용</span>
            <textarea
              rows={4}
              placeholder="예: 우리 회사는 로봇공정 전환으로 안전사고 감소 효과를 강조해 주세요."
              value={mustIncludeText}
              onChange={(event) => setMustIncludeText(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <button
            type="button"
            className="ff-advisor-text-btn"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? "반영 중..." : "신청서 초안 반영"}
          </button>

          {submitMessage ? <p className="ff-advisor-card-footnote">{submitMessage}</p> : null}
          {submitError ? <p className="ff-advisor-card-footnote">{submitError}</p> : null}
        </div>
      ) : (
        <p className="ff-advisor-card-footnote">
          현재 분석에서 선택 가능한 정책을 찾지 못했습니다.
        </p>
      )}
    </article>
  )
}

export default function AdvisorResponseCards({
  cards,
  analysisId,
  inPopup = false,
  onApplyDraftRequirements,
}: AdvisorResponseCardsProps) {
  if (!cards.length) return null

  return (
    <div className="ff-advisor-response-cards">
      {cards.map((item, index) => {
        const card = asRecord(item)
        const type = String(card.type || "")
        const data = asRecord(card.data)

        if (type === "roi_snapshot") {
          const recommended = String(data.recommended || "A").toUpperCase()
          const scenario =
            recommended === "B" ? asRecord(data.scenario_b) : asRecord(data.scenario_a)
          const title = recommended === "A" ? "A안 (전체 교체)" : "B안 (부분 교체)"
          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>ROI 상세</strong>
              <div className="ff-advisor-card-detail">
                <h4>{title}</h4>
                <MetricRow label="투자금" value={formatManwon(scenario.investment)} />
                <MetricRow label="적용 가능 지원금" value={formatManwon(scenario.support)} />
                <MetricRow label="실부담금" value={formatManwon(scenario.net_investment)} />
                <MetricRow label="연간 순편익" value={formatManwon(scenario.annual_benefit)} />
                <MetricRow label="ROI" value={formatPct(scenario.roi_pct)} />
                <MetricRow label="회수기간" value={formatYears(scenario.payback_years)} />
              </div>
              <p className="ff-advisor-card-footnote">추천 시나리오: {recommended}안</p>
            </article>
          )
        }

        if (type === "roi_compare") {
          const scenarioA = asRecord(data.scenario_a)
          const scenarioB = asRecord(data.scenario_b)
          const recommended = String(data.recommended || "A")
          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>A/B 투자안 비교</strong>
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
              <p>
                {inPopup
                  ? "이 분석은 정책 이력 저장 전 생성되었습니다. 팝업 상단에서 다른 분석을 선택하거나 매칭 지원사업을 다시 요청해 주세요."
                  : "이 분석은 정책 이력 저장 전 생성되었습니다. 재분석 또는 최신 지원사업 보기를 이용해 주세요."}
              </p>
            </article>
          )
        }

        if (type === "application_draft_status") {
          return (
            <DraftStatusCard
              key={`${type}-${index}`}
              data={data}
              analysisId={analysisId}
              onApplyDraftRequirements={onApplyDraftRequirements}
            />
          )
        }

        if (type === "safety_check_summary" || type === "safety_status") {
          const summary = asRecord(data.summary)
          const total = readNumber(data.total) ?? readNumber(summary.total)
          return total !== null ? (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>안전점검</strong>
              <p className="ff-advisor-card-footnote">
                등록된 안전점검 항목 {total.toLocaleString("ko-KR")}건
              </p>
            </article>
          ) : null
        }

        return null
      })}
    </div>
  )
}
