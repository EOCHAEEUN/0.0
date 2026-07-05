import { useEffect, useState } from "react"
import type { SupportProjectsPolicyCard } from "../supportProjectsOverview.types"
import type { SupportProject } from "../supportProjects.contract"
import { fetchSupportPolicyDetail } from "../supportProjects.api"
import { PolicyDetailDialog } from "./SupportProjectDialogs"

function buildInitialSupportContent(policy: SupportProjectsPolicyCard) {
  const parts: string[] = []
  if (policy.summary) parts.push(policy.summary)

  for (const line of policy.why_check_now) {
    if (line.startsWith("지원 내용:")) {
      parts.push(line.replace(/^지원 내용:\s*/, "").trim())
    }
  }

  if (parts.length === 0 && policy.recommendation_summary) {
    parts.push(policy.recommendation_summary)
  }

  return parts.join("\n\n")
}

export function mapPolicyCardToSupportProject(policy: SupportProjectsPolicyCard): SupportProject {
  const scenarioLabel =
    policy.scenario_label === "부분교체"
      ? "부분교체"
      : policy.scenario_label === "전체교체"
        ? "전체교체"
        : "전체교체"

  const supportContent = buildInitialSupportContent(policy)

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
    category: policy.tags[0] || policy.support_type_detail || "",
    policyCategory: policy.support_type_label || policy.tags[0] || "",
    description: policy.recommendation_summary || policy.match_reason,
    supportContent,
    reasonText: policy.match_reason,
    reasons: policy.match_reason ? [policy.match_reason] : [],
    tags: policy.tags,
    tone: "blue",
    scenario: scenarioLabel === "부분교체" ? "B" : "A",
    scenarioLabel,
    sourceUrl: policy.url || "",
    whyCheckNow: policy.why_check_now,
    preflightChecks: policy.preflight_checks,
    detailLoading: true,
  }
}

function mergePolicyDetail(
  project: SupportProject,
  detail: NonNullable<Awaited<ReturnType<typeof fetchSupportPolicyDetail>>>,
): SupportProject {
  const supportContent =
    detail.support_content ||
    detail.summary ||
    detail.support_items_summary ||
    project.supportContent

  const policyCategory = [detail.policy_category, detail.policy_subcategory]
    .filter(Boolean)
    .join(" · ")

  return {
    ...project,
    title: detail.title || project.title,
    agency: detail.organization || project.agency,
    deadline: detail.deadline_display || detail.deadline || project.deadline,
    deadlineRaw: detail.deadline || project.deadlineRaw,
    postedDate: detail.posted_date || project.postedDate || "공고 등록일 미확인",
    amount: detail.max_amount_actual || project.amount,
    category: policyCategory || project.category,
    policyCategory: policyCategory || project.policyCategory,
    supportContent: supportContent || "지원내용 준비 중",
    sourceUrl: detail.url || project.sourceUrl,
    eligibilityText: detail.eligibility_text || undefined,
    detailLoading: false,
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
  const [project, setProject] = useState<SupportProject | null>(null)

  useEffect(() => {
    if (!policy) {
      setProject(null)
      return
    }

    let ignore = false
    const initial = mapPolicyCardToSupportProject(policy)
    setProject(initial)

    void fetchSupportPolicyDetail(policy.policy_id)
      .then((detail) => {
        if (ignore) return
        if (detail) {
          setProject((current) => (current ? mergePolicyDetail(current, detail) : current))
          return
        }
        setProject((current) => (current ? { ...current, detailLoading: false } : current))
      })
      .catch(() => {
        if (ignore) return
        setProject((current) => (current ? { ...current, detailLoading: false } : current))
      })

    return () => {
      ignore = true
    }
  }, [policy])

  if (!policy || !project) return null

  return (
    <PolicyDetailDialog
      project={project}
      onClose={onClose}
      onCreateDraft={onCreateDraft}
    />
  )
}
