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

  const policies = useMemo(
    () => {
      const policyRows = Array.isArray(data.policies) ? data.policies : []
      return policyRows
        .slice(0, 5)
        .map((policy) => {
          const row = asRecord(policy)
          return {
            policyId: readText(row.policy_id),
            title: readText(row.title) || "정책명 미확인",
            deadline: readText(row.deadline) || "마감일 미정",
            compatible: row.compatible !== false,
            incompatibilityReason: readText(row.incompatibility_reason),
          }
        })
        .filter((item) => Boolean(item.policyId))
    },
    [data.policies],
  )

  const [policyId, setPolicyId] = useState(() => {
    const selected = policies.find((policy) => policy.policyId === selectedPolicyId)
    if (selected?.compatible) return selected.policyId
    return policies.find((policy) => policy.compatible)?.policyId || ""
  })
  const [mustIncludeText, setMustIncludeText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState("")
  const [submitError, setSubmitError] = useState("")

  const selectedPolicy = policies.find((policy) => policy.policyId === policyId)
  const canSubmit =
    Boolean(policyId) &&
    selectedPolicy?.compatible === true &&
    Boolean(onApplyDraftRequirements) &&
    !isSubmitting

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
                <option
                  key={policy.policyId}
                  value={policy.policyId}
                  disabled={!policy.compatible}
                >
                  {policy.title} ({policy.deadline})
                  {!policy.compatible ? " - 선택 불가" : ""}
                </option>
              ))}
            </select>
          </label>

          {!policies.some((policy) => policy.compatible) ? (
            <div className="ff-advisor-draft-error" role="alert">
              <strong>현재 선택 가능한 정책이 없습니다.</strong>
              <p>
                기업 소재지와 설비 투자 목적에 맞는 정책으로 다시 분석해 주세요.
              </p>
              {policies[0]?.incompatibilityReason ? (
                <p>{policies[0].incompatibilityReason}</p>
              ) : null}
            </div>
          ) : null}

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
          {submitError ? (
            <div className="ff-advisor-draft-error" role="alert">
              <strong>신청서 초안을 반영하지 못했습니다.</strong>
              <p>{submitError}</p>
            </div>
          ) : null}
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

        if (type === "safety_status") {
          const summary = asRecord(data.summary)
          const rows = Array.isArray(data.rows) ? data.rows : []
          const total = readNumber(summary.total) ?? rows.length
          const needImprovement = readNumber(summary.need_improvement) ?? 0
          const missingEvidence = readNumber(summary.missing_evidence) ?? 0

          if (total <= 0) {
            return (
              <article key={`${type}-${index}`} className="ff-advisor-result-card is-warning">
                <strong>안전점검 현황</strong>
                <p>
                  현재 분석 기준 안전점검 항목이 아직 생성되지 않았습니다. 안전 프리뷰를
                  먼저 생성하거나 점검 항목을 등록해 주세요.
                </p>
              </article>
            )
          }

          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>안전점검 현황</strong>
              <div className="ff-advisor-safety-metrics">
                <MetricRow label="총 점검 항목" value={`${total}건`} />
                <MetricRow label="개선 필요" value={`${needImprovement}건`} />
                <MetricRow label="증빙 미보유" value={`${missingEvidence}건`} />
              </div>
              <ul className="ff-advisor-safety-list">
                {rows.slice(0, 8).map((row, rowIndex) => {
                  const item = asRecord(row)
                  const label = readText(item.viewpoint_label) || `점검 항목 ${rowIndex + 1}`
                  const currentStatus = readText(item.current_status) || "상태 미기재"
                  const evidenceStatus = readText(item.evidence_status) || "증빙 상태 미기재"
                  const description = readText(item.description)
                  const needsAttention =
                    currentStatus.includes("개선") || evidenceStatus === "미보유"
                  return (
                    <li
                      key={`${label}-${rowIndex}`}
                      className={needsAttention ? "is-attention" : undefined}
                    >
                      <strong>{label}</strong>
                      <span>
                        {currentStatus} · {evidenceStatus}
                      </span>
                      {description ? <p>{description}</p> : null}
                    </li>
                  )
                })}
              </ul>
              {rows.length > 8 ? (
                <p className="ff-advisor-card-footnote">
                  외 {rows.length - 8}건은 안전점검 메뉴에서 확인할 수 있습니다.
                </p>
              ) : null}
            </article>
          )
        }

        if (type === "safety_check_summary") {
          const hasSafetyStatusCard = cards.some(
            (item) => String(asRecord(item).type || "") === "safety_status",
          )
          if (hasSafetyStatusCard) return null

          const total = readNumber(data.total)
          const needImprovement = readNumber(data.need_improvement)
          const missingEvidence = readNumber(data.missing_evidence)
          if (total === null) return null

          return (
            <article key={`${type}-${index}`} className="ff-advisor-result-card">
              <strong>안전점검 요약</strong>
              <div className="ff-advisor-safety-metrics">
                <MetricRow label="총 점검 항목" value={`${total}건`} />
                <MetricRow
                  label="개선 필요"
                  value={needImprovement === null ? "-" : `${needImprovement}건`}
                />
                <MetricRow
                  label="증빙 미보유"
                  value={missingEvidence === null ? "-" : `${missingEvidence}건`}
                />
              </div>
            </article>
          )
        }

        return null
      })}
    </div>
  )
}
