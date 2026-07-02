import type { EquipmentAttachmentType } from "./equipmentAttachments.contract"
import type {
  ApplicationEvidenceSelection,
  EquipmentEvidenceRecord,
  EvidenceReviewStatus,
  EvidenceType,
} from "./equipmentEvidence.contract"
import { REVIEW_STATUS_LABELS } from "./equipmentEvidence.contract"

export type AttachmentEvidenceSummary = {
  totalCount: number
  draftCount: number
  approvedCount: number
  rejectedCount: number
  statusLabel: string
  statusTone: "empty" | "draft" | "approved" | "demo"
  hasDemoOnly: boolean
}

export type EvidenceSummaryStats = {
  totalCount: number
  draftCount: number
  approvedCount: number
  rejectedCount: number
  applicationSelectedCount: number
}

export function isEvidenceEligibleForApplication(record: EquipmentEvidenceRecord) {
  return record.review_status === "approved" && !record.is_demo
}

export function getDefaultReflectedText(applicationSentence: string) {
  return applicationSentence.trim()
}

export function createEmptyStructuredItem() {
  return {
    item_name: "",
    status: "good" as const,
    note: "",
  }
}

export function createEmptyEvidenceDraft(attachmentId: string) {
  return {
    attachment_id: attachmentId,
    evidence_type: "safety_inspection" as EvidenceType,
    evidence_date: new Date().toISOString().slice(0, 10),
    title: "",
    summary: "",
    structured_items: [createEmptyStructuredItem()],
    application_sentence: "",
    source_page: "",
    review_status: "draft" as EvidenceReviewStatus,
    rejection_reason: "",
    is_demo: false,
  }
}

export function computeAttachmentEvidenceSummary(
  records: EquipmentEvidenceRecord[],
  attachmentId: string,
): AttachmentEvidenceSummary {
  const matched = records.filter((record) => record.attachment_id === attachmentId)

  if (matched.length === 0) {
    return {
      totalCount: 0,
      draftCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      statusLabel: "근거 미등록",
      statusTone: "empty",
      hasDemoOnly: false,
    }
  }

  const draftCount = matched.filter((record) => record.review_status === "draft").length
  const approvedCount = matched.filter((record) => record.review_status === "approved").length
  const rejectedCount = matched.filter((record) => record.review_status === "rejected").length
  const nonDemo = matched.filter((record) => !record.is_demo)
  const hasDemoOnly = nonDemo.length === 0

  let statusLabel = "근거 미등록"
  let statusTone: AttachmentEvidenceSummary["statusTone"] = "empty"

  if (hasDemoOnly) {
    statusLabel = "더미 자료"
    statusTone = "demo"
  } else if (approvedCount > 0) {
    statusLabel = "승인 완료"
    statusTone = "approved"
  } else if (draftCount > 0) {
    statusLabel = "검토 필요"
    statusTone = "draft"
  } else if (rejectedCount > 0) {
    statusLabel = REVIEW_STATUS_LABELS.rejected
    statusTone = "draft"
  }

  return {
    totalCount: matched.length,
    draftCount,
    approvedCount,
    rejectedCount,
    statusLabel,
    statusTone,
    hasDemoOnly,
  }
}

export function computeEvidenceSummaryStats(
  records: EquipmentEvidenceRecord[],
  selections: ApplicationEvidenceSelection[] = [],
): EvidenceSummaryStats {
  return {
    totalCount: records.length,
    draftCount: records.filter((record) => record.review_status === "draft").length,
    approvedCount: records.filter((record) => record.review_status === "approved").length,
    rejectedCount: records.filter((record) => record.review_status === "rejected").length,
    applicationSelectedCount: selections.filter((selection) => selection.is_selected).length,
  }
}

export function getReviewStatusClassName(status: EvidenceReviewStatus, isDemo: boolean) {
  if (isDemo) return "ff-evidence-status demo"
  if (status === "approved") return "ff-evidence-status approved"
  if (status === "rejected") return "ff-evidence-status rejected"
  return "ff-evidence-status draft"
}

export function isEvidenceAttachmentType(type: EquipmentAttachmentType) {
  return type === "safety_evidence" || type === "maintenance_record"
}

export function suggestEvidenceTypeForAttachment(
  attachmentType: EquipmentAttachmentType,
): EvidenceType {
  if (attachmentType === "maintenance_record") return "maintenance_record"
  if (attachmentType === "safety_evidence") return "safety_inspection"
  return "safety_inspection"
}

export function filterEvidenceRecords(
  records: EquipmentEvidenceRecord[],
  filter: "all" | EvidenceType | "approved_only",
) {
  if (filter === "all") return records
  if (filter === "approved_only") {
    return records.filter((record) => record.review_status === "approved")
  }
  return records.filter((record) => record.evidence_type === filter)
}

export function formatEvidenceDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}
