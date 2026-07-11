import { useMemo, useState } from "react"

import { buildPolicyOptions } from "../policyPickerOptions"
import type { ApplicationDraftWorkspaceModel } from "./useApplicationDraftWorkspace"

export function usePolicyPicker(model: ApplicationDraftWorkspaceModel) {
  const [pendingPolicyId, setPendingPolicyId] = useState("")
  const [error, setError] = useState("")

  const items = useMemo(() => buildPolicyOptions(model), [model])
  const currentPolicyId = String(model.data?.policy_id || "").trim()
  const currentPolicy = items.find((item) => item.policy_id === currentPolicyId) ?? null

  const selectPolicy = async (policyId: string) => {
    if (!policyId || model.isGeneratingDraft) return false
    if (policyId === currentPolicyId) return true

    setError("")
    setPendingPolicyId(policyId)
    try {
      await model.applyPolicyAndRegenerate(policyId)
      return true
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "지원사업 변경 반영에 실패했습니다.",
      )
      return false
    } finally {
      setPendingPolicyId("")
    }
  }

  return { items, currentPolicyId, currentPolicy, pendingPolicyId, error, selectPolicy }
}
