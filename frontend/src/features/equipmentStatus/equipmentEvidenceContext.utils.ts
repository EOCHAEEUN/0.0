import { readAnalysisData } from "../applicationDraft/applicationDraft.utils"
import { POLICY_SELECTION_STORAGE_KEYS } from "../applicationDraft/applicationDraft.constants"

function readLocalStorage(key: string) {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(key)?.trim() || ""
}

function readPolicyIdFromStorage() {
  for (const key of POLICY_SELECTION_STORAGE_KEYS) {
    const raw = readLocalStorage(key)
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as { policy_id?: string; id?: string }
      const policyId = parsed.policy_id || parsed.id
      if (policyId) return String(policyId).trim()
    } catch {
      if (raw.length > 8) return raw
    }
  }
  return readLocalStorage("factofit_policy_id")
}

export function readApplicationContextIds() {
  const analysisData = readAnalysisData() as ReturnType<typeof readAnalysisData> & {
    analysis_id?: string
    analysisId?: string
    company_id?: string
    companyId?: string
  }
  const analysisId =
    readLocalStorage("factofit_analysis_id") ||
    String(analysisData.analysis_id || analysisData.analysisId || "").trim()
  const policyId = readPolicyIdFromStorage()
  const companyId =
    readLocalStorage("factofit_company_id") ||
    String(analysisData.company_id || analysisData.companyId || "").trim()

  return {
    analysisId,
    policyId,
    companyId,
  }
}

export function readPolicyDisplayName(policyId: string) {
  if (!policyId) return ""
  const matched = readAnalysisData().matched_policies ?? []
  const found = matched.find(
    (policy) =>
      String(policy.policy_id || policy.id || "").trim() === policyId.trim(),
  )
  return (
    found?.policy_title ||
    found?.title ||
    ""
  )
}

export function hasApplicationSelectionContext(params: {
  analysisId?: string
  policyId?: string
  equipmentId?: string
}) {
  return Boolean(params.analysisId && params.policyId && params.equipmentId)
}
