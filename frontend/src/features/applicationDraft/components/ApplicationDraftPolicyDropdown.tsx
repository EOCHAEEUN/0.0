import { ChevronDown, Pencil } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { ApplicationDraftWorkspaceModel } from "../hooks/useApplicationDraftWorkspace"
import { usePolicyPicker } from "../hooks/usePolicyPicker"
import { policyPickerNote } from "../policyPickerOptions"

export function ApplicationDraftPolicyDropdown({
  model,
}: {
  model: ApplicationDraftWorkspaceModel
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { items, currentPolicyId, pendingPolicyId, error, selectPolicy } = usePolicyPicker(model)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = async (policyId: string) => {
    const succeeded = await selectPolicy(policyId)
    if (succeeded) setIsOpen(false)
  }

  return (
    <div className="ff-draft-policy-change-wrap" ref={containerRef}>
      <button
        type="button"
        className="ff-draft-edit-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Pencil size={13} strokeWidth={2.2} aria-hidden="true" />
        신청 지원사업 변경
        <ChevronDown
          size={13}
          strokeWidth={2.4}
          aria-hidden="true"
          className={`ff-draft-policy-dropdown-caret ${isOpen ? "is-open" : ""}`}
        />
      </button>

      {isOpen ? (
        <div
          className="ff-draft-policy-dropdown-panel"
          role="listbox"
          aria-label="신청 지원사업 목록"
        >
          <p className="ff-draft-policy-dropdown-title">{policyPickerNote(items.length)}</p>
          {items.length > 0 ? (
            <ul className="ff-draft-policy-dropdown-list">
              {items.map((policy) => {
                const isCurrent = policy.policy_id === currentPolicyId
                const isPending = pendingPolicyId === policy.policy_id

                return (
                  <li key={policy.policy_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      className={`ff-draft-policy-dropdown-item ${isCurrent ? "is-current" : ""}`}
                      onClick={() => void handleSelect(policy.policy_id)}
                      disabled={model.isGeneratingDraft}
                    >
                      <span className="ff-draft-policy-dropdown-item-title">{policy.title}</span>
                      <span className="ff-draft-policy-dropdown-item-meta">
                        {[
                          policy.agency,
                          policy.deadline ? `마감일: ${policy.deadline}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "지원 조건은 공고 원문을 확인해 주세요."}
                      </span>
                      {isCurrent ? (
                        <span className="ff-draft-policy-dropdown-badge">현재 적용</span>
                      ) : isPending ? (
                        <span className="ff-draft-policy-dropdown-badge is-pending">
                          반영 중...
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="ff-draft-policy-dropdown-empty">
              선택 가능한 지원사업이 없습니다. 분석을 다시 실행해 주세요.
            </p>
          )}
          {error ? <p className="ff-draft-policy-picker-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
