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

// backend/app/services/support_projects_overview.py의 동일 상수와 반드시 맞춰야 함.
const DIRECT_GRANT_KEYWORDS = [
  "현금보조",
  "현금지원",
  "사업비 지원",
  "보조금",
  "투자비 직접 보전",
  "시설투자비",
  "설비투자비",
  "장비투자비",
]
const FINANCE_SUPPORT_KEYWORDS = ["융자", "보증", "이자지원", "이자 지원", "대출", "정책자금"]
const NON_FINANCIAL_LINKED_KEYWORDS = [
  "현물서비스",
  "컨설팅",
  "멘토링",
  "교육",
  "시험",
  "인증",
  "장비활용",
  "공동장비",
  "기술지원",
  "기술지도",
  "판로",
  "전시",
  "수출",
  "디지털 인프라",
]

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function classifySupportText(text: string | null | undefined): string | null {
  if (!text) return null
  if (containsAny(text, FINANCE_SUPPORT_KEYWORDS)) return SUPPORT_COMPONENT_FINANCE
  if (containsAny(text, NON_FINANCIAL_LINKED_KEYWORDS)) return SUPPORT_COMPONENT_LINKED
  if (containsAny(text, DIRECT_GRANT_KEYWORDS)) return SUPPORT_COMPONENT_DIRECT
  return null
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry ?? "")).filter(Boolean)
  if (value === null || value === undefined || value === "") return []
  return [String(value)]
}

function classifySupportItem(item: unknown): string | null {
  if (!item || typeof item !== "object") return classifySupportText(String(item))
  const record = item as Record<string, unknown>
  return (
    classifySupportText(record.funding_type ? String(record.funding_type) : null) ||
    classifySupportText(record.category ? String(record.category) : null) ||
    classifySupportText(record.name ? String(record.name) : null)
  )
}

// backend의 _resolve_support_component_types와 동일한 우선순위 구조화 필드 폴백.
// support_component_types가 없거나 빈 배열일 때만 사용된다.
function classifyPolicyByStructuredFields(policy: SupportProjectsPolicyCard): string[] {
  const items = Array.isArray(policy.support_items) ? policy.support_items : []
  const itemTypes = new Set(
    items.map((item) => classifySupportItem(item)).filter((v): v is string => Boolean(v)),
  )
  if (itemTypes.size > 0) return [...itemTypes]

  const types = new Set<string>()
  for (const tag of toTextList(policy.support_method)) {
    const classified = classifySupportText(tag)
    if (classified) types.add(classified)
  }

  const roiClassified = classifySupportText(policy.roi_support_type)
  if (roiClassified) types.add(roiClassified)

  const category = policy.support_primary_category ?? ""
  if (category === "금융지원") {
    types.add(SUPPORT_COMPONENT_FINANCE)
  } else if (["지원금", "바우처", "바우처 지원"].includes(category)) {
    types.add(SUPPORT_COMPONENT_DIRECT)
  } else {
    const categoryClassified = classifySupportText(category)
    if (categoryClassified) types.add(categoryClassified)
  }

  for (const tag of toTextList(policy.support_categories)) {
    const classified = classifySupportText(tag)
    if (classified) types.add(classified)
  }

  const nature = policy.policy_primary_nature ?? ""
  if (["자금지원", "융자", "보증"].some((token) => nature.includes(token))) {
    types.add(SUPPORT_COMPONENT_FINANCE)
  }

  return [...types]
}

// 우선순위: support_component_types(백엔드 분류) > 구조화 필드 프론트 폴백 > support_type_label 레거시 폴백.
function resolvePolicySupportComponentTypes(policy: SupportProjectsPolicyCard): string[] {
  if (Array.isArray(policy.support_component_types) && policy.support_component_types.length > 0) {
    return policy.support_component_types
  }

  const structured = classifyPolicyByStructuredFields(policy)
  if (structured.length > 0) return structured

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
