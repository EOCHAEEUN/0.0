import { ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { MobileScreenFeedback } from "./components/MobileScreenFeedback"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileHomeViewModel } from "./mobileApp.mapper"

export default function MobileHomeScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard, loading, error, refetch } = useDashboardData({ preferredAnalysisId })
  const [policyImageError, setPolicyImageError] = useState(false)
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
      mapMobileHomeViewModel({
        dashboard,
        draftWorkspace: draftWorkspace.data,
      }),
    [dashboard, draftWorkspace.data],
  )

  return (
    <section className="ff-mobile-screen">
      <MobileTopBar
        companyName={model.companyName || "FactoFit"}
        subtitle={model.statusHeadline}
        showSubtitle
      />

      <MobileScreenFeedback loading={loading} error={error} onRetry={refetch} />
      {!loading && !error ? (
        <>
      <article className="ff-mobile-navy-banner">
        <span className="ff-mobile-banner-label">EQUIPMENT STATUS</span>
        <h2>{model.equipmentBanner.headline}</h2>
        <p>{model.equipmentBanner.equipmentName}</p>
        <div className="ff-mobile-banner-meta">
          <span className="ff-mobile-banner-badge">{model.equipmentBanner.statusLabel}</span>
          <span className="ff-mobile-banner-metric">{model.equipmentBanner.metricText || "-"}</span>
        </div>
      </article>

      <article className="ff-mobile-card">
        <div className="ff-mobile-card-head">
          <h2>기업 요약</h2>
          <span className="ff-mobile-meta">{model.summaryStatusText}</span>
        </div>
        <div className="ff-mobile-company-grid">
          {model.companyRows.map((row) => (
            <div key={row.label} className="ff-mobile-company-cell">
              <span>{row.label}</span>
              <strong>{row.value || "-"}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="ff-mobile-card">
        <div className="ff-mobile-card-head">
          <h2>오늘의 작업</h2>
          <span className="ff-mobile-meta">{workspace.briefingTitle || "현장 우선 작업"}</span>
        </div>
        <div>
          {model.tasks.length === 0 ? (
            <p className="ff-mobile-empty-inline">등록된 작업이 없습니다.</p>
          ) : (
            model.tasks.map((task, index) => (
              <button
                key={task.id}
                type="button"
                className="ff-mobile-task-row"
                onClick={() => navigate(buildMobilePath(task.path, flowContext))}
              >
                <span className="ff-mobile-task-index">{index + 1}</span>
                <span className="ff-mobile-task-copy">
                  <strong>{task.label}</strong>
                  <span>{task.summary}</span>
                </span>
                <ChevronRight size={16} color="#94A3B8" />
              </button>
            ))
          )}
        </div>
      </article>

      <article className="ff-mobile-card ff-mobile-policy-hero">
        <div className="ff-mobile-card-head">
          <h2>맞춤형 지원사업</h2>
          <span className="ff-mobile-meta">매칭 {model.matchedPolicyCount}</span>
        </div>
        {model.featuredPolicy ? (
          <>
            {policyImageError ? (
              <div className="ff-mobile-policy-image is-empty">지원사업 이미지</div>
            ) : (
              <img
                className="ff-mobile-policy-image"
                src="/images/business-support.jpg"
                alt=""
                onError={() => setPolicyImageError(true)}
              />
            )}
            <div>
              <h3>{model.featuredPolicy.title}</h3>
              <p className="ff-mobile-meta">
                {model.featuredPolicy.deadlineLabel} · {model.featuredPolicy.supportAmountText}
              </p>
              <p>{model.featuredPolicy.reason || "-"}</p>
            </div>
            <button
              type="button"
              className="ff-mobile-secondary-btn"
              onClick={() => navigate(buildMobilePath(model.featuredPolicy!.path, flowContext))}
            >
              지원사업 상세 보기
            </button>
          </>
        ) : (
          <>
            <div className="ff-mobile-policy-image is-empty">매칭된 지원사업이 없습니다</div>
            <p className="ff-mobile-empty-inline">ROI 분석 후 추천 지원사업이 표시됩니다.</p>
            <button
              type="button"
              className="ff-mobile-secondary-btn"
              onClick={() => navigate(buildMobilePath("/mobile/policies", flowContext))}
            >
              지원사업 탐색
            </button>
          </>
        )}
      </article>

      <article className="ff-mobile-card ff-mobile-ai-card">
        <span className="ff-mobile-section-label">AI ASSISTANT</span>
        <h2>현장 AI 도우미</h2>
        <p>{model.aiPrompt}</p>
        <div className="ff-mobile-chip-row">
          {model.aiChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="ff-mobile-chip"
              onClick={() =>
                navigate(
                  buildMobilePath("/mobile/ai", flowContext, {
                    q: chip.question,
                  }),
                )
              }
            >
              {chip.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ff-mobile-primary-btn"
          onClick={() => navigate(buildMobilePath("/mobile/ai", flowContext))}
        >
          AI Assistant 열기 <ChevronRight size={14} />
        </button>
      </article>
        </>
      ) : null}
    </section>
  )
}
