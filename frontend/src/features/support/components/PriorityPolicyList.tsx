import { ChevronRight, MoreVertical } from "lucide-react"
import type { RefObject } from "react"

import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import {
  formatPolicySummaryLine,
  formatUrgentStatusLabel,
  getUrgentCardTone,
} from "../supportProjectsDisplay.utils"
import "../supportProjects.workspace.css"

const VISIBLE_CARD_COUNT = 3

function statusTone(status: string) {
  if (status === "마감 임박") return "urgent"
  if (status === "서류 확인 필요") return "docs"
  if (status === "우선 검토") return "priority"
  return "neutral"
}

function supportTone(label: string) {
  if (label === "직접 지원금" || label === "바우처 지원") return "subsidy"
  if (label === "금융지원") return "finance"
  if (label === "비금융 연계지원") return "linked"
  return "neutral"
}

function getCardAccent(index: number, tone: ReturnType<typeof getUrgentCardTone>) {
  if (tone === "urgent") return "accent-urgent"
  if (tone === "docs") return "accent-docs"
  if (index === 1) return "accent-info"
  if (index === 2) return "accent-primary"
  return "accent-neutral"
}

function UrgentPolicyCard({
  policy,
  index,
  onOpenDetail,
  equipmentGroupLabel,
}: {
  policy: SupportProjectsPolicyCard
  index: number
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
  equipmentGroupLabel?: string
}) {
  const tone = getUrgentCardTone(policy)
  const accent = getCardAccent(index, tone)
  const tags =
    policy.tags.length > 0
      ? policy.tags.slice(0, 3)
      : [policy.support_type_label].filter(Boolean)
  const displayTags = equipmentGroupLabel
    ? [equipmentGroupLabel, ...tags].slice(0, 4)
    : tags

  return (
    <article className={`ff-support-urgent-card ${accent}`}>
      <div className="ff-support-urgent-card-top">
        <span className={`ff-support-urgent-status ${tone}`}>{formatUrgentStatusLabel(policy)}</span>
        <button type="button" className="ff-support-urgent-menu" aria-label="추가 옵션">
          <MoreVertical size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="ff-support-urgent-card-body">
        <h3>{policy.title}</h3>
        <p>{formatPolicySummaryLine(policy)}</p>
        {policy.match_reason ? (
          <p className="ff-support-urgent-match-reason">{policy.match_reason}</p>
        ) : null}
      </div>

      <div className="ff-support-urgent-card-foot">
        <div className="ff-support-urgent-tags">
          {displayTags.map((tag) => (
            <span key={`${policy.policy_id}-${tag}`}>{tag}</span>
          ))}
        </div>
        <button
          type="button"
          className="ff-support-urgent-action"
          onClick={() => onOpenDetail(policy)}
        >
          {policy.action_label || "상세 보기"}
        </button>
      </div>
    </article>
  )
}

export function PriorityPolicyList({
  policies,
  onOpenDetail,
  variant = "urgent-grid",
  expanded = false,
  onViewMore,
  isLoading = false,
  hasActiveSearch = false,
  equipmentGroupLabel,
  sectionRef,
}: {
  policies: SupportProjectsPolicyCard[]
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
  variant?: "urgent-grid" | "list"
  expanded?: boolean
  onViewMore?: () => void
  isLoading?: boolean
  hasActiveSearch?: boolean
  equipmentGroupLabel?: string
  sectionRef?: RefObject<HTMLElement | null>
}) {
  const sectionTitle = hasActiveSearch
    ? `검색 결과 ${policies.length}건`
    : `지금 신청을 검토할 지원사업 ${policies.length}건`

  if (variant === "list") {
    return (
      <section className="ff-support-priority-list-section" ref={sectionRef}>
        <header className="ff-support-section-head">
          <p className="ff-support-main-priority-eyebrow">AI 분석 기반 맞춤형 추천</p>
          <h2>{hasActiveSearch ? `검색 결과 ${policies.length}건` : `AI가 우선 검토할 지원사업 ${policies.length}건`}</h2>
        </header>

        {isLoading ? (
          <div className="ff-support-search-loading">지원사업을 찾는 중입니다...</div>
        ) : policies.length === 0 ? (
          <div className="ff-support-search-empty">
            <h3>조건에 맞는 지원사업을 찾지 못했습니다.</h3>
            <p>필터를 조정하거나 다른 키워드로 검색해보세요.</p>
          </div>
        ) : (
          <div className="ff-support-priority-list">
            {policies.map((policy) => (
              <article key={policy.policy_id} className="ff-support-priority-list-row">
                <div className="ff-support-priority-list-left">
                  <div className="ff-support-badge-row">
                    <span className={`ff-support-type-badge ${supportTone(policy.support_type_label)}`}>
                      {policy.support_type_label}
                    </span>
                    <span className={`ff-support-status-badge ${statusTone(policy.application_status)}`}>
                      {policy.application_status}
                    </span>
                  </div>
                  <h3>{policy.title}</h3>
                  <p>
                    {policy.organization} · {policy.deadline_display || policy.deadline || "마감일 공고문 확인"}
                  </p>
                </div>

                <div className="ff-support-priority-list-reason">
                  <p>{policy.recommendation_summary || policy.match_reason}</p>
                </div>

                <button
                  type="button"
                  className="ff-support-link-btn"
                  onClick={() => onOpenDetail(policy)}
                >
                  {policy.action_label}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  const visiblePolicies = expanded ? policies : policies.slice(0, VISIBLE_CARD_COUNT)
  const hiddenCount = Math.max(0, policies.length - VISIBLE_CARD_COUNT)

  return (
    <section className="ff-support-urgent-section" ref={sectionRef}>
      <header className="ff-support-urgent-head">
        <div>
          <p className="ff-support-main-priority-eyebrow">AI 분석 기반 맞춤형 추천</p>
          <h2>{isLoading ? "지원사업을 찾는 중입니다" : sectionTitle}</h2>
        </div>
        {hiddenCount > 0 && !expanded && onViewMore ? (
          <button type="button" className="ff-support-urgent-more" onClick={onViewMore}>
            +{hiddenCount}건 더보기
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {isLoading ? (
        <div className="ff-support-search-loading-grid" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ff-support-search-skeleton" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="ff-support-search-empty">
          <h3>조건에 맞는 지원사업을 찾지 못했습니다.</h3>
          <p>필터를 조정하거나 다른 키워드로 검색해보세요.</p>
        </div>
      ) : (
        <div className={`ff-support-urgent-grid ${expanded ? "is-expanded" : ""}`}>
          {visiblePolicies.map((policy, index) => (
            <UrgentPolicyCard
              key={policy.policy_id}
              policy={policy}
              index={index}
              onOpenDetail={onOpenDetail}
              equipmentGroupLabel={equipmentGroupLabel}
            />
          ))}
        </div>
      )}
    </section>
  )
}
