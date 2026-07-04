import type { SupportProjectsPolicyCard } from "./supportProjectsOverview.types"

export type EquipmentGroup = "all" | "cnc" | "press" | "injection" | "other"

export type EquipmentGroupOption = {
  value: EquipmentGroup
  label: string
  categories: string[]
}

export const EQUIPMENT_GROUP_OPTIONS: EquipmentGroupOption[] = [
  { value: "all", label: "전체 설비", categories: [] },
  { value: "cnc", label: "CNC 장비", categories: ["cnc"] },
  { value: "press", label: "프레스 장비", categories: ["press"] },
  { value: "injection", label: "사출 장비", categories: ["injection"] },
  {
    value: "other",
    label: "기타 설비",
    categories: ["etc", "compressor", "welding", "unsupported"],
  },
]

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  cnc: ["cnc", "공작", "가공", "정밀", "machining"],
  press: ["press", "프레스", "금형", "스탬핑", "stamp"],
  injection: ["injection", "사출", "사출성형", "성형", "molding"],
  etc: ["etc", "기타"],
  compressor: ["compressor", "컴프레서", "압축기"],
  welding: ["welding", "용접"],
  unsupported: ["unsupported"],
}

const CORE_GROUPS: EquipmentGroup[] = ["cnc", "press", "injection"]

export function isEquipmentGroup(value: string | null | undefined): value is EquipmentGroup {
  return EQUIPMENT_GROUP_OPTIONS.some((option) => option.value === value)
}

export function getEquipmentGroupLabel(value: EquipmentGroup) {
  return EQUIPMENT_GROUP_OPTIONS.find((option) => option.value === value)?.label ?? "전체 설비"
}

export function resolveEquipmentGroupFromCategory(category: string | null | undefined): EquipmentGroup {
  const normalized = (category ?? "").trim().toLowerCase()
  if (!normalized || normalized === "선택 필요") return "all"
  if (normalized === "cnc" || normalized.includes("cnc") || normalized.includes("공작")) return "cnc"
  if (normalized === "press" || normalized.includes("press") || normalized.includes("프레스")) {
    return "press"
  }
  if (normalized === "injection" || normalized.includes("injection") || normalized.includes("사출")) {
    return "injection"
  }
  if (
    ["etc", "compressor", "welding", "unsupported"].some(
      (token) => normalized === token || normalized.includes(token),
    )
  ) {
    return "other"
  }
  return "other"
}

function buildPolicyHaystack(policy: SupportProjectsPolicyCard) {
  return [
    policy.title,
    policy.organization,
    policy.recommendation_summary,
    policy.match_reason,
    policy.support_type_label,
    policy.support_type_detail,
    policy.support_amount_text,
    ...(policy.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function matchesCategoryKeywords(haystack: string, category: string) {
  const keywords = CATEGORY_KEYWORDS[category] ?? [category]
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
}

function matchesEquipmentGroupKeywords(policy: SupportProjectsPolicyCard, group: EquipmentGroup) {
  if (group === "all") return true

  const haystack = buildPolicyHaystack(policy)
  const option = EQUIPMENT_GROUP_OPTIONS.find((entry) => entry.value === group)
  if (!option) return true

  return option.categories.some((category) => matchesCategoryKeywords(haystack, category))
}

function matchesCoreEquipmentGroup(policy: SupportProjectsPolicyCard, group: EquipmentGroup) {
  if (!CORE_GROUPS.includes(group)) return false
  const haystack = buildPolicyHaystack(policy)
  const option = EQUIPMENT_GROUP_OPTIONS.find((entry) => entry.value === group)
  if (!option) return false
  return option.categories.some((category) => matchesCategoryKeywords(haystack, category))
}

export function matchesEquipmentGroupFilter(
  policy: SupportProjectsPolicyCard,
  group: EquipmentGroup,
  options?: { defaultGroup?: EquipmentGroup },
) {
  if (group === "all") return true
  if (options?.defaultGroup && group === options.defaultGroup) return true

  if (group === "other") {
    const matchesCore = CORE_GROUPS.some((coreGroup) => matchesCoreEquipmentGroup(policy, coreGroup))
    if (matchesCore) return false
    return matchesEquipmentGroupKeywords(policy, "other")
  }

  return matchesEquipmentGroupKeywords(policy, group)
}

export function matchesSupportTypeFilter(policy: SupportProjectsPolicyCard, supportType: string) {
  if (!supportType || supportType === "all") return true

  const label = policy.support_type_label.replace(/\s+/g, "")
  if (supportType === "subsidy") {
    return ["직접지원금", "바우처지원"].includes(label)
  }
  if (supportType === "finance") {
    return label === "금융지원"
  }
  if (supportType === "linked") {
    return label === "비금융연계지원"
  }
  return true
}

export function matchesPurposeFilter(policy: SupportProjectsPolicyCard, purpose: string) {
  if (!purpose || purpose === "all") return true

  const haystack = buildPolicyHaystack(policy)
  if (purpose === "equipment") {
    return /설비|자동화|스마트공장|생산/.test(haystack)
  }
  if (purpose === "digital") {
    return /디지털|dx|스마트|데이터|ai|iot/.test(haystack)
  }
  if (purpose === "safety") {
    return /안전|환경|esg|보건/.test(haystack)
  }
  return true
}
