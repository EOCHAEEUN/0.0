import type { ScenarioKey, StatusTone } from "../applicationDraft.contract"

export function InfoTip({ children }: { children: string }) {
  return (
    <span className="ff-draft-info-tip">
      <span aria-hidden="true">i</span>
      <em>{children}</em>
    </span>
  )
}

export function StatCard({
  label,
  value,
  caption,
}: {
  label: string
  value: string
  caption: string
}) {
  const compactValue = value.length >= 4

  return (
    <div className="ff-draft-hero-stat">
      <span>{label}</span>
      <strong className={compactValue ? "is-compact" : ""}>{value}</strong>
      <small>{caption}</small>
    </div>
  )
}

export function StepCard({
  index,
  title,
  description,
}: {
  index: string
  title: string
  description: string
}) {
  return (
    <div className="ff-draft-step-card">
      <strong>{index}</strong>
      <span>{title}</span>
      <em>{description}</em>
    </div>
  )
}

export function ScenarioToggle({
  selected,
  onChange,
}: {
  selected: ScenarioKey
  onChange: (value: ScenarioKey) => void
}) {
  return (
    <div className="ff-draft-scenario-toggle" aria-label="투자 시나리오 선택">
      <button
        type="button"
        className={selected === "A" ? "is-active" : ""}
        onClick={() => onChange("A")}
      >
        <b>A</b>
        전체교체
      </button>
      <button
        type="button"
        className={selected === "B" ? "is-active" : ""}
        onClick={() => onChange("B")}
      >
        <b>B</b>
        부분교체
      </button>
    </div>
  )
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone
  children: string
}) {
  return <span className={`ff-draft-status ${tone}`}>{children}</span>
}
