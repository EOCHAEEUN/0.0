import { ChevronRight } from "lucide-react"

import type { SupportProjectsLiveDiscovery, SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import "../supportProjects.workspace.css"

function statusTone(status: string) {
  if (status === "조건 확인 필요") return "neutral"
  return "pass"
}

function supportTone(label: string) {
  if (label === "금융지원") return "finance"
  if (label === "비금융 연계지원") return "linked"
  if (label === "직접 지원금" || label === "바우처 지원") return "subsidy"
  return "neutral"
}

export function LiveDiscoverySection({
  liveDiscovery,
  onOpenDetail,
  onViewAll,
}: {
  liveDiscovery: SupportProjectsLiveDiscovery
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
  onViewAll: () => void
}) {
  if (liveDiscovery.error) {
    return (
      <section className="ff-support-live-section">
        <header className="ff-support-section-head with-action">
          <div>
            <h2>그 외 신청 가능성이 있는 정책</h2>
            <p>현재 정책 DB 기준으로 기업 기본 조건에 맞는 추가 후보입니다.</p>
          </div>
        </header>
        <div className="ff-support-live-error">{liveDiscovery.error}</div>
      </section>
    )
  }

  return (
    <section className="ff-support-live-section">
      <header className="ff-support-section-head with-action">
        <div>
          <h2>그 외 신청 가능성이 있는 정책</h2>
          <p>
            현재 정책 DB 기준 추가 후보 · 분석 당시 추천 결과와는 별도로 최신 정책 DB에서 탐색한
            후보입니다.
          </p>
        </div>
        <button type="button" className="ff-support-link-btn" onClick={onViewAll}>
          전체 신청 가능 정책 보기
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </header>

      {liveDiscovery.items.length === 0 ? (
        <div className="ff-support-live-empty">
          현재 기본 조건으로 추가 후보를 찾지 못했습니다.
        </div>
      ) : (
        <div className="ff-support-live-grid">
          {liveDiscovery.items.map((policy) => (
            <article key={policy.policy_id} className="ff-support-live-card">
              <div className="ff-support-badge-row">
                <span className={`ff-support-status-badge ${statusTone(policy.application_status)}`}>
                  {policy.application_status}
                </span>
                <span className={`ff-support-type-badge ${supportTone(policy.support_type_label)}`}>
                  {policy.support_type_label}
                </span>
              </div>
              <h3>{policy.title}</h3>
              <p>
                {policy.organization} · {policy.deadline_display || "상시/공고문 확인"}
              </p>
              <button
                type="button"
                className="ff-support-link-btn"
                onClick={() => onOpenDetail(policy)}
              >
                상세 보기
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
