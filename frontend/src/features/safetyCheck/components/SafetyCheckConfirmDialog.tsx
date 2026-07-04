import { useEffect } from "react"

type SafetyCheckConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  pending?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export default function SafetyCheckConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "삭제",
  pending = false,
  onClose,
  onConfirm,
}: SafetyCheckConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, pending, onClose])

  if (!open) return null

  return (
    <div
      className="safety-check-modal"
      role="presentation"
      onClick={() => {
        if (!pending) onClose()
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="닫기"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p style={{ marginBottom: 24, color: "var(--sc-muted)", fontSize: 14 }}>{message}</p>
        <div className="button-group ff-draft-safety-footer-actions">
          <button type="button" className="ff-draft-safety-cancel-btn" disabled={pending} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="ff-draft-safety-save-btn danger"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
