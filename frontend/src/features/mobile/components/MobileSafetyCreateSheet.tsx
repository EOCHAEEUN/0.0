import { useEffect, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import type { EquipmentInfo } from "../../mypage/myPage.parts"
import { getErrorMessage } from "../../mypage/myPage.parts"
import {
  INSPECTION_PDF_ACCEPT,
  INSPECTION_PDF_MAX_BYTES,
  PURPOSE_OPTIONS,
} from "../../safetyCheck/safetyCheck.constants"
import type { InspectionPurpose } from "../../safetyCheck/safetyCheck.contract"
import { formatFileSize, validateInspectionPdfFile } from "../../safetyCheck/safetyCheck.utils"

type MobileSafetyCreateSheetProps = {
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

export function MobileSafetyCreateSheet({
  open,
  equipment,
  submitting = false,
  onClose,
  onSubmit,
}: MobileSafetyCreateSheetProps) {
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

  return createPortal(
    <div
      className="ff-mobile-safety-sheet-backdrop ff-mobile-safety-create-backdrop"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        className="ff-mobile-safety-sheet ff-mobile-safety-create-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="점검 내용 등록"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ff-mobile-safety-sheet-handle" aria-hidden="true" />
        <div className="ff-mobile-safety-sheet-head">
          <h2>점검 내용 등록</h2>
          <p>{equipment.name || "설비"}</p>
        </div>

        <form className="ff-mobile-safety-sheet-form" onSubmit={(event) => void handleSubmit(event)}>
          {localError ? <p className="ff-mobile-safety-sheet-error">{localError}</p> : null}

          <label className="ff-mobile-safety-field">
            <span>점검 목적</span>
            <select
              value={inspectionPurpose}
              disabled={submitting}
              onChange={(event) => setInspectionPurpose(event.target.value as InspectionPurpose | "")}
            >
              <option value="">선택해주세요</option>
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ff-mobile-safety-field">
            <span>점검 내용</span>
            <input
              type="text"
              value={currentSafetyMeasures}
              disabled={submitting}
              placeholder="예: 비상정지 버튼 점검"
              onChange={(event) => setCurrentSafetyMeasures(event.target.value)}
            />
          </label>

          <div className="ff-mobile-safety-field">
            <span>PDF 파일</span>
            <button
              type="button"
              className="ff-mobile-safety-file-picker"
              disabled={submitting}
              onClick={() => inputRef.current?.click()}
            >
              {selectedFile ? selectedFile.name : "클릭하여 PDF 선택"}
              {selectedFile ? (
                <em>{formatFileSize(selectedFile.size)}</em>
              ) : (
                <em>최대 {INSPECTION_PDF_MAX_BYTES / (1024 * 1024)}MB</em>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={INSPECTION_PDF_ACCEPT}
              hidden
              disabled={submitting}
              onChange={(event) => handleFile(event.target.files?.[0] || null)}
            />
          </div>

          <div className="ff-mobile-safety-sheet-actions">
            <button type="button" className="is-cancel" disabled={submitting} onClick={onClose}>
              취소
            </button>
            <button type="submit" className="is-save" disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
