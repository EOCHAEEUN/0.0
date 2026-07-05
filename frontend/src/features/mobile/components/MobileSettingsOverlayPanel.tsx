import { ArrowLeft, X } from "lucide-react"
import { createPortal } from "react-dom"
import type { ReactNode } from "react"

type MobileSettingsOverlayPanelProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function MobileSettingsOverlayPanel({
  open,
  title,
  onClose,
  children,
}: MobileSettingsOverlayPanelProps) {
  if (!open) return null

  return createPortal(
    <div className="ff-mobile-settings-overlay-backdrop" role="presentation" onClick={onClose}>
      <section
        className="ff-mobile-settings-overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ff-mobile-settings-overlay-head">
          <button type="button" className="ff-mobile-settings-overlay-back" onClick={onClose} aria-label="닫기">
            <ArrowLeft size={18} strokeWidth={2.2} />
          </button>
          <strong>{title}</strong>
          <button type="button" className="ff-mobile-settings-overlay-close" onClick={onClose} aria-label="닫기">
            <X size={18} strokeWidth={2.1} />
          </button>
        </header>
        <div className="ff-mobile-settings-overlay-body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
