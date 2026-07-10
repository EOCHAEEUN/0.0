import type { SupportProjectsPolicyCard } from "./supportProjectsOverview.types"
import {
  matchesEquipmentGroupFilter,
  matchesPurposeFilter,
  matchesSupportTypeFilter,
  type EquipmentGroup,
} from "./supportProjectsEquipmentGroups"

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

export function matchesPolicyFilters(
  policy: SupportProjectsPolicyCard,
  filters: {
    query: string
    equipmentGroup: EquipmentGroup
    supportType: string
    purpose: string
    defaultEquipmentGroup?: EquipmentGroup
  },
) {
  return (
    matchesPolicySearch(policy, filters.query) &&
    matchesEquipmentGroupFilter(policy, filters.equipmentGroup, {
      defaultGroup: filters.defaultEquipmentGroup,
    }) &&
    matchesSupportTypeFilter(policy, filters.supportType) &&
    matchesPurposeFilter(policy, filters.purpose)
  )
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

const SUPPORT_COMPONENT_DIRECT = "direct_grant"
const SUPPORT_COMPONENT_FINANCE = "financial_support"
const SUPPORT_COMPONENT_LINKED = "non_financial_linked"

// 백엔드가 support_component_types(구조화 필드 기반 분류)를 채우지 못한 정책에 대해서만
// 기존 support_type_label 라벨을 그대로 대응시키는 레거시 폴백.
function resolvePolicySupportComponentTypes(policy: SupportProjectsPolicyCard): string[] {
  if (Array.isArray(policy.support_component_types) && policy.support_component_types.length > 0) {
    return policy.support_component_types
  }
  if (["직접 지원금", "바우처 지원"].includes(policy.support_type_label)) return [SUPPORT_COMPONENT_DIRECT]
  if (policy.support_type_label === "금융지원") return [SUPPORT_COMPONENT_FINANCE]
  if (policy.support_type_label === "비금융 연계지원") return [SUPPORT_COMPONENT_LINKED]
  return []
}

export function computeSupportTypeGuideStats(policies: SupportProjectsPolicyCard[]) {
  const directIds = new Set<string>()
  const financeIds = new Set<string>()
  const linkedIds = new Set<string>()

  for (const policy of policies) {
    if (!policy.policy_id) continue
    const types = resolvePolicySupportComponentTypes(policy)
    if (types.includes(SUPPORT_COMPONENT_DIRECT)) directIds.add(policy.policy_id)
    if (types.includes(SUPPORT_COMPONENT_FINANCE)) financeIds.add(policy.policy_id)
    if (types.includes(SUPPORT_COMPONENT_LINKED)) linkedIds.add(policy.policy_id)
  }

  return {
    directCount: directIds.size,
    financeCount: financeIds.size,
    linkedCount: linkedIds.size,
    directAmountLabel: directIds.size > 0 ? "850억+" : "-",
    financeBenefitLabel: financeIds.size > 0 ? "확인 필요" : "-",
    linkedVoucherLabel: linkedIds.size > 0 ? `연계 프로그램 ${linkedIds.size}건` : "-",
  }
}
