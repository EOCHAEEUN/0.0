import { useMemo, useState, type ReactNode } from "react"

import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import { getDdayTone } from "../supportProjectsDday"
import "../supportProjects.workspace.css"

type CandidateTab = "priority" | "all"

function scoreWidth(score: number | null) {
  if (score === null) return 0
  return Math.max(0, Math.min(100, score))
}

function buildCandidateMeta(policy: SupportProjectsPolicyCard) {
  const parts: ReactNode[] = []

  if (policy.organization) parts.push(policy.organization)
  if (policy.scenario_label) parts.push(policy.scenario_label)

  if (policy.d_day && policy.d_day !== "-") {
    parts.push(
      <span key="dday" className={`ff-support-dday-pill ${getDdayTone(policy)}`}>
        {policy.d_day}
      </span>,
    )
  }

  if (policy.match_score !== null) {
    parts.push(`매칭 적합도 ${policy.match_score}점`)
  }

  return parts
}

export function PolicyCandidateList({
  candidates,
  allMatched,
  matchedTotal,
  onOpenDetail,
}: {
  candidates: SupportProjectsPolicyCard[]
  allMatched: SupportProjectsPolicyCard[]
  matchedTotal: number
  onOpenDetail: (policy: SupportProjectsPolicyCard) => void
}) {
  const [activeTab, setActiveTab] = useState<CandidateTab>(candidates.length > 0 ? "priority" : "all")

  const priorityCount = candidates.length
  const allCount = allMatched.length > 0 ? allMatched.length : matchedTotal

  const visiblePolicies = useMemo(() => {
    if (activeTab === "all") {
      return allMatched.length > 0 ? allMatched : candidates
    }
    return candidates
  }, [activeTab, allMatched, candidates])

  if (priorityCount === 0 && allCount === 0) return null

  return (
    <section className="ff-support-candidate-section">
      <header className="ff-support-candidate-head">
        <div>
          <p className="ff-support-candidate-eyebrow">다른 지원사업 비교</p>
          <h3>
            {activeTab === "priority"
              ? `우선순위 후보 ${priorityCount}건`
              : `전체 매칭 ${allCount}건`}
          </h3>
        </div>
        <div className="ff-support-candidate-tabs" role="tablist" aria-label="지원사업 목록 보기">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "priority"}
            className={activeTab === "priority" ? "active" : ""}
            onClick={() => setActiveTab("priority")}
          >
            우선순위 후보 {priorityCount}건
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            className={activeTab === "all" ? "active" : ""}
            onClick={() => setActiveTab("all")}
          >
            전체 매칭 {allCount}건
          </button>
        </div>
      </header>

      <div className="ff-support-candidate-list">
        {visiblePolicies.map((policy, index) => {
          const metaParts = buildCandidateMeta(policy)

          return (
            <article key={`${activeTab}-${policy.policy_id}`} className="ff-support-candidate-row">
              <span className="ff-support-candidate-rank">{policy.rank ?? index + 1}</span>

              <div className="ff-support-candidate-main">
                <strong>{policy.title}</strong>
                <p>
                  {metaParts.map((part, partIndex) => (
                    <span key={`${policy.policy_id}-meta-${partIndex}`}>
                      {partIndex > 0 ? " · " : null}
                      {part}
                    </span>
                  ))}
                </p>
              </div>

              <div className="ff-support-candidate-score">
                <div className="ff-support-score-bar compact">
                  <span style={{ width: `${scoreWidth(policy.match_score)}%` }} />
                </div>
                <strong>{policy.match_score ?? "-"}</strong>
              </div>

              <button
                type="button"
                className="ff-support-candidate-link"
                onClick={() => onOpenDetail(policy)}
              >
                추가 검토 →
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
