import { useEffect, useRef, useState, type FormEvent } from "react"
import type { EquipmentInfo } from "../../mypage/myPage.parts"
import { getErrorMessage } from "../../mypage/myPage.parts"
import {
  INSPECTION_PDF_ACCEPT,
  INSPECTION_PDF_MAX_BYTES,
  PURPOSE_OPTIONS,
} from "../safetyCheck.constants"
import type { InspectionPurpose } from "../safetyCheck.contract"
import { formatFileSize, validateInspectionPdfFile } from "../safetyCheck.utils"

type SafetyCheckCreateModalProps = {
  open: boolean
  equipment: EquipmentInfo | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (params: {
    inspectionPurpose: InspectionPurpose
    currentSafetyMeasures: string
    file: File
  }) => Promise<void>
}

export default function SafetyCheckCreateModal({
  open,
  equipment,
  submitting = false,
  onClose,
  onSubmit,
}: SafetyCheckCreateModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [inspectionPurpose, setInspectionPurpose] = useState<InspectionPurpose | "">("")
  const [currentSafetyMeasures, setCurrentSafetyMeasures] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState("")

  useEffect(() => {
    if (!open) return
    setInspectionPurpose("")
    setCurrentSafetyMeasures("")
    setSelectedFile(null)
    setLocalError("")
    if (inputRef.current) inputRef.current.value = ""
  }, [open, equipment?.equipmentId])

  useEffect(() => {
    if (!open || submitting) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, submitting, onClose])

  if (!open || !equipment) return null

  const handleFile = (file: File | null) => {
    if (!file) return
    setLocalError("")
    try {
      validateInspectionPdfFile(file)
      setSelectedFile(file)
    } catch (nextError) {
      setSelectedFile(null)
      setLocalError(getErrorMessage(nextError))
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setLocalError("")

    if (!inspectionPurpose) {
      setLocalError("점검 목적을 선택해주세요.")
      return
    }
    if (!currentSafetyMeasures.trim()) {
      setLocalError("점검 내용을 입력해주세요.")
      return
    }
    if (!selectedFile) {
      setLocalError("PDF 파일을 선택해주세요.")
      return
    }

    try {
      await onSubmit({
        inspectionPurpose,
        currentSafetyMeasures: currentSafetyMeasures.trim(),
        file: selectedFile,
      })
      onClose()
    } catch (nextError) {
      setLocalError(getErrorMessage(nextError))
    }
  }

  return (
    <div
      className="safety-check-modal"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="점검 내용 등록"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">점검 내용 등록</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="닫기"
            disabled={submitting}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          {localError ? <div className="alert-error">{localError}</div> : null}

          <div className="form-group">
            <label className="form-label" htmlFor="safety-check-purpose">
              점검 목적
              <span className="required">*</span>
            </label>
            <select
              id="safety-check-purpose"
              className="form-select"
              value={inspectionPurpose}
              disabled={submitting}
              required
              onChange={(event) =>
                setInspectionPurpose(event.target.value as InspectionPurpose | "")
              }
            >
              <option value="">선택해주세요</option>
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="safety-check-measures">
              점검 내용
              <span className="required">*</span>
            </label>
            <input
              id="safety-check-measures"
              type="text"
              className="form-input"
              value={currentSafetyMeasures}
              disabled={submitting}
              placeholder="예: 비상정지 버튼 점검"
              required
              onChange={(event) => setCurrentSafetyMeasures(event.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              PDF 파일
              <span className="required">*</span>
            </label>
            <div
              className="file-upload"
              onClick={() => {
                if (!submitting) inputRef.current?.click()
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept={INSPECTION_PDF_ACCEPT}
                hidden
                disabled={submitting}
                onChange={(event) => handleFile(event.target.files?.[0] || null)}
              />
              <div className="file-upload-text">📁 클릭하여 파일 선택</div>
              <div className="file-upload-size">
                또는 파일을 드래그하세요 (최대 {INSPECTION_PDF_MAX_BYTES / (1024 * 1024)}MB)
              </div>
              {selectedFile ? (
                <div className="file-name">
                  ✓ {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </div>
              ) : null}
            </div>
          </div>

          <div className="button-group ff-draft-safety-footer-actions">
            <button
              type="button"
              className="ff-draft-safety-cancel-btn"
              disabled={submitting}
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="ff-draft-safety-save-btn"
              disabled={submitting}
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
