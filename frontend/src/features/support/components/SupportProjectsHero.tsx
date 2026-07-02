import type { SupportProjectsCounts, SupportProjectsFilter } from "../supportProjectsOverview.types"
import "../supportProjects.workspace.css"

const FILTERS: { id: SupportProjectsFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "priority", label: "우선 검토" },
  { id: "documents", label: "서류 확인 필요" },
  { id: "closing", label: "마감 임박" },
  { id: "finance", label: "금융·비금융 연계" },
]

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
  trustLabel,
  heroTitle,
  heroSubtitle,
  counts,
  activeFilter,
  onFilterChange,
  showFilters = true,
  variant = "hero",
}: {
  trustLabel: string
  heroTitle: string
  heroSubtitle: string
  counts: SupportProjectsCounts
  activeFilter: SupportProjectsFilter
  onFilterChange: (filter: SupportProjectsFilter) => void
  showFilters?: boolean
  variant?: "hero" | "compact"
}) {
  if (variant === "compact") {
    if (!showFilters) return null
    return (
      <section className="ff-support-filter-strip" aria-label="지원사업 필터">
        <div className="ff-support-filter-row light" role="tablist" aria-label="지원사업 필터">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.id}
              className={activeFilter === filter.id ? "is-active" : ""}
              onClick={() => onFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className="ff-support-filter-footnote" aria-hidden="true">
          정책 DB {counts.policy_db_total.toLocaleString("ko-KR")}건 · 우선 검토{" "}
          {counts.priority_policy_count}건 · 마감 임박 {counts.closing_soon_count}건
        </p>
      </section>
    )
  }

  return (
    <section className="ff-support-hero">
      <div className="ff-support-hero-copy-block">
        <span className="ff-support-hero-trust">{trustLabel}</span>
        {heroTitle ? (
          <h1 className="ff-support-hero-title">{renderHeroTitle(heroTitle)}</h1>
        ) : null}
        {heroSubtitle ? <p className="ff-support-hero-subtitle">{heroSubtitle}</p> : null}
        {showFilters ? (
          <div className="ff-support-filter-row" role="tablist" aria-label="지원사업 필터">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.id}
                className={activeFilter === filter.id ? "is-active" : ""}
                onClick={() => onFilterChange(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="ff-support-hero-footnote" aria-hidden="true">
        정책 DB {counts.policy_db_total.toLocaleString("ko-KR")}건 · 우선 검토{" "}
        {counts.priority_policy_count}건 · 마감 임박 {counts.closing_soon_count}건
      </p>
    </section>
  )
}
