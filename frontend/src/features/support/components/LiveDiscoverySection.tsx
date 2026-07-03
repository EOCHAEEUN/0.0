import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react"

import type { SupportProjectsLiveDiscovery, SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import { formatDiscoveryMeta } from "../supportProjectsDisplay.utils"
import "../supportProjects.workspace.css"

const PAGE_SIZE = 5

function ddayTone(policy: SupportProjectsPolicyCard) {
  if (policy.is_past_deadline) return "past"
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 7) return "urgent"
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 21) return "soon"
  return "normal"
}

function formatAmountLabel(policy: SupportProjectsPolicyCard) {
  const amount = policy.support_amount_text?.trim()
  if (!amount || amount === "공고문 확인 필요") return "공고문 확인"
  if (amount.startsWith("최대") || amount.startsWith("전액")) return amount
  return `최대 ${amount}`
}

export function LiveDiscoverySection({
  liveDiscovery,
  onOpenDetail,
  onViewAll,
  searchQuery = "",
}: {
  liveDiscovery: SupportProjectsLiveDiscovery
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
  onViewAll: () => void
  searchQuery?: string
}) {
  const [page, setPage] = useState(1)

  const filteredItems = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return liveDiscovery.items
    return liveDiscovery.items.filter((policy) => {
      const haystack = [
        policy.title,
        policy.organization,
        policy.support_type_label,
        policy.support_amount_text,
        ...(policy.tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [liveDiscovery.items, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleItems = filteredItems.slice(0, currentPage * PAGE_SIZE)
  const canLoadMore = currentPage < totalPages

  const banner = (
    <div className="ff-support-discovery-banner">
      <span className="ff-support-discovery-banner-icon" aria-hidden="true">
        <Lightbulb size={18} />
      </span>
      <div>
        <h2>그 외 신청 가능성이 있는 정책</h2>
        <p>기본 기업 조건과 지역 조건에 맞는 정책을 추가로 확인할 수 있습니다.</p>
      </div>
    </div>
  )

  if (liveDiscovery.error) {
    return (
      <section className="ff-support-discovery-section">
        <div className="ff-support-discovery-shell">
          {banner}
          <div className="ff-support-live-error">{liveDiscovery.error}</div>
        </div>
      </section>
    )
  }

  return (
    <section className="ff-support-discovery-section">
      <div className="ff-support-discovery-shell">
        {banner}

        {filteredItems.length === 0 ? (
          <div className="ff-support-live-empty">현재 기본 조건으로 추가 후보를 찾지 못했습니다.</div>
        ) : (
          <>
            <ul className="ff-support-discovery-list">
              {visibleItems.map((policy) => (
                <li key={policy.policy_id}>
                  <button
                    type="button"
                    className="ff-support-discovery-row"
                    onClick={() => onOpenDetail(policy)}
                  >
                    <div className="ff-support-discovery-row-main">
                      <p className="ff-support-discovery-meta">{formatDiscoveryMeta(policy)}</p>
                      <strong>{policy.title}</strong>
                    </div>

                    <div className="ff-support-discovery-row-side">
                      <div className="ff-support-discovery-status-stack">
                        <span className="ff-support-discovery-amount">{formatAmountLabel(policy)}</span>
                        <span className={`ff-support-discovery-dday ${ddayTone(policy)}`}>
                          {policy.d_day && policy.d_day !== "-" ? policy.d_day : "상시"}
                        </span>
                      </div>
                      <ChevronRight size={18} aria-hidden="true" className="ff-support-discovery-chevron" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="ff-support-discovery-foot">
              {canLoadMore ? (
                <button
                  type="button"
                  className="ff-support-discovery-more"
                  onClick={() => setPage((value) => value + 1)}
                >
                  더보기 ({currentPage}/{totalPages})
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
              ) : totalPages > 1 ? (
                <button type="button" className="ff-support-discovery-more" onClick={onViewAll}>
                  전체 신청 가능 정책 보기
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
