export type EquipmentAttachmentType =
  | "equipment_photo"
  | "equipment_spec"
  | "maintenance_record"
  | "safety_evidence"
  | "quote"

export type EquipmentAttachmentItem = {
  attachment_id: string
  equipment_id: string
  company_id: string
  attachment_type: EquipmentAttachmentType
  attachment_type_label: string
  original_filename: string
  mime_type: string
  file_size_bytes: number
  is_primary_photo: boolean
  created_at?: string | null
  updated_at?: string | null
  signed_url?: string
  preview_url?: string
  download_url?: string
}

export type EquipmentAttachmentsResponse = {
  equipment_id: string
  company_id: string
  total_count: number
  attachments: EquipmentAttachmentItem[]
}

export const EQUIPMENT_ATTACHMENT_TYPE_OPTIONS: Array<{
  value: EquipmentAttachmentType
  label: string
}> = [
  { value: "equipment_photo", label: "설비 사진" },
  { value: "equipment_spec", label: "설비 사양서" },
  { value: "maintenance_record", label: "정비 기록" },
  { value: "safety_evidence", label: "안전 증빙" },
  { value: "quote", label: "견적서" },
]

export const EQUIPMENT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024

export const EQUIPMENT_ATTACHMENT_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,.hwp,.hwpx,image/jpeg,image/png,image/webp,application/pdf"

export const EQUIPMENT_PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"

export const EQUIPMENT_DOCUMENT_ACCEPT =
  ".pdf,.hwp,.hwpx,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
