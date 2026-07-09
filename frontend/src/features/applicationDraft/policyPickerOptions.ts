import type { MatchedPolicy, WorkspacePolicyOption } from "./applicationDraft.contract"
import { readAnalysisData } from "./applicationDraft.utils"
import type { ApplicationDraftWorkspaceModel } from "./hooks/useApplicationDraftWorkspace"
import { mapSupportProjectsOverview } from "../support/supportProjectsOverview.mapper"
import type { SupportProjectsPolicyCard } from "../support/supportProjectsOverview.types"

const POLICY_OPTION_LIMIT = 5

function policyIdFromUnknown(policy: {
  policy_id?: string | null
  id?: string | number | null
}) {
  return String(policy.policy_id || policy.id || "").trim()
}

function policyTitleFromUnknown(policy: {
  title?: string | null
  policy_title?: string | null
}) {
  return String(policy.title || policy.policy_title || "지원사업").trim()
}

function appendPolicyOption(
  deduped: Map<string, WorkspacePolicyOption>,
  option: WorkspacePolicyOption,
) {
  const policyId = String(option.policy_id || "").trim()
  if (!policyId || deduped.has(policyId) || deduped.size >= POLICY_OPTION_LIMIT) return
  deduped.set(policyId, option)
}

function appendMatchedPolicy(
  deduped: Map<string, WorkspacePolicyOption>,
  policy: MatchedPolicy,
) {
  const policyId = policyIdFromUnknown(policy)
  if (!policyId) return
  appendPolicyOption(deduped, {
    policy_id: policyId,
    title: policyTitleFromUnknown(policy),
    agency: String(policy.agency || policy.organization || "").trim() || undefined,
    match_score: policy.match_score ?? policy.final_score ?? policy.hybrid_score,
  })
}

function appendOverviewCard(
  deduped: Map<string, WorkspacePolicyOption>,
  card: SupportProjectsPolicyCard,
) {
  const policyId = String(card.policy_id || "").trim()
  if (!policyId) return
  appendPolicyOption(deduped, {
    policy_id: policyId,
    title: String(card.title || "지원사업").trim(),
    deadline: card.deadline_display || card.deadline || undefined,
    agency: String(card.organization || "").trim() || undefined,
    match_score: card.match_score ?? undefined,
  })
}

export function buildPolicyOptions(
  model: ApplicationDraftWorkspaceModel,
): WorkspacePolicyOption[] {
  const deduped = new Map<string, WorkspacePolicyOption>()
  const analysisData = readAnalysisData()

  ;(model.data?.policy?.options ?? []).forEach((policy) => {
    appendPolicyOption(deduped, {
      policy_id: String(policy.policy_id || "").trim(),
      title: String(policy.title || "정책명 미확인").trim(),
      deadline: policy.deadline,
      agency: policy.agency,
      match_score: policy.match_score,
    })
  })

  ;(analysisData.matched_policies ?? []).forEach((policy) => {
    appendMatchedPolicy(deduped, policy)
  })

  const policiesField = analysisData.policies
  if (Array.isArray(policiesField)) {
    policiesField.forEach((policy) => appendMatchedPolicy(deduped, policy))
  }

  ;(analysisData.raw_candidates ?? []).forEach((policy) => {
    appendMatchedPolicy(deduped, policy)
  })

  const currentPolicyId = String(model.data?.policy_id || "").trim()
  const currentTitle = String(model.data?.policy?.title || "").trim()
  if (currentPolicyId && currentTitle) {
    appendPolicyOption(deduped, {
      policy_id: currentPolicyId,
      title: currentTitle,
      deadline: model.data?.policy?.deadline,
    })
  }

  return Array.from(deduped.values()).slice(0, POLICY_OPTION_LIMIT)
}

export function mergeOverviewPolicyOptions(
  current: WorkspacePolicyOption[],
  overviewPayload: unknown,
  params: { companyId: string; analysisId?: string },
): WorkspacePolicyOption[] {
  const deduped = new Map<string, WorkspacePolicyOption>()
  current.forEach((option) => appendPolicyOption(deduped, option))

  const overview = mapSupportProjectsOverview(overviewPayload, params)
  if (overview.priorityPolicy) {
    appendOverviewCard(deduped, overview.priorityPolicy)
  }
  overview.priorityPolicies.forEach((card) => appendOverviewCard(deduped, card))
  overview.allMatched.forEach((card) => appendOverviewCard(deduped, card))

  return Array.from(deduped.values()).slice(0, POLICY_OPTION_LIMIT)
}

export function policyPickerNote(count: number) {
  if (count <= 0) {
    return "신청서에 반영할 지원사업을 선택하세요."
  }
  if (count >= POLICY_OPTION_LIMIT) {
    return `신청서에 반영할 지원사업을 선택하세요. (추천 top${POLICY_OPTION_LIMIT})`
  }
  return `신청서에 반영할 지원사업을 선택하세요. (추천 ${count}건)`
}
