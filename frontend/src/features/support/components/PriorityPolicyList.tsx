import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import "../supportProjects.workspace.css"

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

export function PriorityPolicyList({
  policies,
  onOpenDetail,
}: {
  policies: SupportProjectsPolicyCard[]
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
}) {
  if (policies.length === 0) return null

  return (
    <section className="ff-support-priority-list-section">
      <header className="ff-support-section-head">
        <h2>AI가 우선 검토할 지원사업 {policies.length}건</h2>
      </header>

      <div className="ff-support-priority-list">
        {policies.map((policy) => (
          <article key={policy.policy_id} className="ff-support-priority-list-row">
            <div className="ff-support-priority-list-left">
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
    </section>
  )
}
