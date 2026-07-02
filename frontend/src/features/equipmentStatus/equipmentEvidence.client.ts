import {
  createApplicationEvidenceSelection,
  deleteApplicationEvidenceSelection,
  fetchApplicationEvidenceSelections,
  updateApplicationEvidenceSelection,
} from "./applicationEvidenceSelections.api"
import {
  mockCreateApplicationEvidenceSelection,
  mockDeleteApplicationEvidenceSelection,
  mockFetchApplicationEvidenceSelections,
  mockSaveApplicationEvidenceSelections,
  mockUpdateApplicationEvidenceSelection,
} from "./applicationEvidenceSelections.mock"
import { EQUIPMENT_EVIDENCE_USE_MOCK } from "./equipmentEvidence.config"
import type {
  UpsertApplicationEvidenceSelectionPayload,
} from "./equipmentEvidence.contract"
import {
  createEquipmentEvidenceRecord,
  deleteEquipmentEvidenceRecord,
  fetchEquipmentEvidenceRecords,
  updateEquipmentEvidenceRecord,
} from "./equipmentEvidence.api"
import type {
  CreateEquipmentEvidencePayload,
  UpdateEquipmentEvidencePayload,
} from "./equipmentEvidence.contract"
import {
  mockCreateEquipmentEvidenceRecord,
  mockDeleteEquipmentEvidenceRecord,
  mockFetchEquipmentEvidenceRecords,
  mockUpdateEquipmentEvidenceRecord,
  seedMockEquipmentEvidenceRecords,
} from "./equipmentEvidence.mock"

export async function getEquipmentEvidenceRecords(equipmentId: string) {
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    return mockFetchEquipmentEvidenceRecords(equipmentId)
  }
  return fetchEquipmentEvidenceRecords(equipmentId)
}

export async function saveEquipmentEvidenceRecord(params: {
  equipmentId: string
  evidenceId?: string
  payload: CreateEquipmentEvidencePayload | UpdateEquipmentEvidencePayload
}) {
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    if (params.evidenceId) {
      return mockUpdateEquipmentEvidenceRecord({
        equipmentId: params.equipmentId,
        evidenceId: params.evidenceId,
        payload: params.payload,
      })
    }
    return mockCreateEquipmentEvidenceRecord({
      equipmentId: params.equipmentId,
      payload: params.payload as CreateEquipmentEvidencePayload,
    })
  }

  if (params.evidenceId) {
    return updateEquipmentEvidenceRecord({
      equipmentId: params.equipmentId,
      evidenceId: params.evidenceId,
      payload: params.payload,
    })
  }
  return createEquipmentEvidenceRecord({
    equipmentId: params.equipmentId,
    payload: params.payload as CreateEquipmentEvidencePayload,
  })
}

export async function removeEquipmentEvidenceRecord(params: {
  equipmentId: string
  evidenceId: string
}) {
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    return mockDeleteEquipmentEvidenceRecord(params)
  }
  return deleteEquipmentEvidenceRecord(params)
}

export async function getApplicationEvidenceSelections(params: {
  analysisId: string
  policyId: string
  equipmentId: string
}) {
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    return mockFetchApplicationEvidenceSelections(params)
  }
  return fetchApplicationEvidenceSelections(params)
}

export async function saveApplicationEvidenceSelection(
  payload: UpsertApplicationEvidenceSelectionPayload,
) {
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    return mockCreateApplicationEvidenceSelection(payload)
  }
  return createApplicationEvidenceSelection(payload)
}

export async function patchApplicationEvidenceSelection(params: {
  selectionId: string
  payload: Partial<UpsertApplicationEvidenceSelectionPayload>
}) {
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    return mockUpdateApplicationEvidenceSelection(params)
  }
  return updateApplicationEvidenceSelection(params)
}

export async function removeApplicationEvidenceSelection(selectionId: string) {
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    return mockDeleteApplicationEvidenceSelection(selectionId)
  }
  return deleteApplicationEvidenceSelection(selectionId)
}

export async function saveApplicationEvidenceSelectionBatch(params: {
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
  if (EQUIPMENT_EVIDENCE_USE_MOCK) {
    return mockSaveApplicationEvidenceSelections(params)
  }

  const existing = await fetchApplicationEvidenceSelections({
    analysisId: params.analysisId,
    policyId: params.policyId,
    equipmentId: params.equipmentId,
  })

  for (const selection of existing.selections) {
    await deleteApplicationEvidenceSelection(selection.selection_id)
  }

  for (const item of params.items.filter((entry) => entry.is_selected)) {
    await createApplicationEvidenceSelection({
      evidence_id: item.evidence_id,
      company_id: params.companyId,
      equipment_id: params.equipmentId,
      analysis_id: params.analysisId,
      policy_id: params.policyId,
      application_section: item.application_section,
      reflected_text: item.reflected_text,
      is_selected: true,
    })
  }

  return fetchApplicationEvidenceSelections({
    analysisId: params.analysisId,
    policyId: params.policyId,
    equipmentId: params.equipmentId,
  })
}

export function initializeEquipmentEvidenceMockSeed(params: {
  equipmentId: string
  companyId: string
  attachmentId?: string
  attachmentFilename?: string
}) {
  if (!EQUIPMENT_EVIDENCE_USE_MOCK) return
  seedMockEquipmentEvidenceRecords(params)
}

export { EQUIPMENT_EVIDENCE_USE_MOCK }
