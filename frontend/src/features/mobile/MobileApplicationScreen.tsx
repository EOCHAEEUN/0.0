import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApplicationDraftWorkspace } from "../applicationDraft/hooks/useApplicationDraftWorkspace"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
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
      <header className="ff-mobile-header">
        <div>
          <h1>신청 준비 상태</h1>
          <p>작성 대신 준비 점검과 빠른 실행</p>
        </div>
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
        <h2>신청 준비도</h2>
        <p className="ff-mobile-kpi">{model.readinessLabel}</p>
        {model.missingItems.length > 0 ? (
          <div className="ff-mobile-list">
            {model.missingItems.slice(0, 3).map((item) => (
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
        <h2>현재 연결된 정책</h2>
        <p>{model.policyName}</p>
        <p className="ff-mobile-meta">{model.policyDeadline}</p>
        <p className="ff-mobile-meta">{model.policyStatus}</p>
      </article>

      <article className="ff-mobile-card">
        <h2>빠른 실행</h2>
        <div className="ff-mobile-list">
          <button
            type="button"
            className="ff-mobile-secondary-btn"
            onClick={() => navigate(model.webDraftPath)}
          >
            신청서 요약 보기
          </button>
          <button
            type="button"
            className="ff-mobile-secondary-btn"
            onClick={() => navigate(buildMobilePath("/mobile/safety", flowContext))}
          >
            안전 점검 증빙 등록
          </button>
          <button
            type="button"
            className="ff-mobile-primary-btn"
            onClick={() => {
              const query = new URLSearchParams()
              if (flowContext.analysisId) query.set("analysisId", flowContext.analysisId)
              if (flowContext.policyId) query.set("policyId", flowContext.policyId)
              const queryText = query.toString()
              navigate(queryText ? `/application-draft?${queryText}` : "/application-draft")
            }}
          >
            웹에서 신청서 편집
          </button>
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
    </section>
  )
}
