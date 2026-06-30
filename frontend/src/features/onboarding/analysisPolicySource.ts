type PolicyRecord = Record<string, unknown>

export type CanonicalPolicyResult = {
  policies: PolicyRecord[]
  source:
    | "snapshot"
    | "analysis_matched"
    | "persisted"
    | "equipment_fallback"
    | "none"
  missingState: "ready" | "missing"
}

function asRecord(value: unknown): PolicyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PolicyRecord)
    : {}
}

function getText(record: PolicyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function getPolicyId(policy: PolicyRecord) {
  const metadata = asRecord(policy.metadata)
  return (
    getText(policy, ["policy_id", "policyId", "id", "matched_policy_id"]) ||
    getText(metadata, ["policy_id", "policyId", "id", "matched_policy_id"])
  )
}

function getPolicyTitle(policy: PolicyRecord) {
  const metadata = asRecord(policy.metadata)
  return (
    getText(policy, ["title", "policy_title", "name"]) ||
    getText(metadata, ["title", "policy_title", "name"])
  )
}

function normalizePolicies(value: unknown): PolicyRecord[] {
  if (!Array.isArray(value)) return []
  return value
    .map(asRecord)
    .filter((policy) => Boolean(getPolicyId(policy) && getPolicyTitle(policy)))
}

function extractSnapshotPolicies(snapshot: unknown): PolicyRecord[] {
  const snapshotRecord = asRecord(snapshot)
  return normalizePolicies(snapshotRecord.policies)
}

export function resolveCanonicalPolicies(params: {
  analysisId?: string | null
  roiSnapshot?: unknown
  matchedPolicies?: unknown
  persistedPolicies?: unknown
  allowEquipmentFallback?: boolean
  equipmentFallbackPolicies?: unknown
}): CanonicalPolicyResult {
  const hasAnalysisId = Boolean(params.analysisId && String(params.analysisId).trim())

  const snapshotPolicies = extractSnapshotPolicies(params.roiSnapshot)
  if (snapshotPolicies.length > 0) {
    return { policies: snapshotPolicies, source: "snapshot", missingState: "ready" }
  }

  const analysisMatchedPolicies = normalizePolicies(params.matchedPolicies)
  if (analysisMatchedPolicies.length > 0) {
    return {
      policies: analysisMatchedPolicies,
      source: "analysis_matched",
      missingState: "ready",
    }
  }

  const persistedPolicies = normalizePolicies(params.persistedPolicies)
  if (persistedPolicies.length > 0) {
    return { policies: persistedPolicies, source: "persisted", missingState: "ready" }
  }

  // analysis_id가 존재하는데 정책이 없으면 비어 있어야 하며 equipment fallback 금지
  if (hasAnalysisId) {
    return { policies: [], source: "none", missingState: "missing" }
  }

  if (params.allowEquipmentFallback) {
    const equipmentPolicies = normalizePolicies(params.equipmentFallbackPolicies)
    if (equipmentPolicies.length > 0) {
      return {
        policies: equipmentPolicies,
        source: "equipment_fallback",
        missingState: "ready",
      }
    }
  }

  return { policies: [], source: "none", missingState: "missing" }
}
