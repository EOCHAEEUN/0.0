import type { SupportProjectsFilter, SupportProjectsPolicyCard } from "./supportProjectsOverview.types"

export function matchesSupportProjectsFilter(
  policy: SupportProjectsPolicyCard,
  filter: SupportProjectsFilter,
) {
  if (filter === "all") return true
  if (filter === "priority") return policy.application_status === "우선 검토"
  if (filter === "documents") return policy.application_status === "서류 확인 필요"
  if (filter === "closing") return policy.application_status === "마감 임박"
  if (filter === "finance") {
    return (
      policy.support_type_label === "금융지원" ||
      policy.support_type_label === "비금융 연계지원"
    )
  }
  return true
}

export function filterPriorityPolicies(
  priorityPolicy: SupportProjectsPolicyCard | null,
  priorityPolicies: SupportProjectsPolicyCard[],
  filter: SupportProjectsFilter,
) {
  const visibleMain =
    priorityPolicy && matchesSupportProjectsFilter(priorityPolicy, filter) ? priorityPolicy : null
  const visibleList = priorityPolicies.filter((policy) =>
    matchesSupportProjectsFilter(policy, filter),
  )
  return { visibleMain, visibleList }
}
