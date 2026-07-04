import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { useSupportProjectsOverview } from "../support/hooks/useSupportProjectsOverview"
import type { SupportProjectsPolicyCard } from "../support/supportProjectsOverview.types"
import { buildMobilePath, buildWebSupportProjectsPath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobilePoliciesViewModel } from "./mobileApp.mapper"

type PolicyFilter = "all" | "closing" | "rolling"

function applyFilter(items: SupportProjectsPolicyCard[], filter: PolicyFilter) {
  if (filter === "closing") {
    return items.filter((item) => typeof item.days_remaining === "number" && item.days_remaining <= 7)
  }
  if (filter === "rolling") {
    return items.filter((item) => /상시|수시/.test(item.d_day || ""))
  }
  return items
}

export default function MobilePoliciesScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState<PolicyFilter>("all")
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId })
  const workspace = dashboard.workspace
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, workspace),
    [searchParams, workspace],
  )
  const hasAnalysisContext = Boolean(flowContext.analysisId)

  const { state, reload } = useSupportProjectsOverview({
    companyId: getStoredCompanyId(),
    analysisId: flowContext.analysisId,
    equipmentId: flowContext.equipmentId,
  })

  const allPolicies = useMemo(() => {
    if (state.kind !== "ready" && state.kind !== "empty" && state.kind !== "legacy_missing") return []
    const model = state.model
    if (hasAnalysisContext) {
      return [...model.priorityPolicies, ...model.allMatched]
    }
    return [...model.priorityPolicies, ...model.liveDiscovery.items]
  }, [hasAnalysisContext, state])

  const model = useMemo(
    () =>
      mapMobilePoliciesViewModel({
        policies: applyFilter(allPolicies, filter).slice(0, 10),
        equipmentName: workspace.equipmentName || "대표설비",
      }),
    [allPolicies, filter, workspace.equipmentName],
  )

  const buildDetailPath = (policyId: string) => {
    const webPath = buildWebSupportProjectsPath({
      analysisId: flowContext.analysisId,
      equipmentId: flowContext.equipmentId,
      policyId,
    })
    return webPath
  }

  return (
    <section className="ff-mobile-screen">
      <header className="ff-mobile-header">
        <div>
          <h1>{model.title}</h1>
          <p>
            {hasAnalysisContext
              ? model.subtitle
              : "analysisId가 없어 현재는 전체 지원사업 탐색 모드입니다."}
          </p>
        </div>
      </header>

      <article className="ff-mobile-card">
        <div className="ff-mobile-chip-row">
          <button type="button" className="ff-mobile-chip" onClick={() => setFilter("all")}>
            전체
          </button>
          <button type="button" className="ff-mobile-chip" onClick={() => setFilter("closing")}>
            마감 임박
          </button>
          <button type="button" className="ff-mobile-chip" onClick={() => setFilter("rolling")}>
            상시 모집
          </button>
        </div>
      </article>

      {state.kind === "loading" ? <article className="ff-mobile-card"><p>정책 정보를 불러오는 중...</p></article> : null}
      {state.kind === "error" ? (
        <article className="ff-mobile-card">
          <h2>정책 정보를 불러오지 못했습니다.</h2>
          <p>{state.message}</p>
          <button type="button" className="ff-mobile-secondary-btn" onClick={() => void reload()}>
            다시 시도
          </button>
        </article>
      ) : null}

      {state.kind !== "loading" && state.kind !== "error" ? (
        <article className="ff-mobile-card">
          {!model.hasData ? (
            <>
              <h2>매칭된 정책이 없습니다.</h2>
              <p>웹에서 조건을 보완한 뒤 다시 확인해 주세요.</p>
            </>
          ) : (
            <div className="ff-mobile-list">
              {model.policies.slice(0, 8).map((policy) => (
                <div key={policy.policy_id} className="ff-mobile-list-item">
                  <h3>{policy.title}</h3>
                  <p>{policy.d_day || "상시 모집"} · {policy.support_type_label || "지원 유형 확인 필요"}</p>
                  <p>
                    {hasAnalysisContext
                      ? policy.recommendation_summary || policy.match_reason || "분석 결과 기반 추천"
                      : "전체 탐색 정책"}
                  </p>
                  <button
                    type="button"
                    className="ff-mobile-secondary-btn"
                    onClick={() => navigate(buildDetailPath(policy.policy_id))}
                  >
                    자세히 보기
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="ff-mobile-primary-btn"
            onClick={() =>
              navigate(
                hasAnalysisContext
                  ? buildWebSupportProjectsPath(flowContext)
                  : model.webSearchPath,
              )
            }
          >
            웹에서 전체 검색 보기
          </button>
          {hasAnalysisContext ? (
            <button
              type="button"
              className="ff-mobile-secondary-btn"
              onClick={() => navigate(buildMobilePath("/mobile/application", flowContext))}
            >
              신청서 문맥으로 이동
            </button>
          ) : null}
        </article>
      ) : null}
    </section>
  )
}
