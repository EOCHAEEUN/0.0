import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import { getDdayTone } from "../supportProjectsDday"
import "../supportProjects.workspace.css"

function scoreWidth(score: number | null) {
  if (score === null) return 0
  return Math.max(0, Math.min(100, score))
}

function fitTone(status: string) {
  if (status === "적합") return "ok"
  if (status === "검토 필요") return "warn"
  return "neutral"
}

export function PriorityPolicyCard({
  policy,
  priorityBadge,
  secondaryBadge,
  onOpenDetail,
}: {
  policy: SupportProjectsPolicyCard
  priorityBadge: string
  secondaryBadge: string
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
}) {
  const metaParts = [policy.organization, policy.support_amount_text, policy.deadline_display || policy.deadline]

  return (
    <section className="ff-support-priority-card">
      <div className="ff-support-priority-tabs" aria-label="정책 분류">
        <span className="active">{priorityBadge}</span>
        <span>{secondaryBadge}</span>
      </div>

      <div className="ff-support-priority-grid">
        <div className="ff-support-priority-main">
          <p className="ff-support-priority-meta">
            {metaParts.filter(Boolean).join(" · ")}
            {policy.d_day && policy.d_day !== "-" ? (
              <>
                {" · "}
                <span className={`ff-support-dday-pill ${getDdayTone(policy)}`}>{policy.d_day}</span>
              </>
            ) : null}
          </p>
          <h2>{policy.title}</h2>

          {policy.tags.length > 0 ? (
            <div className="ff-support-tag-row">
              {policy.tags.map((tag) => (
                <span
                  key={tag}
                  className={`ff-support-tag ${tag.includes("교체") ? "accent" : ""}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="ff-support-reason-box">
            <strong>이 공고를 먼저 보는 이유</strong>
            <p>{policy.match_reason}</p>
          </div>
        </div>

        <aside className="ff-support-priority-side">
          <div className="ff-support-score-head">
            <span>매칭 적합도</span>
            <span className={`ff-support-fit-badge ${fitTone(policy.fit_status)}`}>
              {policy.fit_status}
            </span>
          </div>

          {policy.match_score !== null ? (
            <>
              <strong className="ff-support-score-value gold">
                {policy.match_score}
                <em>/ 100</em>
              </strong>
              <div className="ff-support-score-bar featured">
                <span style={{ width: `${scoreWidth(policy.match_score)}%` }} />
              </div>
            </>
          ) : (
            <p className="ff-support-score-missing">점수 정보 없음</p>
          )}

          {policy.condition_links.length > 0 ? (
            <div className="ff-support-condition-links">
              <strong>현재 조건과 연결된 항목</strong>
              <ul>
                {policy.condition_links.map((link) => (
                  <li key={`${link.label}-${link.value}`}>
                    <span className="ff-support-check">✓</span>
                    <div>
                      <em>{link.label}</em>
                      <b>{link.value}</b>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="ff-support-priority-actions">
        <button type="button" className="ff-support-primary-btn" onClick={() => onOpenDetail(policy)}>
          지원 조건 확인하기 →
        </button>
      </div>
    </section>
  )
}
