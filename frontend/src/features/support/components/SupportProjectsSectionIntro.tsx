import { ChevronRight } from "lucide-react"

import "../supportProjects.workspace.css"

type SupportProjectsSectionIntroProps = {
  eyebrow?: string
  title: string
  meta?: string
  actionLabel?: string
  onAction?: () => void
}

export function SupportProjectsSectionIntro({
  eyebrow,
  title,
  meta,
  actionLabel,
  onAction,
}: SupportProjectsSectionIntroProps) {
  return (
    <header className="ff-support-page-intro">
      <div className="ff-support-page-intro-copy">
        {eyebrow ? <p className="ff-support-page-intro-eyebrow">{eyebrow}</p> : null}
        <h1 className="ff-support-page-intro-title">{title}</h1>
        {meta ? <p className="ff-support-page-intro-meta">{meta}</p> : null}
      </div>

      {actionLabel && onAction ? (
        <button type="button" className="ff-support-page-intro-action" onClick={onAction}>
          {actionLabel}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      ) : null}
    </header>
  )
}
