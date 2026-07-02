import type {
  CreateEquipmentEvidencePayload,
  EquipmentEvidenceRecord,
  EquipmentEvidenceRecordsResponse,
  UpdateEquipmentEvidencePayload,
} from "./equipmentEvidence.contract"

type MockStore = {
  records: EquipmentEvidenceRecord[]
}

const stores = new Map<string, MockStore>()

function getStore(equipmentId: string): MockStore {
  const existing = stores.get(equipmentId)
  if (existing) return existing
  const created: MockStore = { records: [] }
  stores.set(equipmentId, created)
  return created
}

function nowIso() {
  return new Date().toISOString()
}

function createId() {
  return crypto.randomUUID()
}

export function seedMockEquipmentEvidenceRecords(params: {
  equipmentId: string
  companyId: string
  userId?: string
  attachmentId?: string
  attachmentFilename?: string
}) {
  const store = getStore(params.equipmentId)
  if (store.records.length > 0) return

  const attachmentId = params.attachmentId || createId()
  const userId = params.userId || "mock-user"

  store.records = [
    {
      evidence_id: createId(),
      attachment_id: attachmentId,
      equipment_id: params.equipmentId,
      company_id: params.companyId,
      user_id: userId,
      evidence_type: "safety_inspection",
      evidence_date: "2026-06-15",
      title: "비상정지 버튼 및 안전커버 점검",
      summary:
        "비상정지 버튼 작동과 안전커버 상태를 점검했습니다. 경고표지 보강이 필요한 구역을 확인했습니다.",
      structured_items: [
        {
          item_name: "비상정지 버튼 작동",
          status: "good",
          note: "점검일 기준 즉시 정지 기능 정상 확인",
        },
        {
          item_name: "안전커버 상태",
          status: "improved",
          note: "누유 부위 개선 조치 완료",
        },
      ],
      application_sentence:
        "설비 안전점검 결과 비상정지 기능과 안전커버 상태가 정상으로 확인되었으며, 경고표지 보강 및 누유 부위 개선 조치를 완료하였습니다.",
      source_page: "1",
      review_status: "approved",
      reviewed_by: userId,
      reviewed_at: nowIso(),
      is_demo: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      attachment_filename: params.attachmentFilename || "안전점검 및 개선 확인서.png",
    },
    {
      evidence_id: createId(),
      attachment_id: attachmentId,
      equipment_id: params.equipmentId,
      company_id: params.companyId,
      user_id: userId,
      evidence_type: "safety_improvement",
      evidence_date: "2026-06-20",
      title: "경고표지 보강 계획",
      summary: "경고표지 보강 일정과 담당자를 정리한 초안입니다.",
      structured_items: [
        {
          item_name: "경고표지 교체",
          status: "planned",
          note: "7월 1주차 교체 예정",
        },
      ],
      application_sentence: "",
      review_status: "draft",
      is_demo: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      attachment_filename: params.attachmentFilename || "안전점검 및 개선 확인서.png",
    },
    {
      evidence_id: createId(),
      attachment_id: createId(),
      equipment_id: params.equipmentId,
      company_id: params.companyId,
      user_id: userId,
      evidence_type: "maintenance_record",
      evidence_date: "2026-05-10",
      title: "UI 테스트용 더미 정비기록",
      summary: "화면 테스트용 더미 자료입니다.",
      structured_items: [],
      application_sentence: "더미 문장",
      review_status: "approved",
      is_demo: true,
      created_at: nowIso(),
      updated_at: nowIso(),
      attachment_filename: "demo-maintenance.png",
    },
  ]
}

export async function mockFetchEquipmentEvidenceRecords(
  equipmentId: string,
): Promise<EquipmentEvidenceRecordsResponse> {
  await delay()
  const store = getStore(equipmentId)
  return {
    equipment_id: equipmentId,
    company_id: store.records[0]?.company_id || "",
    total_count: store.records.length,
    records: [...store.records],
  }
}

export async function mockCreateEquipmentEvidenceRecord(params: {
  equipmentId: string
  payload: CreateEquipmentEvidencePayload
}) {
  await delay()
  const store = getStore(params.equipmentId)
  const record: EquipmentEvidenceRecord = {
    evidence_id: createId(),
    equipment_id: params.equipmentId,
    company_id: store.records[0]?.company_id || "",
    user_id: "mock-user",
    attachment_id: params.payload.attachment_id,
    evidence_type: params.payload.evidence_type,
    evidence_date: params.payload.evidence_date,
    title: params.payload.title,
    summary: params.payload.summary,
    structured_items: params.payload.structured_items,
    application_sentence: params.payload.application_sentence,
    source_page: params.payload.source_page,
    review_status: params.payload.review_status,
    rejection_reason: params.payload.rejection_reason,
    is_demo: Boolean(params.payload.is_demo),
    created_at: nowIso(),
    updated_at: nowIso(),
  }
  store.records.unshift(record)
  return { record, total_count: store.records.length }
}

export async function mockUpdateEquipmentEvidenceRecord(params: {
  equipmentId: string
  evidenceId: string
  payload: UpdateEquipmentEvidencePayload
}) {
  await delay()
  const store = getStore(params.equipmentId)
  const index = store.records.findIndex((record) => record.evidence_id === params.evidenceId)
  if (index < 0) throw new Error("근거를 찾을 수 없습니다.")
  store.records[index] = {
    ...store.records[index],
    ...params.payload,
    updated_at: nowIso(),
    reviewed_at:
      params.payload.review_status === "approved" ||
      params.payload.review_status === "rejected"
        ? nowIso()
        : store.records[index].reviewed_at,
  }
  return { record: store.records[index] }
}

export async function mockDeleteEquipmentEvidenceRecord(params: {
  equipmentId: string
  evidenceId: string
}) {
  await delay()
  const store = getStore(params.equipmentId)
  store.records = store.records.filter((record) => record.evidence_id !== params.evidenceId)
  return { deleted_evidence_id: params.evidenceId, total_count: store.records.length }
}

function delay(ms = 180) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function resetMockEquipmentEvidenceStores() {
  stores.clear()
}
