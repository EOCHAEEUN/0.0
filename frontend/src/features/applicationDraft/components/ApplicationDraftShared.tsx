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

export function ReadinessStatusBadge({
  tone,
  label,
}: {
  tone: StatusTone
  label: string
}) {
  return <span className={`ff-draft-readiness-badge ${tone}`}>{label}</span>
}

export function JudgementStatusBadge({ status }: { status: string }) {
  const normalized = status.trim()
  let tone: StatusTone = "warn"

  if (
    normalized.includes("완료") ||
    normalized.includes("양호") ||
    normalized.includes("보유")
  ) {
    tone = "ok"
  } else if (
    normalized.includes("미보유") ||
    normalized.includes("부족") ||
    normalized.includes("위험")
  ) {
    tone = "need"
  } else if (normalized.includes("설치 후") || normalized.includes("준비 예정")) {
    tone = "info"
  } else if (
    normalized.includes("준비") ||
    normalized.includes("예정") ||
    normalized.includes("없음")
  ) {
    tone = "warn"
  }

  return <span className={`ff-draft-judgement-badge ${tone}`}>{normalized}</span>
}

export function EvidenceStatusBadge({
  status,
}: {
  status: "미첨부" | "일부 첨부" | "첨부됨" | "증빙 대상 없음" | string
}) {
  const tone: StatusTone =
    status === "첨부됨"
      ? "ok"
      : status === "일부 첨부"
        ? "warn"
        : status === "증빙 대상 없음"
          ? "info"
          : "need"

  return <span className={`ff-draft-evidence-badge ${tone}`}>{status}</span>
}
