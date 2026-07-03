import type { SupportProjectsCounts } from "../supportProjectsOverview.types"
import "../supportProjects.workspace.css"

function formatCount(value: number) {
  return `${Math.max(0, value)}건`
}

function renderHeroTitle(title: string) {
  const match = title.match(/(\d+건)/)
  if (!match || match.index === undefined) return title

  const before = title.slice(0, match.index)
  const after = title.slice(match.index + match[0].length)

  return (
    <>
      {before}
      <span className="ff-support-hero-highlight">{match[1]}</span>
      {after}
    </>
  )
}

export function SupportProjectsHero({
  heroTitle,
  heroSubtitle,
  counts,
}: {
  heroTitle: string
  heroSubtitle: string
  counts: SupportProjectsCounts
}) {
  const metrics = [
    { label: "정책 DB 전체", value: formatCount(counts.policy_db_total) },
    { label: "내 조건 매칭", value: formatCount(counts.matched_total) },
    { label: "우선 검토 정책", value: formatCount(counts.priority_policy_count) },
    { label: "마감임박", value: formatCount(counts.closing_soon_count) },
  ]

  return (
    <section className="ff-support-hero">
      <div className="ff-support-hero-grid">
        <div className="ff-support-hero-copy">
          <span className="ff-support-hero-badge">FACTOFIT AI ENGI</span>
          <h1 className="ff-support-hero-title">{renderHeroTitle(heroTitle)}</h1>
          <p className="ff-support-hero-subtitle">{heroSubtitle}</p>
        </div>

        <div className="ff-support-hero-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="ff-support-hero-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
