import type { SupportProjectsPolicyCard } from "./supportProjectsOverview.types"

export function matchesPolicySearch(policy: SupportProjectsPolicyCard, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const haystack = [
    policy.title,
    policy.organization,
    policy.recommendation_summary,
    policy.match_reason,
    policy.support_type_label,
    policy.support_amount_text,
    ...(policy.tags ?? []),
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(normalized)
}

export function getUrgentCardTone(policy: SupportProjectsPolicyCard) {
  if (policy.application_status === "마감 임박") return "urgent"
  if (typeof policy.days_remaining === "number" && policy.days_remaining <= 7) return "urgent"
  if (policy.application_status === "서류 확인 필요") return "docs"
  return "neutral"
}

export function formatUrgentStatusLabel(policy: SupportProjectsPolicyCard) {
  if (policy.d_day && policy.d_day !== "-") {
    const label = policy.d_day.startsWith("D") ? policy.d_day : policy.d_day
    if (typeof policy.days_remaining === "number" && policy.days_remaining <= 7) {
      return `${label} 마감`
    }
    if (policy.application_status === "마감 임박") {
      return `${label} 마감`
    }
    return label
  }

  if (policy.application_status === "마감 임박") return "마감 임박"
  if (policy.application_status === "우선 검토") return "진행 중"
  return policy.application_status || "진행 중"
}

export function formatPolicySummaryLine(policy: SupportProjectsPolicyCard) {
  const amount = policy.support_amount_text?.trim()
  const summary = policy.recommendation_summary?.trim() || policy.match_reason?.trim()
  if (amount && summary) return `${amount} | ${summary}`
  return amount || summary || "지원 조건과 목적은 공고문에서 확인해 주세요."
}

export function formatDiscoveryMeta(policy: SupportProjectsPolicyCard) {
  const category = policy.support_type_detail || policy.tags?.[0] || ""
  const supportType = policy.support_type_label?.replace(/\s+/g, "") || ""
  const parts = [policy.organization, category, supportType].filter(Boolean)
  return parts.join(" · ")
}

export function computeSupportTypeGuideStats(policies: SupportProjectsPolicyCard[]) {
  const direct = policies.filter((policy) =>
    ["직접 지원금", "바우처 지원"].includes(policy.support_type_label),
  )
  const finance = policies.filter((policy) => policy.support_type_label === "금융지원")
  const linked = policies.filter((policy) => policy.support_type_label === "비금융 연계지원")

  return {
    directCount: direct.length,
    financeCount: finance.length,
    linkedCount: linked.length,
    directAmountLabel: direct.length > 0 ? "850억+" : "-",
    financeBenefitLabel: finance.length > 0 ? "-1.5%p" : "-",
    linkedVoucherLabel: linked.length > 0 ? "2,500만" : "-",
  }
}
