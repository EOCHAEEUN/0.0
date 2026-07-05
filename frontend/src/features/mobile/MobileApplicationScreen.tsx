import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Pencil,
  Sparkles,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import {
  formatCurrencyWonFromManwon,
  formatPaybackYearsCompact,
} from "../applicationDraft/applicationDraft.utils"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileSafetyViewModel } from "./mobileApp.mapper"
import {
  MOBILE_PDF_SECTIONS,
  buildMobileEffectItems,
  buildMobileNecessityText,
  buildMobileRoiSummary,
} from "./mobileApplicationSummary.utils"

const STEPPER = [
  { key: "company", label: "기업정보" },
  { key: "equipment", label: "설비정보" },
  { key: "roi", label: "ROI분석" },
  { key: "application", label: "신청서" },
] as const

function policySupportLabel(supportText?: string) {
  const text = supportText?.trim()
  if (text && text !== "-" && text !== "공고문 확인 필요") return text
  return ""
}

function truncatePolicyTitle(title: string, max = 22) {
  const trimmed = title.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export default function MobileApplicationScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedPdfSection, setSelectedPdfSection] = useState(MOBILE_PDF_SECTIONS[0].id)
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId })
  const workspace = dashboard.workspace
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, workspace),
    [searchParams, workspace],
  )

  const draft = useApplicationDraftWorkspace({
    analysisId: flowContext.analysisId,
    policyId: flowContext.policyId,
    companyId: getStoredCompanyId() || undefined,
  })

  const safetyModel = useMemo(
    () =>
      mapMobileSafetyViewModel({
        draftWorkspace: draft.data,
        equipmentName: draft.data?.equipment?.name || workspace.equipmentName,
        evidenceItems: [],
        analysisId: flowContext.analysisId,
        policyId: flowContext.policyId,
        equipmentId: flowContext.equipmentId,
      }),
    [draft.data, flowContext, workspace.equipmentName],
  )

  const hasRequiredContext = Boolean(flowContext.analysisId && flowContext.policyId)
  const scenario = draft.activeScenario
  const netInvestment =
    scenario?.net_investment_manwon ??
    (scenario?.investment_manwon != null && scenario?.subsidy_manwon != null
      ? Math.max(0, Number(scenario.investment_manwon) - Number(scenario.subsidy_manwon))
      : null)

  const necessityText = buildMobileNecessityText(draft.data)
  const effectItems = buildMobileEffectItems(draft.data)
  const roiSummary = buildMobileRoiSummary(scenario, draft.scenarioKey)
  const paybackText = formatPaybackYearsCompact({
    payback_months: scenario?.payback_months,
    payback_years: scenario?.payback_years,
  })

  const recommendedPolicies = useMemo(() => {
    const currentTitle = draft.data?.policy?.title?.trim()
    if (!currentTitle) return []

    return [
      {
        id: draft.data?.policy_id || "current",
        title: currentTitle,
        support: policySupportLabel(draft.subsidyLabel),
      },
    ]
  }, [draft.data?.policy?.title, draft.data?.policy_id, draft.subsidyLabel])

  const openWebDraft = () => {
    const query = new URLSearchParams()
    if (flowContext.analysisId) query.set("analysisId", flowContext.analysisId)
    if (flowContext.policyId) query.set("policyId", flowContext.policyId)
    const queryText = query.toString()
    navigate(queryText ? `/application-draft?${queryText}` : "/application-draft")
  }

  const stepComplete = (key: string) => {
    if (!draft.data) return false
    const readiness = draft.data.readiness
    if (key === "company") return readiness.company.status === "complete"
    if (key === "equipment") return readiness.equipment.status === "complete"
    if (key === "roi") return readiness.roi.status === "complete"
    return false
  }

  return (
    <section className="ff-mobile-screen ff-mobile-application-screen">
      <MobileTopBar companyName={workspace.companyName} subtitle="신청서" showSubtitle />

      {!hasRequiredContext ? (
        <article className="ff-mobile-card">
          <h2>신청 문맥이 없습니다.</h2>
          <p>ROI 분석에서 추천된 지원사업을 선택하면 신청서를 준비할 수 있습니다.</p>
          <button
            type="button"
            className="ff-mobile-primary-btn"
            onClick={() => navigate(buildMobilePath("/mobile/policies", flowContext))}
          >
            정책 선택하러 가기
          </button>
        </article>
      ) : null}

      {draft.isLoading ? (
        <article className="ff-mobile-card">
          <p>신청서 정보를 불러오는 중...</p>
        </article>
      ) : null}

      {draft.errorMessage ? (
        <article className="ff-mobile-card">
          <p>{draft.errorMessage}</p>
        </article>
      ) : null}

      {hasRequiredContext && !draft.isLoading && !draft.errorMessage ? (
        <>
          <nav className="ff-mobile-application-stepper" aria-label="신청서 작성 진행 단계">
            {STEPPER.map((step, index) => {
              const isCurrent = step.key === "application"
              const isComplete = !isCurrent && stepComplete(step.key)
              return (
                <div key={step.key} className="ff-mobile-application-step-wrap">
                  {index > 0 ? <span className="ff-mobile-application-step-line" aria-hidden="true" /> : null}
                  <div
                    className={`ff-mobile-application-step${isCurrent ? " is-current" : ""}${
                      isComplete ? " is-complete" : ""
                    }`}
                  >
                    <span className="ff-mobile-application-step-icon" aria-hidden="true">
                      {isCurrent ? (
                        <FileText size={16} strokeWidth={2.1} />
                      ) : isComplete ? (
                        <Check size={16} strokeWidth={2.4} />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </span>
                    <span>{step.label}</span>
                  </div>
                </div>
              )
            })}
          </nav>

          <article className="ff-mobile-application-summary-card">
            <div className="ff-mobile-application-summary-head">
              <h2>
                핵심 요약 <span>(Summary)</span>
              </h2>
              <button type="button" className="ff-mobile-application-edit-btn" onClick={openWebDraft}>
                <Pencil size={13} strokeWidth={2.1} aria-hidden="true" />
                수정
              </button>
            </div>

            <section className="ff-mobile-application-block">
              <h3>현황 및 필요성</h3>
              <p>{necessityText}</p>
            </section>

            {effectItems.length > 0 ? (
              <section className="ff-mobile-application-block">
                <h3>기대 효과</h3>
                <ul>
                  {effectItems.map((item) => (
                    <li key={`${item.label}-${item.body}`}>
                      {item.body ? (
                        <>
                          <strong>{item.label}</strong> {item.body}
                        </>
                      ) : (
                        item.label
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="ff-mobile-application-block">
              <h3>ROI 결과</h3>
              <p>{roiSummary}</p>
            </section>

            <div className="ff-mobile-application-ai-note">
              <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
              <p>AI가 데이터 기반으로 작성한 초안입니다.</p>
            </div>
          </article>

          {recommendedPolicies.length > 0 ? (
            <section className="ff-mobile-application-recommend-compact">
              <span>추천 지원 사업</span>
              {recommendedPolicies.map((policy) => (
                <p key={policy.id}>
                  <strong title={policy.title}>{truncatePolicyTitle(policy.title)}</strong>
                  {policy.support ? <em>{policy.support}</em> : null}
                </p>
              ))}
            </section>
          ) : null}

          <article className="ff-mobile-application-scenario-card">
            <div className="ff-mobile-application-scenario-toggle">
              <button
                type="button"
                className={draft.scenarioKey === "A" ? "is-active" : undefined}
                onClick={() => draft.setScenarioKey("A")}
              >
                A. 전체
              </button>
              <button
                type="button"
                className={draft.scenarioKey === "B" ? "is-active" : undefined}
                onClick={() => draft.setScenarioKey("B")}
              >
                B. 부분
              </button>
            </div>

            <div className="ff-mobile-application-finance-rows">
              <div>
                <span>총 투자금</span>
                <strong>{formatCurrencyWonFromManwon(scenario?.investment_manwon)}</strong>
              </div>
              <div className="is-subsidy">
                <span>지원금</span>
                <strong>
                  {scenario?.subsidy_manwon == null
                    ? "공고참고"
                    : `+ ${formatCurrencyWonFromManwon(scenario.subsidy_manwon)}`}
                </strong>
              </div>
              <div className="is-net">
                <span>실부담금</span>
                <strong>{formatCurrencyWonFromManwon(netInvestment)}</strong>
              </div>
            </div>

            <div className="ff-mobile-application-payback-box">
              <Clock3 size={16} strokeWidth={2.1} aria-hidden="true" />
              <span>회수기간</span>
              <strong>{paybackText !== "-" ? paybackText : draft.paybackLabel}</strong>
            </div>

            {draft.generateError ? <p className="ff-mobile-application-error">{draft.generateError}</p> : null}

            <button
              type="button"
              className="ff-mobile-application-primary-cta"
              disabled={draft.isGeneratingDraft || draft.data?.policy?.legacy_missing}
              onClick={() => void draft.handleGenerateDraft()}
            >
              {draft.isGeneratingDraft ? "신청서 생성 중..." : "신청서 생성 시작"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </article>

          <section className="ff-mobile-application-safety">
            <header>
              <span>안전개선 근거</span>
              <h2>현재 상태와 증빙 여부 판단</h2>
            </header>

            <div className="ff-mobile-application-safety-list">
              {safetyModel.viewpoints.length === 0 ? (
                <p className="ff-mobile-empty-inline">안전개선 항목이 없습니다.</p>
              ) : (
                safetyModel.viewpoints.map((viewpoint, index) => (
                  <article key={viewpoint.key} className="ff-mobile-application-safety-card">
                    <div className="ff-mobile-application-safety-top">
                      <div className="ff-mobile-application-safety-badges">
                        <span
                          className={`is-${
                            /정상|양호|충족/.test(viewpoint.judgement) ? "ok" : "need"
                          }`}
                        >
                          {viewpoint.judgement || "개선 필요"}
                        </span>
                        <span className="is-neutral">{viewpoint.evidenceStatus}</span>
                      </div>
                      <em>No. {index + 1}</em>
                    </div>
                    <h3>{viewpoint.title}</h3>
                    <p>{viewpoint.description}</p>
                    <button
                      type="button"
                      className="ff-mobile-application-evidence-link"
                      onClick={() => navigate(buildMobilePath("/mobile/safety", flowContext))}
                    >
                      증빙 관리
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <article className="ff-mobile-application-report-card">
            <span className="ff-mobile-application-report-badge">최종 PDF 미리보기</span>
            <h2>리포트 형식 생성</h2>
            <p>
              신청서 초안 리포트와 안전개선 근거 리포트를 미리 확인하거나 필요한 PDF만 선택해
              다운로드할 수 있습니다.
            </p>

            <div className="ff-mobile-application-report-sections">
              {MOBILE_PDF_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`ff-mobile-application-report-section${
                    selectedPdfSection === section.id ? " is-active" : ""
                  }`}
                  onClick={() => setSelectedPdfSection(section.id)}
                >
                  <strong>{section.id}</strong>
                  <span>{section.title}</span>
                  <em>{section.body}</em>
                </button>
              ))}
            </div>

            <div className="ff-mobile-application-report-actions">
              <button
                type="button"
                className="ff-mobile-application-report-preview"
                disabled={!draft.canUsePdf}
                onClick={openWebDraft}
              >
                미리보기
              </button>
              <button
                type="button"
                className="ff-mobile-application-report-download"
                disabled={!draft.canUsePdf}
                onClick={openWebDraft}
              >
                다운로드
              </button>
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}
