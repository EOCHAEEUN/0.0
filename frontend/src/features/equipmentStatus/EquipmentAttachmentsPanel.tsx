import {
  FileImage,
  FileText,
  FolderOpen,
  Star,
  Trash2,
  Upload,
} from "lucide-react"
import EquipmentCollapsibleSection from "./components/EquipmentCollapsibleSection"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  EQUIPMENT_ATTACHMENT_ACCEPT,
  EQUIPMENT_ATTACHMENT_MAX_BYTES,
  EQUIPMENT_ATTACHMENT_TYPE_OPTIONS,
  EQUIPMENT_DOCUMENT_ACCEPT,
  EQUIPMENT_PHOTO_ACCEPT,
  type EquipmentAttachmentItem,
  type EquipmentAttachmentType,
} from "./equipmentAttachments.contract"
import { useEquipmentAttachments } from "./hooks/useEquipmentAttachments"
import type { AttachmentEvidenceSummary } from "./equipmentEvidence.utils"

function formatUploadedAt(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0B"
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function getAcceptForType(attachmentType: EquipmentAttachmentType) {
  if (attachmentType === "equipment_photo") return EQUIPMENT_PHOTO_ACCEPT
  return EQUIPMENT_DOCUMENT_ACCEPT
}

function validateSelectedFile(file: File, attachmentType: EquipmentAttachmentType) {
  if (file.size > EQUIPMENT_ATTACHMENT_MAX_BYTES) {
    throw new Error("파일 크기는 20MB 이하만 업로드할 수 있습니다.")
  }

  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase()}`
    : ""

  const photoExtensions = [".jpg", ".jpeg", ".png", ".webp"]
  const documentExtensions = [".pdf", ".hwp", ".hwpx", ...photoExtensions]

  if (attachmentType === "equipment_photo" && !photoExtensions.includes(extension)) {
    throw new Error("설비 사진은 JPG, PNG, WEBP 형식만 업로드할 수 있습니다.")
  }

  if (
    attachmentType !== "equipment_photo" &&
    !documentExtensions.includes(extension)
  ) {
    throw new Error("PDF, HWP, HWPX 또는 이미지 형식만 업로드할 수 있습니다.")
  }
}

function AttachmentFileIcon({ item }: { item: EquipmentAttachmentItem }) {
  if (item.preview_url) {
    return (
      <img
        src={item.preview_url}
        alt=""
        className="ff-equipment-attachment-thumb"
      />
    )
  }

  return (
    <span className="ff-equipment-attachment-file-icon" aria-hidden="true">
      <FileText size={20} />
    </span>
  )
}

type EquipmentAttachmentsPanelProps = {
  equipmentId?: string
  equipmentName?: string
  enabled?: boolean
  onPrimaryPhotoChange?: (previewUrl: string | null) => void
  onAttachmentsChange?: (attachments: EquipmentAttachmentItem[]) => void
  getAttachmentEvidenceSummary?: (attachmentId: string) => AttachmentEvidenceSummary
  onManageEvidence?: (attachment: EquipmentAttachmentItem) => void
}

export default function EquipmentAttachmentsPanel({
  equipmentId,
  equipmentName,
  enabled = true,
  onPrimaryPhotoChange,
  onAttachmentsChange,
  getAttachmentEvidenceSummary,
  onManageEvidence,
}: EquipmentAttachmentsPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [attachmentType, setAttachmentType] =
    useState<EquipmentAttachmentType>("equipment_photo")
  const [markAsPrimary, setMarkAsPrimary] = useState(true)
  const [dragActive, setDragActive] = useState(false)
  const [localError, setLocalError] = useState("")

  const {
    attachments,
    totalCount,
    loading,
    uploading,
    uploadProgress,
    error,
    primaryPhoto,
    uploadMany,
    remove,
    setPrimary,
  } = useEquipmentAttachments({ equipmentId, enabled })

  const accept = useMemo(() => getAcceptForType(attachmentType), [attachmentType])

  const displayError = localError || error

  useEffect(() => {
    onPrimaryPhotoChange?.(primaryPhoto?.preview_url || null)
  }, [onPrimaryPhotoChange, primaryPhoto?.preview_url])

  useEffect(() => {
    onAttachmentsChange?.(attachments)
  }, [attachments, onAttachmentsChange])

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || uploading) return
    const selectedFiles = Array.from(files)
    setLocalError("")

    try {
      for (const file of selectedFiles) {
        validateSelectedFile(file, attachmentType)
      }
      await uploadMany({
        files: selectedFiles,
        attachmentType,
        isPrimaryPhoto: attachmentType === "equipment_photo" && markAsPrimary,
      })
    } catch (nextError) {
      if (nextError instanceof Error) {
        setLocalError(nextError.message)
      }
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const openFilePicker = () => {
    if (!uploading) inputRef.current?.click()
  }

  const handlePreview = (item: EquipmentAttachmentItem) => {
    const url = item.preview_url || item.download_url || item.signed_url
    if (!url) return
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleDelete = async (item: EquipmentAttachmentItem) => {
    const confirmed = window.confirm(`'${item.original_filename}' 파일을 삭제할까요?`)
    if (!confirmed) return
    setLocalError("")
    try {
      await remove(item.attachment_id)
    } catch {
      // error state handled in hook
    }
  }

  const handleSetPrimary = async (item: EquipmentAttachmentItem) => {
    setLocalError("")
    try {
      await setPrimary(item.attachment_id)
    } catch {
      // error state handled in hook
    }
  }

  if (!equipmentId) {
    return (
      <section className="ff-equipment-attachments-section">
        <header className="ff-equipment-attachments-head">
          <div className="ff-equipment-attachments-title">
            <FolderOpen aria-hidden="true" size={18} />
            <strong>첨부서류 관리</strong>
          </div>
        </header>
        <p className="ff-equipment-attachments-hint">
          설비를 저장한 뒤 첨부서류를 업로드할 수 있습니다.
        </p>
      </section>
    )
  }

  return (
    <EquipmentCollapsibleSection
      sectionClassName="ff-equipment-attachments-section"
      title="첨부서류 관리"
      description="설비 사진 · 안전증빙 · 정비기록 등 첨부파일"
      icon={<FolderOpen aria-hidden="true" size={18} />}
      badge={
        <span className="ff-equipment-attachments-count">{totalCount}개 파일</span>
      }
    >
      {displayError ? (
        <div className="ff-equipment-attachments-error">{displayError}</div>
      ) : null}

      {loading ? (
        <p className="ff-equipment-attachments-hint">첨부파일을 불러오는 중...</p>
      ) : attachments.length === 0 ? (
        <p className="ff-equipment-attachments-hint">등록된 첨부파일이 없습니다.</p>
      ) : (
        <div className="ff-equipment-attachments-list">
          {attachments.map((item) => {
            const evidenceSummary = getAttachmentEvidenceSummary?.(item.attachment_id)
            const showEvidenceActions =
              onManageEvidence &&
              (item.attachment_type === "safety_evidence" ||
                item.attachment_type === "maintenance_record")

            return (
            <article key={item.attachment_id} className="ff-equipment-attachment-row">
              <AttachmentFileIcon item={item} />

              <div className="ff-equipment-attachment-meta">
                <div className="ff-equipment-attachment-meta-top">
                  <strong>{item.original_filename}</strong>
                  {item.is_primary_photo ? (
                    <span className="ff-equipment-badge representative">
                      <Star aria-hidden="true" size={12} />
                      대표 사진
                    </span>
                  ) : null}
                  {evidenceSummary?.statusTone === "demo" ? (
                    <span className="ff-evidence-inline-badge demo">더미 자료</span>
                  ) : null}
                </div>
                <p>
                  {item.attachment_type_label} · 등록됨
                  {equipmentName ? ` · ${equipmentName}` : ""}
                </p>
                {evidenceSummary ? (
                  <span className="ff-equipment-attachment-evidence-summary">
                    {evidenceSummary.totalCount > 0
                      ? `근거 ${evidenceSummary.totalCount}건 · 승인 ${evidenceSummary.approvedCount}건 · ${evidenceSummary.statusLabel}`
                      : evidenceSummary.statusLabel}
                  </span>
                ) : null}
                <span>
                  {formatUploadedAt(item.created_at)} · {formatFileSize(item.file_size_bytes)}
                </span>
              </div>

              <div className="ff-equipment-attachment-actions">
                {showEvidenceActions ? (
                  <button
                    type="button"
                    className="ff-equipment-secondary-btn"
                    onClick={() => onManageEvidence(item)}
                  >
                    근거 관리
                  </button>
                ) : null}
                {item.attachment_type === "equipment_photo" && !item.is_primary_photo ? (
                  <button
                    type="button"
                    className="ff-equipment-secondary-btn"
                    onClick={() => void handleSetPrimary(item)}
                  >
                    대표 지정
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ff-equipment-secondary-btn"
                  onClick={() => handlePreview(item)}
                >
                  {item.preview_url ? "미리보기" : "다운로드"}
                </button>
                <button
                  type="button"
                  className="ff-equipment-attachment-delete"
                  aria-label={`${item.original_filename} 삭제`}
                  onClick={() => void handleDelete(item)}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            </article>
            )
          })}
        </div>
      )}

      <div className="ff-equipment-attachments-upload-controls">
        <label className="ff-equipment-attachments-field">
          <span>첨부 유형</span>
          <select
            value={attachmentType}
            disabled={uploading}
            onChange={(event) => {
              const nextType = event.target.value as EquipmentAttachmentType
              setAttachmentType(nextType)
              setMarkAsPrimary(nextType === "equipment_photo")
            }}
          >
            {EQUIPMENT_ATTACHMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {attachmentType === "equipment_photo" ? (
          <label className="ff-equipment-attachments-primary-check">
            <input
              type="checkbox"
              checked={markAsPrimary}
              disabled={uploading}
              onChange={(event) => setMarkAsPrimary(event.target.checked)}
            />
            업로드 후 대표 사진으로 지정
          </label>
        ) : null}
      </div>

      <div
        className={`ff-equipment-attachments-dropzone ${dragActive ? "is-active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          void handleFiles(event.dataTransfer.files)
        }}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openFilePicker()
          }
        }}
        role="button"
        tabIndex={0}
        aria-disabled={uploading}
      >
        <span className="ff-equipment-attachments-dropzone-icon" aria-hidden="true">
          {uploading ? <Upload size={22} /> : <FileImage size={22} />}
        </span>
        <strong>
          {uploading && uploadProgress
            ? `업로드 중... (${uploadProgress.current}/${uploadProgress.total})`
            : uploading
              ? "업로드 중..."
              : "새로운 서류 업로드"}
        </strong>
        <p>PDF, HWP, 이미지 파일 (최대 20MB) · 여러 파일 선택 가능</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept || EQUIPMENT_ATTACHMENT_ACCEPT}
          className="ff-equipment-attachments-file-input"
          disabled={uploading}
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>
    </EquipmentCollapsibleSection>
  )
}
