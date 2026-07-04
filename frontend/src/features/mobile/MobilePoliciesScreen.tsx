import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { useSupportProjectsOverview } from "../support/hooks/useSupportProjectsOverview"
import type { SupportProjectsPolicyCard } from "../support/supportProjectsOverview.types"
import { MobileTopBar } from "./components/MobileTopBar"
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

function filterByQuery(items: SupportProjectsPolicyCard[], query: string) {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return items
  return items.filter((item) =>
    [item.title, item.organization, item.support_type_label, item.match_reason]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)),
  )
}

export default function MobilePoliciesScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState<PolicyFilter>("all")
  const [query, setQuery] = useState("")
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

  const overviewModel =
    state.kind === "ready" || state.kind === "empty" || state.kind === "legacy_missing"
      ? state.model
      : null

  const allPolicies = useMemo(() => {
    if (!overviewModel) return []
    if (hasAnalysisContext) {
      return [...overviewModel.priorityPolicies, ...overviewModel.allMatched]
    }
    return [...overviewModel.priorityPolicies, ...overviewModel.liveDiscovery.items]
  }, [hasAnalysisContext, overviewModel])

  const model = useMemo(
    () =>
      mapMobilePoliciesViewModel({
        policies: applyFilter(filterByQuery(allPolicies, query), filter),
        priorityPolicy: overviewModel?.priorityPolicy || null,
        equipmentName: workspace.equipmentName || "대표설비",
      }),
    [allPolicies, filter, overviewModel?.priorityPolicy, query, workspace.equipmentName],
  )

  const priority = model.priorityPolicy

  return (
    <section className="ff-mobile-screen">
      <MobileTopBar companyName={workspace.companyName} subtitle="지원사업" showSubtitle />

      <header className="ff-mobile-page-title">
        <span className="ff-mobile-section-label">POLICY MATCH</span>
        <h1>{model.title}</h1>
        <p>
          {hasAnalysisContext
            ? model.subtitle
            : "analysisId가 없어 현재는 전체 지원사업 탐색 모드입니다."}
        </p>
      </header>

      {state.kind === "loading" ? (
        <article className="ff-mobile-card">
          <p>정책 정보를 불러오는 중...</p>
        </article>
      ) : null}

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
        <>
          <article className="ff-mobile-card">
            <div className="ff-mobile-card-head">
              <h2>최우선 추천 지원사업</h2>
              {priority?.d_day ? <span className="ff-mobile-recommend-pill">{priority.d_day}</span> : null}
            </div>
            {priority ? (
              <>
                <h3>{priority.title}</h3>
                <p className="ff-mobile-meta">
                  {priority.organization || "-"} · {priority.support_type_label || "지원 유형 확인 필요"}
                </p>
                <p>{priority.recommendation_summary || priority.match_reason || "-"}</p>
                <p className="ff-mobile-meta">{priority.support_amount_text || "-"}</p>
              </>
            ) : (
              <p className="ff-mobile-empty-inline">우선 추천 정책이 없습니다.</p>
            )}
          </article>

          <article className="ff-mobile-card">
            <h2>Why check now</h2>
            {priority?.why_check_now?.length ? (
              <div className="ff-mobile-why-list">
                {priority.why_check_now.map((line) => (
                  <div key={line} className="ff-mobile-why-item">
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ff-mobile-empty-inline">확인 사유 정보가 없습니다.</p>
            )}
          </article>

          <article className="ff-mobile-card">
            <h2>신청 전 확인 항목</h2>
            {priority?.preflight_checks?.length ? (
              <div className="ff-mobile-preflight-list">
                {priority.preflight_checks.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="ff-mobile-preflight-item">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ff-mobile-empty-inline">사전 확인 항목이 없습니다.</p>
            )}
          </article>

          <article className="ff-mobile-card">
            <h2>지원사업 탐색</h2>
            <input
              className="ff-mobile-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="지원사업명, 기관, 유형 검색"
              aria-label="지원사업 검색"
            />
            <div className="ff-mobile-filter-tabs">
              <button
                type="button"
                className={`ff-mobile-filter-tab${filter === "all" ? " is-active" : ""}`}
                onClick={() => setFilter("all")}
              >
                전체
              </button>
              <button
                type="button"
                className={`ff-mobile-filter-tab${filter === "closing" ? " is-active" : ""}`}
                onClick={() => setFilter("closing")}
              >
                마감 임박
              </button>
              <button
                type="button"
                className={`ff-mobile-filter-tab${filter === "rolling" ? " is-active" : ""}`}
                onClick={() => setFilter("rolling")}
              >
                상시 모집
              </button>
            </div>

            {!model.hasData ? (
              <p className="ff-mobile-empty-inline">매칭된 정책이 없습니다.</p>
            ) : (
              <div className="ff-mobile-list">
                {model.policies.slice(0, 8).map((policy) => (
                  <div
                    key={policy.policy_id}
                    className={`ff-mobile-list-item${
                      model.urgentPolicies.some((item) => item.policy_id === policy.policy_id)
                        ? " ff-mobile-urgent-card"
                        : ""
                    }`}
                  >
                    <h3>{policy.title}</h3>
                    <p>
                      {policy.d_day || "상시 모집"} · {policy.support_type_label || "지원 유형 확인 필요"}
                    </p>
                    <p>
                      {hasAnalysisContext
                        ? policy.recommendation_summary || policy.match_reason || "-"
                        : "전체 탐색 정책"}
                    </p>
                    <button
                      type="button"
                      className="ff-mobile-secondary-btn"
                      onClick={() =>
                        navigate(
                          buildWebSupportProjectsPath({
                            analysisId: flowContext.analysisId,
                            equipmentId: flowContext.equipmentId,
                            policyId: policy.policy_id,
                          }),
                        )
                      }
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
        </>
      ) : null}
    </section>
  )
}
