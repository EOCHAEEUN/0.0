import { Upload, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { CompanyDocumentCatalogItem } from "../../documents/companyDocuments.contract"
import {
  COMPANY_DOCUMENT_ACCEPT,
  COMPANY_DOCUMENT_MAX_BYTES,
} from "../../documents/companyDocuments.contract"
import { validateCompanyDocumentFile } from "../../documents/companyDocuments.utils"

type CompanyDocumentUploadModalProps = {
  open: boolean
  catalogItem: CompanyDocumentCatalogItem | null
  isReplace: boolean
  uploading?: boolean
  onClose: () => void
  onUpload: (file: File) => Promise<void>
}

export default function CompanyDocumentUploadModal({
  open,
  catalogItem,
  isReplace,
  uploading = false,
  onClose,
  onUpload,
}: CompanyDocumentUploadModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState("")

  useEffect(() => {
    if (!open) return
    setSelectedFile(null)
    setLocalError("")
    setDragActive(false)
    if (inputRef.current) inputRef.current.value = ""
  }, [open, catalogItem?.documentType])

  if (!open || !catalogItem) return null

  const handleFile = (file: File | null) => {
    if (!file) return
    setLocalError("")
    try {
      validateCompanyDocumentFile(file)
      setSelectedFile(file)
    } catch (nextError) {
      setSelectedFile(null)
      if (nextError instanceof Error) {
        setLocalError(nextError.message)
      }
    }
  }

  const handleSubmit = async () => {
    if (!selectedFile || uploading) return
    setLocalError("")
    try {
      await onUpload(selectedFile)
      onClose()
    } catch (nextError) {
      if (nextError instanceof Error) {
        setLocalError(nextError.message)
      }
    }
  }

  return (
    <div className="ff-company-doc-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ff-company-doc-modal"
        role="dialog"
        aria-modal="true"
        aria-label="기업 증빙 업로드"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ff-company-doc-modal__head">
          <div>
            <strong>{isReplace ? "교체 업로드" : "파일 업로드"}</strong>
            <p>{catalogItem.documentCategoryLabel} · {catalogItem.documentLabel}</p>
          </div>
          <button type="button" className="ff-company-doc-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="ff-company-doc-modal__body">
          <p className="ff-company-doc-modal__note">
            선택한 서류 유형({catalogItem.documentLabel})으로 저장됩니다.
          </p>
          <p className="ff-company-doc-modal__note subtle">
            카테고리: {catalogItem.documentCategoryLabel} · document_type:{" "}
            {catalogItem.documentType}
          </p>
          {isReplace ? (
            <p className="ff-company-doc-modal__note subtle">
              새 파일을 등록합니다. 기존 파일 처리 방식은 현재 시스템 정책을 따릅니다.
            </p>
          ) : null}

          {localError ? <div className="ff-company-doc-error">{localError}</div> : null}

          <div
            className={`ff-company-doc-dropzone ${dragActive ? "is-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              handleFile(event.dataTransfer.files?.[0] || null)
            }}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={22} aria-hidden="true" />
            <strong>{selectedFile ? selectedFile.name : "새로운 서류 업로드"}</strong>
            <p>PDF, JPG, PNG, WEBP (최대 {COMPANY_DOCUMENT_MAX_BYTES / (1024 * 1024)}MB)</p>
            <input
              ref={inputRef}
              type="file"
              accept={COMPANY_DOCUMENT_ACCEPT}
              hidden
              disabled={uploading}
              onChange={(event) => handleFile(event.target.files?.[0] || null)}
            />
          </div>
        </div>

        <footer className="ff-company-doc-modal__footer">
          <button type="button" className="ff-mypage-btn ghost" disabled={uploading} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="ff-mypage-btn primary"
            disabled={!selectedFile || uploading}
            onClick={() => void handleSubmit()}
          >
            {uploading ? "업로드 중..." : isReplace ? "교체 업로드" : "업로드"}
          </button>
        </footer>
      </div>
    </div>
  )
}
