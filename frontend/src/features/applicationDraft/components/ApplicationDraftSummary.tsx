import { Clock3, Pencil, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import {
  formatCurrencyWonFromManwon,
  formatPaybackFromScenario,
  formatPaybackYearsCompact,
  readAnalysisData,
} from "../applicationDraft.utils"
import type { MatchedPolicy } from "../applicationDraft.contract"
import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { ApplicationDraftRecommendedPolicies } from "./ApplicationDraftRecommendedPolicies"
import { ScenarioToggle } from "./ApplicationDraftShared"

type EffectItem = {
  label: string
  body: string
}

function parseEffectItem(item: string): EffectItem {
  const colonIndex = item.indexOf(":")
  if (colonIndex > 0) {
    return {
      label: item.slice(0, colonIndex).trim(),
      body: item.slice(colonIndex + 1).trim(),
    }
  }

  return { label: item.trim(), body: "" }
}

function buildRoiSummary(model: ApplicationDraftWorkspaceModel) {
  const scenario = model.activeScenario
  const payback = formatPaybackYearsCompact({
    payback_months: scenario?.payback_months,
    payback_years: scenario?.payback_years,
  })

  if (payback === "-") {
    return "ROI 분석 결과를 기반으로 투자 타당성을 검토했습니다. 시나리오를 확정하면 회수기간과 순편익 요약이 반영됩니다."
  }

  const scenarioLabel = model.scenarioKey === "A" ? "전체교체" : "부분교체"
  return `ROI 분석 결과, ${scenarioLabel} 시나리오 기준 예상 회수기간은 ${payback}이며, 에너지·유지보수·품질 개선 효과를 종합한 투자 타당성이 확인되었습니다.`
}

function buildEffectItems(model: ApplicationDraftWorkspaceModel): EffectItem[] {
  const benefits = model.data?.draft.content?.expected_benefits
  if (Array.isArray(benefits) && benefits.length > 0) {
    return benefits.map((item) => parseEffectItem(String(item)))
  }

  const effects = model.data?.draft.content?.expected_effects
  if (typeof effects === "string" && effects.trim()) {
    return effects
      .split(/[\n;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(parseEffectItem)
  }

  return [
    {
      label: "생산성 향상",
      body: "IoT 기반 모니터링으로 가동 속도를 25% 높이고 공정 안정성을 확보합니다.",
    },
    {
      label: "에너지 효율",
      body: "고효율 서보 모터 도입으로 전력 소비를 30% 절감합니다.",
    },
    {
      label: "품질 고도화",
      body: "정밀 압력 제어 알고리즘으로 불량률을 낮추고 품질 경쟁력을 강화합니다.",
    },
  ]
}

function buildNecessityText(model: ApplicationDraftWorkspaceModel) {
  const content = model.data?.draft.content
  const equipmentName = model.data?.equipment?.name?.trim()
  const base =
    (typeof content?.business_necessity === "string" && content.business_necessity) ||
    model.summaryText.split("\n\n")[0] ||
    ""

  if (base) return base

  if (equipmentName) {
    return `현재 보유 중인 ${equipmentName}의 노후화로 인해 에너지 비용, 유지보수 부담, 품질 손실 문제가 발생하고 있어 지능형 자동화 설비 도입이 필요합니다.`
  }

  return "현재 설비의 노후화로 인해 에너지 비용, 유지보수 부담, 품질 손실 문제가 발생하고 있어 지능형 자동화 설비 도입이 필요합니다."
}

type DraftPolicyOption = {
  policyId: string
  title: string
  subtitle: string
  isCurrent: boolean
}

function policyTitle(policy: MatchedPolicy) {
  return String(policy.title || policy.policy_title || "지원사업").trim()
}

function policySubtitle(policy: MatchedPolicy) {
  const metadata = policy.metadata as Record<string, unknown> | undefined
  const ratio =
    metadata?.support_ratio ||
    metadata?.subsidy_rate ||
    metadata?.max_support_ratio

  if (ratio) {
    const text = String(ratio).includes("%") ? String(ratio) : `최대 ${ratio}%`
    return `지원 비율: ${text}`
  }

  if (policy.max_amount_manwon) {
    return `지원 한도: ${Math.round(Number(policy.max_amount_manwon)).toLocaleString()}만원`
  }

  if (policy.agency || policy.organization) {
    return String(policy.agency || policy.organization)
  }

  return "지원 조건은 공고 원문을 확인해 주세요."
}

export function ApplicationDraftSummary({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const policyLegacy = model.data?.policy?.legacy_missing
  const scenario = model.activeScenario
  const netInvestment =
    scenario?.net_investment_manwon ??
    (scenario?.investment_manwon != null && scenario?.subsidy_manwon != null
      ? Math.max(0, Number(scenario.investment_manwon) - Number(scenario.subsidy_manwon))
      : null)

  const necessityText = buildNecessityText(model)
  const effectItems = buildEffectItems(model)
  const roiSummary = buildRoiSummary(model)
  const paybackCompact = formatPaybackYearsCompact({
    payback_months: scenario?.payback_months,
    payback_years: scenario?.payback_years,
  })
  const paybackFallback = formatPaybackFromScenario({
    payback_months: scenario?.payback_months,
    payback_years: scenario?.payback_years,
  })
  const [policyPickerOpen, setPolicyPickerOpen] = useState(false)
  const [policyChangeError, setPolicyChangeError] = useState("")
  const [pendingPolicyId, setPendingPolicyId] = useState("")

  const policyOptions = useMemo(() => {
    const currentPolicyId = String(model.data?.policy_id || "").trim()
    const currentTitle = String(model.data?.policy?.title || "").trim()
    const fromWorkspace = Array.isArray(model.data?.policy?.options)
      ? model.data.policy.options
      : []
    const deduped = new Map<string, DraftPolicyOption>()

    fromWorkspace.forEach((policy) => {
      const id = String(policy.policy_id || "").trim()
      if (!id || deduped.has(id)) return
      const deadline = String(policy.deadline || "").trim()
      deduped.set(id, {
        policyId: id,
        title: String(policy.title || "정책명 미확인").trim(),
        subtitle: deadline ? `마감일: ${deadline}` : "마감일 미정",
        isCurrent: id === currentPolicyId,
      })
    })

    if (deduped.size >= 5) {
      return Array.from(deduped.values()).slice(0, 5)
    }

    const matched = readAnalysisData().matched_policies ?? []

    matched.forEach((policy) => {
      const id = String(policy.policy_id || policy.id || "").trim()
      if (!id || deduped.has(id)) return
      deduped.set(id, {
        policyId: id,
        title: policyTitle(policy),
        subtitle: policySubtitle(policy),
        isCurrent: id === currentPolicyId,
      })
    })

    if (currentPolicyId && !deduped.has(currentPolicyId)) {
      deduped.set(currentPolicyId, {
        policyId: currentPolicyId,
        title: currentTitle || "현재 선택 정책",
        subtitle: "현재 신청서에 반영된 정책입니다.",
        isCurrent: true,
      })
    }

    return Array.from(deduped.values()).slice(0, 5)
  }, [model.data?.policy?.options, model.data?.policy?.title, model.data?.policy_id])

  const handlePolicyChange = async (policyId: string) => {
    if (!policyId || model.isGeneratingDraft) return
    if (policyId === model.data?.policy_id) {
      setPolicyPickerOpen(false)
      return
    }

    setPolicyChangeError("")
    setPendingPolicyId(policyId)
    try {
      await model.applyPolicyAndRegenerate(policyId)
      setPolicyPickerOpen(false)
    } catch (error) {
      setPolicyChangeError(
        error instanceof Error ? error.message : "지원사업 변경 반영에 실패했습니다.",
      )
    } finally {
      setPendingPolicyId("")
    }
  }

  return (
    <section className="ff-draft-summary-section">
      <article className="ff-card ff-draft-executive-card">
        <div className="ff-draft-executive-head">
          <h3>
            핵심 요약 <span className="ff-draft-executive-en">(Executive Summary)</span>
          </h3>
          <button
            type="button"
            className="ff-draft-edit-btn"
            onClick={() => setPolicyPickerOpen(true)}
          >
            <Pencil size={13} strokeWidth={2.2} aria-hidden="true" />
            신청 지원사업 변경
          </button>
        </div>
        {policyPickerOpen ? (
          <div className="ff-draft-policy-picker">
            <p className="ff-draft-policy-picker-title">
              신청서에 반영할 지원사업을 선택하세요.
            </p>
            {policyOptions.length > 0 ? (
              <ul className="ff-draft-policy-picker-list">
                {policyOptions.map((option) => (
                  <li key={option.policyId}>
                    <button
                      type="button"
                      className={`ff-draft-policy-option ${option.isCurrent ? "is-current" : ""}`}
                      onClick={() => void handlePolicyChange(option.policyId)}
                      disabled={model.isGeneratingDraft}
                    >
                      <strong>{option.title}</strong>
                      <span>{option.subtitle}</span>
                      {option.isCurrent ? <em>현재 적용</em> : null}
                      {pendingPolicyId === option.policyId ? <em>반영 중...</em> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ff-draft-policy-picker-empty">
                선택 가능한 지원사업이 없습니다. 분석을 다시 실행해 주세요.
              </p>
            )}
            {policyChangeError ? (
              <p className="ff-draft-policy-picker-error">{policyChangeError}</p>
            ) : null}
            <div className="ff-draft-policy-picker-actions">
              <button
                type="button"
                className="ff-draft-footlink"
                onClick={() => setPolicyPickerOpen(false)}
                disabled={model.isGeneratingDraft}
              >
                닫기
              </button>
            </div>
          </div>
        ) : null}

        {!model.draftExists ? (
          <div className="ff-draft-empty-state">
            <p>신청서 초안이 아직 생성되지 않았습니다.</p>
            <p className="ff-draft-empty-hint">
              오른쪽에서 투자 시나리오를 선택한 뒤 &quot;시나리오 확정 및 신청서
              생성&quot;을 누르면 AI 초안이 작성됩니다.
            </p>
            {policyLegacy && (
              <p className="ff-draft-empty-hint warn">
                이 분석에는 정책 스냅샷 이력이 없습니다. 최신 정책으로 대체되지
                않습니다.
              </p>
            )}
            {model.generateError && (
              <div className="ff-draft-alert warning">{model.generateError}</div>
            )}
          </div>
        ) : (
          <div className="ff-draft-executive-body">
            <section className="ff-draft-executive-block">
              <h4>
                <span className="ff-draft-section-dot" aria-hidden="true" />
                현황 및 도입 필요성
              </h4>
              <p>{necessityText}</p>
            </section>

            <section className="ff-draft-executive-block">
              <h4>
                <span className="ff-draft-section-dot" aria-hidden="true" />
                개선 방안 및 기대 효과
              </h4>
              <ul className="ff-draft-effect-list">
                {effectItems.map((item) => (
                  <li key={`${item.label}-${item.body.slice(0, 24)}`}>
                    {item.body ? (
                      <>
                        <strong>{item.label}</strong>
                        <span>{item.body}</span>
                      </>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="ff-draft-executive-block">
              <h4>
                <span className="ff-draft-section-dot" aria-hidden="true" />
                ROI 분석 결과 요약
              </h4>
              <p>{roiSummary}</p>
            </section>
          </div>
        )}

        <div className="ff-draft-ai-notice">
          <span className="ff-draft-ai-notice-icon" aria-hidden="true">
            <Sparkles size={15} strokeWidth={2.2} />
          </span>
          <p>
            AI가 귀사의 데이터를 기반으로 초안을 작성했습니다. 전문 검토를 위해
            내용을 확인해 주세요.
          </p>
        </div>
      </article>

      <aside className="ff-draft-sidebar-stack">
        <article className="ff-card ff-draft-scenario-card">
          <div className="ff-draft-scenario-card-head">
            <h4>투자 시나리오 선택</h4>
          </div>

          <ScenarioToggle selected={model.scenarioKey} onChange={model.setScenarioKey} />

          <div className="ff-draft-scenario-metrics">
            <div className="ff-draft-scenario-metric">
              <span>총 투자금</span>
              <strong>{formatCurrencyWonFromManwon(scenario?.investment_manwon)}</strong>
            </div>
            <div className="ff-draft-scenario-metric is-subsidy">
              <span>예상 지원금</span>
              <strong>
                {scenario?.subsidy_manwon == null
                  ? "공고참고"
                  : `+ ${formatCurrencyWonFromManwon(scenario.subsidy_manwon)}`}
              </strong>
            </div>
            <div className="ff-draft-scenario-divider" aria-hidden="true" />
            <div className="ff-draft-scenario-metric is-net">
              <span>실부담금</span>
              <strong>{formatCurrencyWonFromManwon(netInvestment)}</strong>
            </div>
          </div>

          <div className="ff-draft-payback-highlight">
            <span className="ff-draft-payback-icon" aria-hidden="true">
              <Clock3 size={18} strokeWidth={2.1} />
            </span>
            <span className="ff-draft-payback-label">예상 회수기간</span>
            <strong>{paybackCompact !== "-" ? paybackCompact : paybackFallback}</strong>
          </div>
        </article>

        <ApplicationDraftRecommendedPolicies model={model} />
      </aside>
    </section>
  )
}
