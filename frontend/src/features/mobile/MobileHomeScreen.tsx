import { Bell, ChevronRight } from "lucide-react"
import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { buildMobilePath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobileHomeViewModel } from "./mobileApp.mapper"

export default function MobileHomeScreen() {
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
      mapMobileHomeViewModel({
        dashboard,
        draftWorkspace: draftWorkspace.data,
      }),
    [dashboard, draftWorkspace.data],
  )

  return (
    <section className="ff-mobile-screen">
      <header className="ff-mobile-header">
        <div>
          <h1>{model.greeting}</h1>
          <p>{model.statusHeadline}</p>
        </div>
        <button type="button" className="ff-mobile-icon-btn" aria-label="알림">
          <Bell size={18} />
        </button>
      </header>

      <article className="ff-mobile-card">
        <h2>우선 확인</h2>
        <div className="ff-mobile-list">
          {model.priorityCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="ff-mobile-list-item"
              onClick={() => navigate(buildMobilePath(card.ctaPath, flowContext))}
              style={{ textAlign: "left" }}
            >
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="ff-mobile-meta">{card.ctaLabel}</span>
            </button>
          ))}
        </div>
      </article>

      <article className="ff-mobile-card">
        <h2>대표설비 요약</h2>
        <p>{workspace.equipmentName || "대표설비가 없습니다."}</p>
        <p className="ff-mobile-meta">
          {dashboard.equipmentRows[0]?.subtitle || "카테고리 확인 필요"}
        </p>
        <p className="ff-mobile-kpi">{workspace.kpis[0]?.value || "-"}</p>
        <button
          type="button"
          className="ff-mobile-secondary-btn"
          onClick={() => navigate(buildMobilePath("/mobile/roi", flowContext))}
        >
          ROI 보기
        </button>
      </article>

      <article className="ff-mobile-card">
        <h2>오늘의 작업</h2>
        <div className="ff-mobile-list">
          {model.tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="ff-mobile-list-item"
              onClick={() => navigate(buildMobilePath(task.path, flowContext))}
              style={{ textAlign: "left" }}
            >
              <h3>{task.label}</h3>
              <p>{task.summary}</p>
            </button>
          ))}
        </div>
      </article>

      <article className="ff-mobile-card">
        <h2>추천 지원사업</h2>
        {model.recommendedPolicies.length === 0 ? (
          <p>매칭된 정책이 없습니다. 웹에서 정책 검색을 진행해 주세요.</p>
        ) : (
          <div className="ff-mobile-list">
            {model.recommendedPolicies.map((policy) => (
              <button
                key={policy.id}
                type="button"
                className="ff-mobile-list-item"
                style={{ textAlign: "left" }}
                onClick={() => navigate(buildMobilePath(policy.path, flowContext))}
              >
                <h3>{policy.title}</h3>
                <p>{policy.deadlineLabel}</p>
                <p>{policy.reason}</p>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="ff-mobile-secondary-btn"
          onClick={() => navigate(buildMobilePath("/mobile/policies", flowContext))}
        >
          전체 보기
        </button>
      </article>

      <article className="ff-mobile-card">
        <h2>신청 준비도</h2>
        <p className="ff-mobile-kpi">{model.readiness.scoreLabel}</p>
        {model.readiness.missingItems.length > 0 ? (
          <div className="ff-mobile-list">
            {model.readiness.missingItems.slice(0, 2).map((item) => (
              <div key={item} className="ff-mobile-list-item">
                <p>{item}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>누락 항목이 없습니다.</p>
        )}
        <button
          type="button"
          className="ff-mobile-secondary-btn"
          onClick={() => navigate(buildMobilePath("/mobile/application", flowContext))}
        >
          신청서 확인
        </button>
      </article>

      <article className="ff-mobile-card">
        <h2>AI 다음 행동</h2>
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
          className="ff-mobile-secondary-btn"
          onClick={() => navigate(buildMobilePath("/mobile/ai", flowContext))}
        >
          AI 현장 도우미 열기 <ChevronRight size={14} />
        </button>
      </article>
    </section>
  )
}
