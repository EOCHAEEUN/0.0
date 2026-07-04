import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileApplicationViewModel } from "./mobileApp.mapper"

export default function MobileApplicationScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId })
  const workspace = dashboard.workspace
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, workspace),
    [searchParams, workspace],
  )
  const draftWorkspace = useApplicationDraftWorkspace({
    analysisId: flowContext.analysisId,
    policyId: flowContext.policyId,
    companyId: getStoredCompanyId() || undefined,
  })

  const model = useMemo(
    () =>
      mapMobileApplicationViewModel({
        dashboard,
        draftWorkspace: draftWorkspace.data,
      }),
    [dashboard, draftWorkspace.data],
  )
  const hasRequiredContext = Boolean(flowContext.analysisId && flowContext.policyId)

  return (
    <section className="ff-mobile-screen">
      <MobileTopBar companyName={workspace.companyName} subtitle="신청서 요약" showSubtitle />

      <header className="ff-mobile-page-title">
        <span className="ff-mobile-section-label">APPLICATION</span>
        <h1>신청 준비 요약</h1>
        <p>작성 대신 준비 점검과 빠른 실행에 집중합니다.</p>
      </header>

      {!hasRequiredContext ? (
        <article className="ff-mobile-card">
          <h2>신청 문맥이 없습니다.</h2>
          <p>ROI 분석에서 추천된 지원사업을 선택하면 신청 준비도를 확인할 수 있습니다.</p>
          <button
            type="button"
            className="ff-mobile-primary-btn"
            onClick={() => navigate(buildMobilePath("/mobile/policies", flowContext))}
          >
            정책 선택하러 가기
          </button>
        </article>
      ) : null}

      <article className="ff-mobile-card">
        <div className="ff-mobile-card-head">
          <h2>단계 진행</h2>
          <span className="ff-mobile-meta">준비도 {model.readinessLabel}</span>
        </div>
        <div className="ff-mobile-steps">
          {model.steps.map((step, index) => (
            <div
              key={step.key}
              className={`ff-mobile-step${
                step.status === "complete"
                  ? " is-complete"
                  : step.status === "needs"
                    ? " is-needs"
                    : ""
              }`}
            >
              <div className="ff-mobile-step-dot">{index + 1}</div>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="ff-mobile-card">
        <h2>핵심 요약</h2>
        {model.summaryParagraphs.length > 0 ? (
          model.summaryParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
        ) : (
          <p className="ff-mobile-empty-inline">신청서 요약 문단이 아직 없습니다.</p>
        )}
        {model.missingItems.length > 0 ? (
          <div className="ff-mobile-list">
            {model.missingItems.map((item) => (
              <div key={item} className="ff-mobile-list-item">
                <p>{item}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>누락 항목이 없습니다.</p>
        )}
      </article>

      <article className="ff-mobile-card">
        <h2>추천 지원사업</h2>
        <h3>{model.policyName}</h3>
        <p className="ff-mobile-meta">{model.policyDeadline}</p>
        <p className="ff-mobile-meta">{model.policyStatus}</p>
      </article>

      <article className="ff-mobile-card">
        <h2>투자 · 지원 · 실부담</h2>
        <div className="ff-mobile-finance-grid">
          <div className="ff-mobile-finance-cell">
            <span>투자금</span>
            <strong>{model.investmentText}</strong>
          </div>
          <div className="ff-mobile-finance-cell">
            <span>지원금</span>
            <strong>{model.subsidyText}</strong>
          </div>
          <div className="ff-mobile-finance-cell">
            <span>실부담금</span>
            <strong>{model.netInvestmentText}</strong>
          </div>
          <div className="ff-mobile-finance-cell">
            <span>회수기간</span>
            <strong>{model.paybackText}</strong>
          </div>
        </div>
      </article>

      <article className="ff-mobile-card">
        <h2>증빙 요약</h2>
        <p className="ff-mobile-kpi">{model.evidenceCountLabel}</p>
        <p>{model.evidenceMissingText}</p>
        <button
          type="button"
          className="ff-mobile-secondary-btn"
          onClick={() => navigate(buildMobilePath("/mobile/safety", flowContext))}
        >
          증빙 등록
        </button>
      </article>

      <article className="ff-mobile-card">
        <button
          type="button"
          className="ff-mobile-primary-btn"
          onClick={() => {
            const query = new URLSearchParams()
            if (flowContext.analysisId) query.set("analysisId", flowContext.analysisId)
            if (flowContext.policyId) query.set("policyId", flowContext.policyId)
            const queryText = query.toString()
            navigate(queryText ? `/application-draft?${queryText}` : model.webDraftPath)
          }}
        >
          {model.draftExists ? "신청서 요약 보기" : "신청서 생성 CTA"}
        </button>
        <button
          type="button"
          className="ff-mobile-ghost-btn"
          onClick={() => navigate(model.webDraftPath)}
        >
          웹에서 신청서 편집
        </button>
      </article>
    </section>
  )
}
