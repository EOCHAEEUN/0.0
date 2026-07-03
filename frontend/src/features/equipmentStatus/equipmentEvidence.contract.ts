export type EvidenceType =
  | "안전장치 점검"
  | "유지보수"
  | "안전교육"

export type EvidenceReviewStatus = "draft" | "approved" | "rejected"

export type EvidenceStructuredItemStatus =
  | "good"
  | "improved"
  | "needs_improvement"
  | "planned"
  | "reference"

export type EvidenceStructuredItem = {
  item_name: string
  status: EvidenceStructuredItemStatus
  note: string
}

export type EquipmentEvidenceRecord = {
  evidence_id: string
  attachment_id: string
  equipment_id: string
  company_id: string
  user_id: string
  evidence_type: EvidenceType
  evidence_date: string
  title: string
  summary: string
  structured_items: EvidenceStructuredItem[]
  application_sentence: string
  source_page?: string | null
  review_status: EvidenceReviewStatus
  rejection_reason?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  is_demo: boolean
  created_at?: string | null
  updated_at?: string | null
  attachment_filename?: string | null
}

export type EquipmentEvidenceRecordsResponse = {
  equipment_id: string
  company_id: string
  total_count: number
  records: EquipmentEvidenceRecord[]
}

export type CreateEquipmentEvidencePayload = {
  attachment_id: string
  evidence_type: EvidenceType
  evidence_date: string
  title: string
  summary: string
  structured_items: EvidenceStructuredItem[]
  application_sentence: string
  source_page?: string
  review_status: EvidenceReviewStatus
  rejection_reason?: string
  is_demo?: boolean
}

export type UpdateEquipmentEvidencePayload = Partial<CreateEquipmentEvidencePayload>

export type ApplicationSection =
  | "safety_improvement"
  | "safety_management"
  | "maintenance_history"
  | "maintenance_plan"
  | "supporting_evidence"
  | "other"

export type ApplicationEvidenceSelection = {
  selection_id: string
  evidence_id: string
  company_id: string
  equipment_id: string
  analysis_id: string
  policy_id: string
  application_section: ApplicationSection
  reflected_text: string
  is_selected: boolean
  selected_by?: string | null
  selected_at?: string | null
  evidence?: EquipmentEvidenceRecord | null
}

export type ApplicationEvidenceSelectionsResponse = {
  analysis_id: string
  policy_id: string
  equipment_id: string
  total_count: number
  selected_count: number
  selections: ApplicationEvidenceSelection[]
}

export type UpsertApplicationEvidenceSelectionPayload = {
  evidence_id: string
  company_id: string
  equipment_id: string
  analysis_id: string
  policy_id: string
  application_section: ApplicationSection
  reflected_text: string
  is_selected: boolean
}

export const EVIDENCE_TYPE_OPTIONS: Array<{ value: EvidenceType; label: string }> = [
  { value: "안전장치 점검", label: "안전장치 점검" },
  { value: "유지보수", label: "유지보수" },
  { value: "안전교육", label: "안전교육" },
]

export const EVIDENCE_STRUCTURED_ITEM_STATUS_OPTIONS: Array<{
  value: EvidenceStructuredItemStatus
  label: string
}> = [
  { value: "good", label: "양호" },
  { value: "improved", label: "개선완료" },
  { value: "needs_improvement", label: "개선필요" },
  { value: "planned", label: "예정" },
  { value: "reference", label: "참고" },
]

export const APPLICATION_SECTION_OPTIONS: Array<{ value: ApplicationSection; label: string }> =
  [
    { value: "safety_improvement", label: "안전개선 필요성" },
    { value: "safety_management", label: "안전관리 계획" },
    { value: "maintenance_history", label: "정비 이력" },
    { value: "maintenance_plan", label: "유지관리 계획" },
    { value: "supporting_evidence", label: "제출 증빙" },
    { value: "other", label: "기타" },
  ]

export const REVIEW_STATUS_LABELS: Record<EvidenceReviewStatus, string> = {
  draft: "검토 필요",
  approved: "승인 완료",
  rejected: "반려됨",
}

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  "안전장치 점검": "안전장치 점검",
  유지보수: "유지보수",
  안전교육: "안전교육",
}
