import { ExternalLink } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { EquipmentAttachmentItem } from "../equipmentAttachments.contract"
import type {
  CreateEquipmentEvidencePayload,
  EquipmentEvidenceRecord,
  EvidenceReviewStatus,
  EvidenceType,
} from "../equipmentEvidence.contract"
import {
  EVIDENCE_TYPE_OPTIONS,
  REVIEW_STATUS_LABELS,
} from "../equipmentEvidence.contract"
import { createEmptyEvidenceDraft } from "../equipmentEvidence.utils"
import { suggestEvidenceTypeForAttachment } from "../equipmentEvidence.utils"
import EquipmentDrawerShell from "./EquipmentDrawerShell"

type EvidenceFormState = CreateEquipmentEvidencePayload & {
  rejection_reason?: string
}

type EquipmentEvidenceDrawerProps = {
  open: boolean
  onClose: () => void
  equipmentName?: string
  attachment?: EquipmentAttachmentItem | null
  attachments?: EquipmentAttachmentItem[]
  record?: EquipmentEvidenceRecord | null
  saving?: boolean
  onSave: (payload: {
    evidenceId?: string
    payload: CreateEquipmentEvidencePayload
  }) => Promise<void>
  onDelete?: (evidenceId: string) => Promise<void>
}

function toFormState(
  attachment: EquipmentAttachmentItem | null | undefined,
  record: EquipmentEvidenceRecord | null | undefined,
): EvidenceFormState {
  if (record) {
    return {
      attachment_id: record.attachment_id,
      evidence_type: record.evidence_type,
      evidence_date: record.evidence_date,
      title: record.title,
      summary: record.summary,
      structured_items:
        record.structured_items.length > 0
          ? record.structured_items
          : [{ item_name: "", status: "good", note: "" }],
      application_sentence: record.application_sentence,
      source_page: record.source_page || "",
      review_status: record.review_status,
      rejection_reason: record.rejection_reason || "",
      is_demo: record.is_demo,
    }
  }

  const draft = createEmptyEvidenceDraft(attachment?.attachment_id || "")
  if (attachment) {
    draft.evidence_type = suggestEvidenceTypeForAttachment(attachment.attachment_type)
  }
  return draft
}

export default function EquipmentEvidenceDrawer({
  open,
  onClose,
  equipmentName,
  attachment,
  attachments = [],
  record,
  saving = false,
  onSave,
  onDelete,
}: EquipmentEvidenceDrawerProps) {
  const [form, setForm] = useState<EvidenceFormState>(() => toFormState(attachment, record))
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [localError, setLocalError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(toFormState(attachment, record))
    setConfirmApprove(false)
    setLocalError("")
  }, [attachment, open, record])

  const isDemo = Boolean(form.is_demo)
  const isEdit = Boolean(record?.evidence_id)
  const selectedAttachment =
    attachment ||
    attachments.find((item) => item.attachment_id === form.attachment_id) ||
    null

  const previewUrl =
    selectedAttachment?.preview_url ||
    selectedAttachment?.download_url ||
    selectedAttachment?.signed_url

  const drawerTitle = isEdit ? "안전 점검 수정" : "안전 점검 등록"

  const canSubmit = useMemo(() => {
    return Boolean(form.title.trim() && form.attachment_id)
  }, [form.attachment_id, form.title])

  const handleReviewStatusChange = (status: EvidenceReviewStatus) => {
    if (isDemo) return
    if (status === "approved") {
      setConfirmApprove(true)
      return
    }
    setForm((current) => ({ ...current, review_status: status }))
  }

  const confirmApproval = () => {
    setForm((current) => ({ ...current, review_status: "approved" }))
    setConfirmApprove(false)
  }

  const handleSubmit = async (reviewStatus: EvidenceReviewStatus) => {
    setLocalError("")
    if (!form.title.trim()) {
      setLocalError("안전 점검 제목을 입력해 주세요.")
      return
    }
    if (!form.attachment_id) {
      setLocalError("연결할 첨부파일이 없습니다.")
      return
    }

    try {
      await onSave({
        evidenceId: record?.evidence_id,
        payload: {
          ...form,
          application_sentence: "",
          review_status: reviewStatus,
          structured_items: [],
        },
      })
      onClose()
    } catch (nextError) {
      if (nextError instanceof Error) {
        setLocalError(nextError.message)
      }
    }
  }

  const handleDelete = async () => {
    if (!record?.evidence_id || !onDelete) return
    const confirmed = window.confirm("이 안전 점검을 삭제할까요?")
    if (!confirmed) return
    await onDelete(record.evidence_id)
    onClose()
  }

  return (
    <EquipmentDrawerShell
      open={open}
      title={drawerTitle}
      subtitle={equipmentName ? `${equipmentName} · 직접 입력 안전 점검` : "직접 입력 안전 점검"}
      onClose={onClose}
      footer={
        <div className="ff-evidence-drawer-footer-actions">
          {isEdit && onDelete ? (
            <button
              type="button"
              className="ff-equipment-danger-btn"
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              삭제
            </button>
          ) : null}
          <div className="ff-evidence-drawer-footer-primary">
            <button
              type="button"
              className="ff-equipment-secondary-btn"
              disabled={saving || !canSubmit || isDemo}
              onClick={() =>
                void handleSubmit(form.review_status === "rejected" ? "rejected" : "draft")
              }
            >
              임시저장
            </button>
            <button
              type="button"
              className="ff-equipment-primary-btn"
              disabled={saving || !canSubmit || isDemo}
              onClick={() => void handleSubmit("approved")}
            >
              승인 저장
            </button>
          </div>
        </div>
      }
    >
      <div className="ff-evidence-form">
        <div className="ff-evidence-form-context">
          <div>
            <span>첨부파일</span>
            {isEdit ? (
              <strong>
                {selectedAttachment?.original_filename ||
                  record?.attachment_filename ||
                  "-"}
              </strong>
            ) : (
              <select
                value={form.attachment_id}
                disabled={saving || isDemo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    attachment_id: event.target.value,
                  }))
                }
              >
                <option value="">첨부파일 선택</option>
                {attachments.map((item) => (
                  <option key={item.attachment_id} value={item.attachment_id}>
                    {item.original_filename} ({item.attachment_type_label})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <span>파일 유형</span>
            <strong>{selectedAttachment?.attachment_type_label || "-"}</strong>
          </div>
          {previewUrl ? (
            <button
              type="button"
              className="ff-equipment-secondary-btn"
              onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink aria-hidden="true" size={14} />
              미리보기
            </button>
          ) : null}
        </div>

        <p className="ff-evidence-form-note">
          자동 추출이 아닌 직접 입력 안전 점검입니다. 신청서 문장은 사용자가 직접 작성·검토해야
          합니다.
        </p>

        {isDemo ? (
          <div className="ff-evidence-form-demo-alert">
            더미 자료는 화면 테스트용이며 실제 신청서 안전 점검으로 사용할 수 없습니다.
          </div>
        ) : null}

        {localError ? <div className="ff-equipment-attachments-error">{localError}</div> : null}

        <label className="ff-evidence-form-field">
          <span>안전 점검 유형</span>
          <select
            value={form.evidence_type}
            disabled={saving || isDemo}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                evidence_type: event.target.value as EvidenceType,
              }))
            }
          >
            {EVIDENCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="ff-evidence-form-field">
          <span>안전 점검 일자</span>
          <input
            type="date"
            value={form.evidence_date}
            disabled={saving || isDemo}
            onChange={(event) =>
              setForm((current) => ({ ...current, evidence_date: event.target.value }))
            }
          />
        </label>

        <label className="ff-evidence-form-field">
          <span>안전 점검 제목</span>
          <input
            type="text"
            value={form.title}
            disabled={saving || isDemo}
            placeholder="예: 비상정지 버튼 및 안전커버 점검"
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
          />
        </label>

        <div className="ff-evidence-form-field">
          <span>검토 상태</span>
          <div className="ff-evidence-review-actions">
            {(["draft", "approved", "rejected"] as EvidenceReviewStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={`ff-evidence-review-btn ${form.review_status === status ? "is-active" : ""}`}
                disabled={saving || isDemo}
                onClick={() => handleReviewStatusChange(status)}
              >
                {REVIEW_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
          {form.review_status === "approved" ? (
            <span className="ff-evidence-status apply-ready">신청서 반영 가능</span>
          ) : null}
          {form.review_status === "rejected" ? (
            <label className="ff-evidence-form-field">
              <span>반려 사유</span>
              <textarea
                rows={3}
                value={form.rejection_reason || ""}
                disabled={saving || isDemo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rejection_reason: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}
        </div>

        {confirmApprove ? (
          <div className="ff-evidence-confirm-box">
            <p>승인하면 이 안전 점검이 신청서 반영 후보가 됩니다. 승인하시겠습니까?</p>
            <div className="ff-evidence-confirm-actions">
              <button
                type="button"
                className="ff-equipment-secondary-btn"
                onClick={() => setConfirmApprove(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="ff-equipment-primary-btn"
                onClick={confirmApproval}
              >
                승인
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </EquipmentDrawerShell>
  )
}
