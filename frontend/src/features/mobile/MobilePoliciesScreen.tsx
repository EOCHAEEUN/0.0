import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  MoreVertical,
  Search,
  Settings,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { useSupportProjectsOverview } from "../support/hooks/useSupportProjectsOverview"
import {
  formatPolicySummaryLine,
  formatUrgentStatusLabel,
  matchesPolicySearch,
} from "../support/supportProjectsDisplay.utils"
import { matchesSupportTypeFilter } from "../support/supportProjectsEquipmentGroups"
import type { SupportProjectsPolicyCard } from "../support/supportProjectsOverview.types"
import { MobileTopBar } from "./components/MobileTopBar"
import { buildMobilePath, buildWebSupportProjectsPath, resolveMobileFlowContext } from "./mobileFlowContext"
import { mapMobilePoliciesViewModel } from "./mobileApp.mapper"
import type { MobilePriorityPolicyDetail } from "./mobileApp.types"

type PoliciesTab = "priority" | "byType"

const SUPPORT_TYPE_TABS = [
  { id: "all", label: "전체" },
  { id: "subsidy", label: "직접지원" },
  { id: "finance", label: "금융지원" },
  { id: "linked", label: "비금융" },
] as const

type SupportTypeFilter = (typeof SUPPORT_TYPE_TABS)[number]["id"]

const RECOMMENDED_VISIBLE_COUNT = 3
const URGENT_CAROUSEL_HINT_COUNT = 2

function dedupePolicies(items: SupportProjectsPolicyCard[]) {
  const map = new Map<string, SupportProjectsPolicyCard>()
  items.forEach((item) => {
    if (!item.policy_id || map.has(item.policy_id)) return
    map.set(item.policy_id, item)
  })
  return [...map.values()]
}

function isReviewNowPolicy(policy: SupportProjectsPolicyCard) {
  if (policy.is_past_deadline) return false
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 30) return true
  if (policy.application_status === "마감 임박" || policy.application_status === "우선 검토") {
    return true
  }
  return Boolean(policy.d_day && policy.d_day !== "-")
}

function formatSupportTypeShort(label: string) {
  const normalized = label.replace(/\s+/g, "")
  if (normalized.includes("직접")) return "직접지원"
  if (normalized.includes("금융")) return "금융지원"
  if (normalized.includes("비금융")) return "비금융"
  return label || "지원 유형"
}

function formatAmountShort(policy: SupportProjectsPolicyCard) {
  const amount = policy.support_amount_text?.trim()
  if (!amount || amount === "공고문 확인 필요") return "-"
  return amount.replace(/^최대\s*/, "")
}

function resolveDdayTone(policy: SupportProjectsPolicyCard) {
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 7) return "urgent"
  if (policy.application_status === "마감 임박") return "urgent"
  return "normal"
}

function isAttentionValue(value: string) {
  return /확인 필요|미확인|공고문/.test(value)
}

function PriorityPolicyPanel({
  detail,
  onOpenDetail,
}: {
  detail: MobilePriorityPolicyDetail
  onOpenDetail: () => void
}) {
  return (
    <article className="ff-mobile-policy-analysis-card">
      <div className="ff-mobile-policy-analysis-tags">
        <span className="ff-mobile-policy-analysis-tag is-primary">{detail.rankStatusLabel}</span>
        <span className="ff-mobile-policy-analysis-tag">{detail.supportTypeLabel}</span>
      </div>

      <h2 className="ff-mobile-policy-analysis-title">{detail.displayTitle}</h2>

      <div className="ff-mobile-policy-analysis-meta">
        <span>
          <Settings size={15} strokeWidth={2.1} aria-hidden="true" />
          {detail.equipmentLabel}
        </span>
        <span className="ff-mobile-policy-analysis-deadline-row">
          <CalendarDays size={15} strokeWidth={2.1} aria-hidden="true" />
          {detail.deadlineLabel}
          {detail.ddayLabel ? (
            <span className={`ff-mobile-policy-dday is-${detail.ddayTone}`}>{detail.ddayLabel}</span>
          ) : null}
        </span>
      </div>

      <div className="ff-mobile-policy-reason-panel">
        <div className="ff-mobile-policy-reason-head">
          <Info size={14} strokeWidth={2.4} aria-hidden="true" />
          <strong>추천 사유</strong>
        </div>
        <p>{detail.recommendationReason}</p>
      </div>

      <div className="ff-mobile-policy-why-section">
        <strong>Why check now?</strong>
        {detail.whyCheckNow.length > 0 ? (
          <ul>
            {detail.whyCheckNow.map((line) => (
              <li key={line}>
                <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ff-mobile-empty-inline">확인 사유 정보가 없습니다.</p>
        )}
      </div>

      <div className="ff-mobile-policy-preflight-panel">
        <h3>신청 전 확인할 항목</h3>
        <ul>
          {detail.preflightChecks.map((item) => (
            <li key={`${item.label}-${item.value}`}>
              <span>{item.label}</span>
              <strong className={isAttentionValue(item.value) ? "is-attention" : undefined}>
                {item.value}
              </strong>
            </li>
          ))}
        </ul>
        <button type="button" className="ff-mobile-policy-analysis-cta" onClick={onOpenDetail}>
          {detail.actionLabel.replace(/\s*→?\s*$/, "")}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}

function PolicyByTypePanel({
  policies,
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  onOpenPolicy,
  onOpenDiscovery,
}: {
  policies: SupportProjectsPolicyCard[]
  query: string
  typeFilter: SupportTypeFilter
  onQueryChange: (value: string) => void
  onTypeFilterChange: (value: SupportTypeFilter) => void
  onOpenPolicy: (policyId: string) => void
  onOpenDiscovery: () => void
}) {
  const [showAllRecommended, setShowAllRecommended] = useState(false)

  const filteredPolicies = useMemo(
    () =>
      policies.filter(
        (policy) => matchesPolicySearch(policy, query) && matchesSupportTypeFilter(policy, typeFilter),
      ),
    [policies, query, typeFilter],
  )

  const reviewNowPolicies = useMemo(() => {
    return filteredPolicies
      .filter(isReviewNowPolicy)
      .sort((left, right) => {
        const leftDays = left.days_remaining ?? 9999
        const rightDays = right.days_remaining ?? 9999
        return leftDays - rightDays
      })
  }, [filteredPolicies])

  const recommendedPolicies = useMemo(() => {
    const reviewIds = new Set(reviewNowPolicies.map((policy) => policy.policy_id))
    return filteredPolicies.filter((policy) => !reviewIds.has(policy.policy_id))
  }, [filteredPolicies, reviewNowPolicies])

  const visibleRecommended = showAllRecommended
    ? recommendedPolicies
    : recommendedPolicies.slice(0, RECOMMENDED_VISIBLE_COUNT)
  const hiddenRecommendedCount = Math.max(0, recommendedPolicies.length - RECOMMENDED_VISIBLE_COUNT)
  const hiddenUrgentCount = Math.max(0, reviewNowPolicies.length - URGENT_CAROUSEL_HINT_COUNT)

  return (
    <div className="ff-mobile-policies-by-type">
      <label className="ff-mobile-policy-search-wrap">
        <Search size={16} strokeWidth={2.1} aria-hidden="true" />
        <input
          className="ff-mobile-policy-search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="지원사업 검색..."
          aria-label="지원사업 검색"
        />
      </label>

      <div className="ff-mobile-policy-category-tabs" role="tablist" aria-label="지원 유형">
        {SUPPORT_TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={typeFilter === tab.id}
            className={`ff-mobile-policy-category-tab${typeFilter === tab.id ? " is-active" : ""}`}
            onClick={() => onTypeFilterChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reviewNowPolicies.length > 0 ? (
        <section className="ff-mobile-policy-urgent-section">
          <div className="ff-mobile-policy-urgent-head">
            <div>
              <span className="ff-mobile-policy-urgent-label">URGENT</span>
              <h2>지금 검토할 지원사업</h2>
            </div>
            {hiddenUrgentCount > 0 ? (
              <button type="button" className="ff-mobile-policy-more-link" onClick={onOpenDiscovery}>
                +{hiddenUrgentCount}건 더보기
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="ff-mobile-policy-urgent-scroll">
            {reviewNowPolicies.map((policy) => (
              <article key={policy.policy_id} className="ff-mobile-policy-urgent-card">
                <div className="ff-mobile-policy-urgent-card-top">
                  <span
                    className={`ff-mobile-policy-urgent-badge is-${resolveDdayTone(policy) === "urgent" ? "deadline" : "progress"}`}
                  >
                    {formatUrgentStatusLabel(policy)}
                  </span>
                  <button type="button" className="ff-mobile-policy-card-menu" aria-label="메뉴">
                    <MoreVertical size={16} strokeWidth={2.1} />
                  </button>
                </div>
                <h3>{policy.title}</h3>
                <p>{formatPolicySummaryLine(policy)}</p>
                {policy.tags.length > 0 ? (
                  <div className="ff-mobile-policy-tag-row">
                    {policy.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="ff-mobile-policy-tag-chip">
                        {tag.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="ff-mobile-policy-urgent-cta"
                  onClick={() => onOpenPolicy(policy.policy_id)}
                >
                  상세 검토
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ff-mobile-policy-recommend-card">
        <header className="ff-mobile-policy-recommend-head">
          <span className="ff-mobile-policy-recommend-icon" aria-hidden="true">
            <Lightbulb size={16} strokeWidth={2.2} />
          </span>
          <div>
            <h2>추천 정책 리스트</h2>
            <p>기업 정보 기반 맞춤형 추천</p>
          </div>
        </header>

        {recommendedPolicies.length === 0 ? (
          <p className="ff-mobile-empty-inline">표시할 추천 정책이 없습니다.</p>
        ) : (
          <div className="ff-mobile-policy-recommend-list">
            {visibleRecommended.map((policy) => (
              <button
                key={policy.policy_id}
                type="button"
                className="ff-mobile-policy-recommend-item"
                onClick={() => onOpenPolicy(policy.policy_id)}
              >
                <div className="ff-mobile-policy-recommend-meta">
                  <span>
                    {policy.organization || "-"} · {formatSupportTypeShort(policy.support_type_label)}
                  </span>
                  <div className="ff-mobile-policy-recommend-side">
                    <strong>{formatAmountShort(policy)}</strong>
                    {policy.d_day && policy.d_day !== "-" ? (
                      <em className={`is-${resolveDdayTone(policy)}`}>{policy.d_day}</em>
                    ) : null}
                    <ChevronRight size={14} aria-hidden="true" />
                  </div>
                </div>
                <strong className="ff-mobile-policy-recommend-title">{policy.title}</strong>
              </button>
            ))}
          </div>
        )}

        {hiddenRecommendedCount > 0 && !showAllRecommended ? (
          <button
            type="button"
            className="ff-mobile-policy-recommend-more"
            onClick={() => setShowAllRecommended(true)}
          >
            더보기 ({RECOMMENDED_VISIBLE_COUNT}/{recommendedPolicies.length})
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        ) : null}
      </section>

      {!filteredPolicies.length ? (
        <p className="ff-mobile-empty-inline">조건에 맞는 지원사업이 없습니다.</p>
      ) : null}

      <button type="button" className="ff-mobile-secondary-btn" onClick={onOpenDiscovery}>
        웹에서 전체 검색 보기
      </button>
    </div>
  )
}

export default function MobilePoliciesScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<PoliciesTab>("priority")
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<SupportTypeFilter>("all")
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
    const items = hasAnalysisContext
      ? [...overviewModel.priorityPolicies, ...overviewModel.allMatched]
      : [...overviewModel.priorityPolicies, ...overviewModel.liveDiscovery.items]
    return dedupePolicies(items)
  }, [hasAnalysisContext, overviewModel])

  const model = useMemo(
    () =>
      mapMobilePoliciesViewModel({
        policies: allPolicies,
        priorityPolicy: overviewModel?.priorityPolicy || null,
        equipmentName: workspace.equipmentName || overviewModel?.equipmentName || "대표설비",
        analysisCreatedAt: overviewModel?.analysisCreatedAt,
        heroSubtitle: overviewModel?.heroSubtitle,
      }),
    [
      allPolicies,
      overviewModel?.analysisCreatedAt,
      overviewModel?.equipmentName,
      overviewModel?.heroSubtitle,
      overviewModel?.priorityPolicy,
      workspace.equipmentName,
    ],
  )

  const openPolicyDetail = (policyId?: string) => {
    navigate(
      buildWebSupportProjectsPath({
        analysisId: flowContext.analysisId,
        equipmentId: flowContext.equipmentId,
        policyId: policyId || model.priorityPolicy?.policy_id,
      }),
    )
  }

  const openPriorityPolicyDocuments = (policyId?: string) => {
    navigate(
      buildMobilePath("/mobile/application", flowContext, {
        policyId: policyId || model.priorityPolicy?.policy_id,
      }),
    )
  }

  return (
    <section className="ff-mobile-screen ff-mobile-policies-screen">
      <MobileTopBar companyName={workspace.companyName} subtitle="지원사업" showSubtitle />

      <header className="ff-mobile-policies-header">
        <span className="ff-mobile-policies-eyebrow">{model.eyebrow}</span>
        <div className="ff-mobile-policies-title-row">
          <h1>{model.pageTitle}</h1>
          {model.updatedAtLabel ? (
            <time className="ff-mobile-policies-time">{model.updatedAtLabel}</time>
          ) : null}
        </div>
        <p>{model.pageSubtitle}</p>
      </header>

      <div className="ff-mobile-policies-tabs" role="tablist" aria-label="지원사업 분석 탭">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "priority"}
          className={`ff-mobile-policies-tab${activeTab === "priority" ? " is-active" : ""}`}
          onClick={() => setActiveTab("priority")}
        >
          최우선 지원사업
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "byType"}
          className={`ff-mobile-policies-tab${activeTab === "byType" ? " is-active" : ""}`}
          onClick={() => setActiveTab("byType")}
        >
          유형별 분석
        </button>
      </div>

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

      {state.kind !== "loading" && state.kind !== "error" && activeTab === "priority" ? (
        <div className="ff-mobile-policies-panel" role="tabpanel">
          {model.priorityDetail ? (
            <PriorityPolicyPanel
              detail={model.priorityDetail}
              onOpenDetail={() => openPriorityPolicyDocuments(model.priorityPolicy?.policy_id)}
            />
          ) : (
            <article className="ff-mobile-card">
              <p className="ff-mobile-empty-inline">우선 추천 정책이 없습니다.</p>
              <button
                type="button"
                className="ff-mobile-primary-btn"
                onClick={() => navigate(buildMobilePath("/mobile/roi", flowContext))}
              >
                ROI 분석 후 다시 확인
              </button>
            </article>
          )}
        </div>
      ) : null}

      {state.kind !== "loading" && state.kind !== "error" && activeTab === "byType" ? (
        <div className="ff-mobile-policies-panel" role="tabpanel">
          <PolicyByTypePanel
            policies={allPolicies}
            query={query}
            onQueryChange={setQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            onOpenPolicy={(policyId) => openPolicyDetail(policyId)}
            onOpenDiscovery={() =>
              navigate(
                hasAnalysisContext ? buildWebSupportProjectsPath(flowContext) : model.webSearchPath,
              )
            }
          />
        </div>
      ) : null}
    </section>
  )
}
