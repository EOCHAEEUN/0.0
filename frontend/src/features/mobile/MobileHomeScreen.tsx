import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  MoreVertical,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { MobileScreenFeedback } from "./components/MobileScreenFeedback"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileHomeViewModel } from "./mobileApp.mapper"
import type { MobileTaskItem } from "./mobileApp.types"

function mapTaskStatusLabel(status: MobileTaskItem["status"]) {
  if (status === "done") return "완료"
  if (status === "urgent") return "마감 임박"
  return "진행 대기"
}

function renderHighlightedMessage(message: string, highlightText: string) {
  if (!highlightText || !message.includes(highlightText)) {
    return message
  }

  const [before, after] = message.split(highlightText)
  return (
    <>
      {before}
      <strong>{highlightText}</strong>
      {after}
    </>
  )
}

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
    <section className="ff-mobile-screen ff-mobile-screen-home">
      <MobileTopBar companyName={model.companyName || "FactoFit"} />

      <MobileScreenFeedback loading={loading} error={error} onRetry={refetch} />
      {!loading && !error ? (
        <>
          <article className="ff-mobile-alert-banner">
            <div className="ff-mobile-alert-icon" aria-hidden="true">
              <AlertTriangle size={18} strokeWidth={2.2} />
            </div>
            <div className="ff-mobile-alert-copy">
              <span className="ff-mobile-alert-label">{model.equipmentAlert.title}</span>
              <p className="ff-mobile-alert-message">{model.equipmentAlert.message}</p>
            </div>
            {model.equipmentAlert.showCta ? (
              <button
                type="button"
                className="ff-mobile-alert-cta"
                onClick={() => navigate(buildMobilePath(model.equipmentAlert.ctaPath, flowContext))}
              >
                {model.equipmentAlert.ctaLabel}
              </button>
            ) : null}
          </article>

          <article className="ff-mobile-company-card">
            <div className="ff-mobile-company-head">
              <div className="ff-mobile-company-avatar" aria-hidden="true">
                <img src="/images/business-support.jpg" alt="" />
              </div>
              <div className="ff-mobile-company-head-copy">
                <strong>{model.companyCard.companyName}</strong>
                <span>{model.companyCard.locationLine}</span>
              </div>
              <button type="button" className="ff-mobile-company-menu" aria-label="기업 메뉴">
                <MoreVertical size={18} strokeWidth={2.1} />
              </button>
            </div>
            {model.companyRows.length > 0 ? (
              <div className="ff-mobile-company-grid">
                {model.companyRows.map((row) => (
                  <div key={row.label} className="ff-mobile-company-cell">
                    <span>{row.label}</span>
                    <strong>{row.value || "-"}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="ff-mobile-company-stats-panel">
              <div className="ff-mobile-company-equipment-line">
                <Settings size={15} strokeWidth={2.2} aria-hidden="true" />
                <span>{model.companyCard.equipmentStatusLine}</span>
              </div>
              <div className="ff-mobile-company-kpis">
                <div>
                  <span>등록설비</span>
                  <strong>{model.companyCard.registeredEquipmentCount}대</strong>
                </div>
                <div>
                  <span>마감임박</span>
                  <strong
                    className={
                      model.companyCard.closingSoonCount > 0 ? "ff-mobile-kpi-highlight" : undefined
                    }
                  >
                    {model.companyCard.closingSoonCount}건
                  </strong>
                </div>
                <div>
                  <span>지원사업 매칭</span>
                  <strong>{model.companyCard.matchedPolicyLabel}</strong>
                </div>
              </div>
            </div>
          </article>

          <article className="ff-mobile-card ff-mobile-today-card">
            <div className="ff-mobile-today-head">
              <div className="ff-mobile-today-title">
                <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" />
                <h2>오늘의 작업</h2>
              </div>
              <span className="ff-mobile-today-count">{model.todayTaskCount}개</span>
            </div>
            {model.tasks.length === 0 ? (
              <p className="ff-mobile-empty-inline">등록된 작업이 없습니다.</p>
            ) : (
              model.tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="ff-mobile-today-row"
                  onClick={() => navigate(buildMobilePath(task.path, flowContext))}
                >
                  <span className="ff-mobile-today-row-icon" aria-hidden="true">
                    <UserRound size={16} strokeWidth={2.1} />
                  </span>
                  <span className="ff-mobile-today-row-label">{task.label}</span>
                  <span className="ff-mobile-today-badge">{mapTaskStatusLabel(task.status)}</span>
                </button>
              ))
            )}
          </article>

          <div className="ff-mobile-section-header">
            <h2>맞춤형 지원 사업</h2>
            <button
              type="button"
              className="ff-mobile-section-link"
              onClick={() => navigate(buildMobilePath(model.policiesViewAllPath, flowContext))}
            >
              전체보기
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>

          {model.featuredPolicy ? (
            <article className="ff-mobile-policy-card">
              <div className="ff-mobile-policy-media">
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
                <div className="ff-mobile-policy-badges">
                  {model.featuredPolicy.deadlineLabel ? (
                    <span className="ff-mobile-policy-badge is-deadline">
                      {model.featuredPolicy.deadlineLabel}
                    </span>
                  ) : null}
                  {model.featuredPolicy.matchBadge ? (
                    <span className="ff-mobile-policy-badge is-match">
                      {model.featuredPolicy.matchBadge}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="ff-mobile-policy-body">
                {model.featuredPolicy.organizationLabel ? (
                  <p className="ff-mobile-policy-org">[{model.featuredPolicy.organizationLabel}]</p>
                ) : null}
                <h3 className="ff-mobile-policy-title">{model.featuredPolicy.title}</h3>
                {model.featuredPolicy.tags.length > 0 ? (
                  <div className="ff-mobile-policy-tags">
                    {model.featuredPolicy.tags.map((tag) => (
                      <span key={tag} className="ff-mobile-policy-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="ff-mobile-policy-footer">
                {model.featuredPolicy.supportAmountLabel ? (
                  <strong className="ff-mobile-policy-amount">{model.featuredPolicy.supportAmountLabel}</strong>
                ) : (
                  <span className="ff-mobile-policy-amount is-empty">지원금 정보 확인 필요</span>
                )}
                <button
                  type="button"
                  className="ff-mobile-policy-cta"
                  onClick={() => navigate(buildMobilePath(model.featuredPolicy!.path, flowContext))}
                >
                  {model.featuredPolicy.ctaLabel}
                </button>
              </div>
            </article>
          ) : (
            <article className="ff-mobile-policy-card is-empty">
              <div className="ff-mobile-policy-image is-empty">매칭된 지원사업이 없습니다</div>
              <p className="ff-mobile-empty-inline">ROI 분석 후 추천 지원사업이 표시됩니다.</p>
              <button
                type="button"
                className="ff-mobile-policy-cta"
                onClick={() => navigate(buildMobilePath(model.policiesViewAllPath, flowContext))}
              >
                지원사업 탐색
              </button>
            </article>
          )}

          <article className="ff-mobile-ai-card ff-mobile-home-ai-card">
            <div className="ff-mobile-home-ai-head">
              <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
              <strong>FactoFit AI Assistant</strong>
            </div>
            <div className="ff-mobile-home-ai-body">
              <p className="ff-mobile-home-ai-quote">
                &ldquo;{renderHighlightedMessage(model.aiCard.message, model.aiCard.highlightText)}&rdquo;
              </p>
              <button
                type="button"
                className="ff-mobile-home-ai-cta"
                onClick={() => navigate(buildMobilePath("/mobile/ai", flowContext))}
              >
                {model.aiCard.ctaLabel}
              </button>
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}
