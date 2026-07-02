import type { ReactNode } from "react"
import { X } from "lucide-react"
import { createPortal } from "react-dom"
import { useEffect } from "react"

type EquipmentDrawerShellProps = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  widthClass?: string
}

export default function EquipmentDrawerShell({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthClass = "ff-evidence-drawer-panel",
}: EquipmentDrawerShellProps) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="ff-evidence-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className={widthClass}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ff-evidence-drawer-head">
          <div>
            <strong>{title}</strong>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="ff-evidence-drawer-close"
            aria-label="닫기"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="ff-evidence-drawer-body">{children}</div>
        {footer ? <footer className="ff-evidence-drawer-footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  )
}
