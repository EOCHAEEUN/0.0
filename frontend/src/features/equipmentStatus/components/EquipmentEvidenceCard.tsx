import { Pencil, Trash2 } from "lucide-react"
import type { EquipmentEvidenceRecord } from "../equipmentEvidence.contract"
import {
  EVIDENCE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
} from "../equipmentEvidence.contract"
import {
  formatEvidenceDate,
  getReviewStatusClassName,
  isEvidenceEligibleForApplication,
} from "../equipmentEvidence.utils"

type EquipmentEvidenceCardProps = {
  record: EquipmentEvidenceRecord
  onEdit: (record: EquipmentEvidenceRecord) => void
  onDelete: (record: EquipmentEvidenceRecord) => void
}

export default function EquipmentEvidenceCard({
  record,
  onEdit,
  onDelete,
}: EquipmentEvidenceCardProps) {
  const canApply = isEvidenceEligibleForApplication(record)

  return (
    <article
      className={`ff-evidence-card ${record.is_demo ? "is-demo" : ""}`}
    >
      <div className="ff-evidence-card-head">
        <div className="ff-evidence-card-badges">
          <span className="ff-evidence-type-badge">
            {EVIDENCE_TYPE_LABELS[record.evidence_type]}
          </span>
          <span className={getReviewStatusClassName(record.review_status, record.is_demo)}>
            {record.is_demo ? "더미 자료 · 신청서 반영 불가" : REVIEW_STATUS_LABELS[record.review_status]}
          </span>
          {canApply ? (
            <span className="ff-evidence-status apply-ready">신청서 반영 가능</span>
          ) : null}
        </div>
        <div className="ff-evidence-card-actions">
          <button
            type="button"
            className="ff-equipment-secondary-btn"
            onClick={() => onEdit(record)}
          >
            <Pencil aria-hidden="true" size={14} />
            수정
          </button>
          <button
            type="button"
            className="ff-equipment-attachment-delete"
            aria-label={`${record.title} 삭제`}
            onClick={() => onDelete(record)}
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <div className="ff-evidence-card-body">
        <strong>{record.title || "제목 없음"}</strong>
        <p className="ff-evidence-card-meta">
          근거 일자 {formatEvidenceDate(record.evidence_date)}
          {record.attachment_filename ? ` · ${record.attachment_filename}` : ""}
          {record.structured_items.length > 0
            ? ` · 세부 항목 ${record.structured_items.length}건`
            : ""}
        </p>
        {record.summary ? <p className="ff-evidence-card-summary">{record.summary}</p> : null}
        {record.application_sentence ? (
          <p className="ff-evidence-card-sentence">
            <span>신청서 반영 후보 문장</span>
            {record.application_sentence}
          </p>
        ) : null}
      </div>
    </article>
  )
}
