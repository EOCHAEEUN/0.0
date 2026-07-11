import { Hexagon, Star } from "lucide-react"
import { useState } from "react"

import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { buildPolicyOptions, policyPickerNote } from "../policyPickerOptions"

export const APPLICATION_DRAFT_RECOMMEND_POLICIES_ID = "ff-draft-recommend-policies"

export function ApplicationDraftRecommendedPolicies({
  model,
  highlighted = false,
}: {
  model: ApplicationDraftWorkspaceModel
  highlighted?: boolean
}) {
  const [pendingPolicyId, setPendingPolicyId] = useState("")
  const [error, setError] = useState("")

  const items = buildPolicyOptions(model)
  const currentPolicyId = String(model.data?.policy_id || "").trim()

  const handleSelect = async (policyId: string) => {
    if (!policyId || model.isGeneratingDraft) return
    if (policyId === currentPolicyId) return

    setError("")
    setPendingPolicyId(policyId)
    try {
      await model.applyPolicyAndRegenerate(policyId)
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "지원사업 변경 반영에 실패했습니다.",
      )
    } finally {
      setPendingPolicyId("")
    }
  }

  if (items.length === 0) {
    return (
      <article
        id={APPLICATION_DRAFT_RECOMMEND_POLICIES_ID}
        className="ff-card ff-draft-recommend-card"
      >
        <h4>적합 지원 사업 추천</h4>
        <p className="ff-draft-recommend-empty">
          분석 결과에서 추천 지원사업을 찾지 못했습니다. 지원사업 메뉴에서 다시
          확인해 주세요.
        </p>
      </article>
    )
  }

  return (
    <article
      id={APPLICATION_DRAFT_RECOMMEND_POLICIES_ID}
      className={`ff-card ff-draft-recommend-card ${highlighted ? "is-highlighted" : ""}`}
    >
      <h4>적합 지원 사업 추천</h4>
      <p className="ff-draft-recommend-note">{policyPickerNote(items.length)}</p>
      <ul className="ff-draft-recommend-list">
        {items.map((policy, index) => {
          const id = policy.policy_id
          const isPrimary = id === currentPolicyId || (!currentPolicyId && index === 0)
          const isPending = pendingPolicyId === id

          return (
            <li
              key={id}
              className={`ff-draft-recommend-item ${isPrimary ? "is-selected" : ""}`}
            >
              <button
                type="button"
                className="ff-draft-recommend-item-btn"
                onClick={() => void handleSelect(id)}
                disabled={model.isGeneratingDraft}
                aria-pressed={isPrimary}
              >
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
                  <strong>{policy.title}</strong>
                  <p>
                    {[
                      policy.agency,
                      policy.deadline ? `마감일: ${policy.deadline}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "지원 조건은 공고 원문을 확인해 주세요."}
                  </p>
                </div>
                {isPrimary ? (
                  <span className="ff-draft-recommend-badge">현재 적용</span>
                ) : isPending ? (
                  <span className="ff-draft-recommend-badge is-pending">반영 중...</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      {error ? <p className="ff-draft-policy-picker-error">{error}</p> : null}
    </article>
  )
}
