import type { SupportProjectsPolicyCard } from "./supportProjectsOverview.types"

export type SupportProjectsDdayTone = "past" | "urgent" | "soon" | "normal"

function parseDaysFromLabel(label: string) {
  const match = label.match(/D-(\d+)/i)
  if (!match) return null
  const days = Number(match[1])
  return Number.isFinite(days) ? days : null
}

export function getDdayTone(policy: SupportProjectsPolicyCard): SupportProjectsDdayTone {
  const label = policy.d_day?.trim() ?? ""

  if (policy.is_past_deadline || label === "마감됨" || label.startsWith("D+")) {
    return "past"
  }

  const days =
    policy.days_remaining !== null && policy.days_remaining !== undefined
      ? policy.days_remaining
      : parseDaysFromLabel(label)

  if (days === null) return "normal"
  if (days <= 3) return "urgent"
  if (days <= 14) return "soon"
  return "normal"
}
