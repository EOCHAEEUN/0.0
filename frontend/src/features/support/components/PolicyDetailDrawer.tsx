import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import type { SupportProject } from "../supportProjects.contract"
import { PolicyDetailDialog } from "./SupportProjectDialogs"

function formatNoticeDateLabel(value?: string | null, suffix = "등록") {
  if (!value) return ""
  const match = String(value).match(/(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/)
  if (!match) return ""
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${suffix}`
}

function resolvePostedDate(policy: SupportProjectsPolicyCard) {
  if (policy.notice_date_label) return policy.notice_date_label

  const directNotice =
    formatNoticeDateLabel(policy.posted_at) ||
    formatNoticeDateLabel(policy.notice_date) ||
    formatNoticeDateLabel(policy.published_at)
  if (directNotice) return directNotice

  const startNotice =
    formatNoticeDateLabel(policy.application_start_date) ||
    formatNoticeDateLabel(policy.start_date)
  if (startNotice) return startNotice

  const createdNotice = formatNoticeDateLabel(policy.created_at, "등록 추정")
  return createdNotice || "공고문 확인 필요"
}

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
    postedDate: resolvePostedDate(policy),
    amount: policy.support_amount_text,
    amountValueManwon: null,
    fitScore: 0,
    category: policy.tags[0] || "",
    policyCategory: policy.tags[0] || "",
    description: policy.summary || policy.match_reason,
    supportContent: policy.summary || "",
    fundingDetailLines: policy.funding_detail_lines ?? [],
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
