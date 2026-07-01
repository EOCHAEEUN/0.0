import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import type { SupportProject } from "../supportProjects.contract"
import { PolicyDetailDialog } from "./SupportProjectDialogs"

export function mapPolicyCardToSupportProject(policy: SupportProjectsPolicyCard): SupportProject {
  const scenarioLabel =
    policy.scenario_label === "부분교체"
      ? "부분교체"
      : policy.scenario_label === "전체교체"
        ? "전체교체"
        : "전체교체"

  return {
    id: policy.rank ?? 1,
    rawId: policy.policy_id,
    title: policy.title,
    agency: policy.organization,
    deadline: policy.deadline_display || policy.deadline || "-",
    deadlineRaw: policy.deadline || "",
    postedDate: "",
    amount: policy.support_amount_text,
    amountValueManwon: null,
    fitScore: policy.match_score ?? 0,
    category: policy.tags[0] || "",
    policyCategory: policy.tags[0] || "",
    description: policy.summary || policy.match_reason,
    supportContent: policy.summary || "",
    reasonText: policy.match_reason,
    reasons: policy.match_reason ? [policy.match_reason] : [],
    tags: policy.tags,
    tone: "blue",
    scenario: scenarioLabel === "부분교체" ? "B" : "A",
    scenarioLabel,
    sourceUrl: policy.url || "",
  }
}

export function PolicyDetailDrawer({
  policy,
  onClose,
  onCreateDraft,
}: {
  policy: SupportProjectsPolicyCard | null
  onClose: () => void
  onCreateDraft?: (project: SupportProject) => void
}) {
  if (!policy) return null

  return (
    <PolicyDetailDialog
      project={mapPolicyCardToSupportProject(policy)}
      onClose={onClose}
      onCreateDraft={onCreateDraft}
    />
  )
}
