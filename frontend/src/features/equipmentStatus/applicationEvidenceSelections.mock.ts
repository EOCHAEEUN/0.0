import type {
  ApplicationEvidenceSelection,
  ApplicationEvidenceSelectionsResponse,
  UpsertApplicationEvidenceSelectionPayload,
} from "./equipmentEvidence.contract"

type SelectionKey = string

const selectionStores = new Map<SelectionKey, ApplicationEvidenceSelection[]>()

function buildKey(params: { analysisId: string; policyId: string; equipmentId: string }) {
  return `${params.analysisId}:${params.policyId}:${params.equipmentId}`
}

function createId() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

export async function mockFetchApplicationEvidenceSelections(params: {
  analysisId: string
  policyId: string
  equipmentId: string
}): Promise<ApplicationEvidenceSelectionsResponse> {
  await delay()
  const key = buildKey(params)
  const selections = selectionStores.get(key) || []
  return {
    analysis_id: params.analysisId,
    policy_id: params.policyId,
    equipment_id: params.equipmentId,
    total_count: selections.length,
    selected_count: selections.filter((item) => item.is_selected).length,
    selections: [...selections],
  }
}

export async function mockCreateApplicationEvidenceSelection(
  payload: UpsertApplicationEvidenceSelectionPayload,
) {
  await delay()
  const key = buildKey({
    analysisId: payload.analysis_id,
    policyId: payload.policy_id,
    equipmentId: payload.equipment_id,
  })
  const current = selectionStores.get(key) || []
  const selection: ApplicationEvidenceSelection = {
    selection_id: createId(),
    evidence_id: payload.evidence_id,
    company_id: payload.company_id,
    equipment_id: payload.equipment_id,
    analysis_id: payload.analysis_id,
    policy_id: payload.policy_id,
    application_section: payload.application_section,
    reflected_text: payload.reflected_text,
    is_selected: payload.is_selected,
    selected_at: payload.is_selected ? nowIso() : null,
  }
  current.push(selection)
  selectionStores.set(key, current)
  return { selection }
}

export async function mockUpdateApplicationEvidenceSelection(params: {
  selectionId: string
  payload: Partial<UpsertApplicationEvidenceSelectionPayload>
}) {
  await delay()
  for (const [key, selections] of selectionStores.entries()) {
    const index = selections.findIndex(
      (item) => item.selection_id === params.selectionId,
    )
    if (index < 0) continue
    selections[index] = {
      ...selections[index],
      ...params.payload,
      selected_at:
        params.payload.is_selected === false
          ? null
          : params.payload.is_selected
            ? nowIso()
            : selections[index].selected_at,
    }
    selectionStores.set(key, [...selections])
    return { selection: selections[index] }
  }
  throw new Error("선택 항목을 찾을 수 없습니다.")
}

export async function mockDeleteApplicationEvidenceSelection(selectionId: string) {
  await delay()
  for (const [key, selections] of selectionStores.entries()) {
    const next = selections.filter((item) => item.selection_id !== selectionId)
    if (next.length !== selections.length) {
      selectionStores.set(key, next)
      return { deleted_selection_id: selectionId }
    }
  }
  throw new Error("선택 항목을 찾을 수 없습니다.")
}

export async function mockSaveApplicationEvidenceSelections(params: {
  analysisId: string
  policyId: string
  equipmentId: string
  companyId: string
  items: Array<{
    evidence_id: string
    application_section: UpsertApplicationEvidenceSelectionPayload["application_section"]
    reflected_text: string
    is_selected: boolean
    selection_id?: string
  }>
}) {
  await delay()
  const key = buildKey(params)
  const next: ApplicationEvidenceSelection[] = []

  for (const item of params.items) {
    if (!item.is_selected) continue
    next.push({
      selection_id: item.selection_id || createId(),
      evidence_id: item.evidence_id,
      company_id: params.companyId,
      equipment_id: params.equipmentId,
      analysis_id: params.analysisId,
      policy_id: params.policyId,
      application_section: item.application_section,
      reflected_text: item.reflected_text,
      is_selected: true,
      selected_at: nowIso(),
    })
  }

  selectionStores.set(key, next)
  return mockFetchApplicationEvidenceSelections({
    analysisId: params.analysisId,
    policyId: params.policyId,
    equipmentId: params.equipmentId,
  })
}

function delay(ms = 180) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function resetMockApplicationEvidenceSelectionStores() {
  selectionStores.clear()
}
