import { Hexagon, Star } from "lucide-react"

import type { MatchedPolicy } from "../applicationDraft.contract"
import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { buildPolicyOptions } from "../policyPickerOptions"
function policyTitle(policy: MatchedPolicy) {
  return String(policy.title || policy.policy_title || "지원사업").trim()
}

function policySubtitle(policy: MatchedPolicy) {
  const metadata = policy.metadata as Record<string, unknown> | undefined
  const ratio =
    metadata?.support_ratio ||
    metadata?.subsidy_rate ||
    metadata?.max_support_ratio

  if (ratio) {
    const text = String(ratio).includes("%") ? String(ratio) : `최대 ${ratio}%`
    return `지원 비율: ${text}`
  }

  if (policy.max_amount_manwon) {
    return `지원 한도: ${Math.round(Number(policy.max_amount_manwon)).toLocaleString()}만원`
  }

  if (policy.agency || policy.organization) {
    return String(policy.agency || policy.organization)
  }

  return "지원 조건은 공고 원문을 확인해 주세요."
}

export function ApplicationDraftRecommendedPolicies({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const items = buildPolicyOptions(model).map((policy) => ({
    policy_id: policy.policy_id,
    title: policy.title,
    organization: policy.agency,
  })) as MatchedPolicy[]
  if (items.length === 0) {
    return (
      <article className="ff-card ff-draft-recommend-card">
        <h4>적합 지원 사업 추천</h4>
        <p className="ff-draft-recommend-empty">
          분석 결과에서 추천 지원사업을 찾지 못했습니다. 지원사업 메뉴에서 다시
          확인해 주세요.
        </p>
      </article>
    )
  }

  return (
    <article className="ff-card ff-draft-recommend-card">
      <h4>적합 지원 사업 추천</h4>
      <ul className="ff-draft-recommend-list">
        {items.map((policy, index) => {
          const id = String(policy.policy_id || policy.id || policyTitle(policy))
          const isPrimary = id === model.data?.policy_id || index === 0

          return (
            <li key={id} className="ff-draft-recommend-item">
              <span
                className={`ff-draft-recommend-icon ${isPrimary ? "is-primary" : "is-secondary"}`}
                aria-hidden="true"
              >
                {isPrimary ? (
                  <Star size={15} strokeWidth={2.2} fill="currentColor" />
                ) : (
                  <Hexagon size={15} strokeWidth={2.1} />
                )}
              </span>
              <div className="ff-draft-recommend-copy">
                <strong>{policyTitle(policy)}</strong>
                <p>{policySubtitle(policy)}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
