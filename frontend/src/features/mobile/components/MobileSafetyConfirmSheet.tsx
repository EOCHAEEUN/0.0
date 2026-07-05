import { createPortal } from "react-dom"

type MobileSafetyConfirmSheetProps = {
  open: boolean
  title: string
  message: string
  pending?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export function MobileSafetyConfirmSheet({
  open,
  title,
  message,
  pending = false,
  onClose,
  onConfirm,
}: MobileSafetyConfirmSheetProps) {
  if (!open) return null

  return createPortal(
    <div
      className="ff-mobile-safety-sheet-backdrop"
      role="presentation"
      onClick={() => {
        if (!pending) onClose()
      }}
    >
      <div
        className="ff-mobile-safety-sheet ff-mobile-safety-confirm-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ff-mobile-safety-sheet-handle" aria-hidden="true" />
        <div className="ff-mobile-safety-sheet-head">
          <h2>{title}</h2>
          <p>{message}</p>
        </div>
        <div className="ff-mobile-safety-sheet-actions">
          <button type="button" className="is-cancel" disabled={pending} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="is-delete"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
