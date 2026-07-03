import { ChevronDown, ChevronUp } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

type EquipmentCollapsibleSectionProps = {
  sectionClassName: string
  title: string
  description?: string
  icon?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  defaultExpanded?: boolean
  children: ReactNode
}

export default function EquipmentCollapsibleSection({
  sectionClassName,
  title,
  description,
  icon,
  badge,
  actions,
  defaultExpanded = false,
  children,
}: EquipmentCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section
      className={`ff-equipment-subsection ${sectionClassName} ${expanded ? "is-expanded" : ""}`}
    >
      <div className="ff-equipment-subsection-head">
        <button
          type="button"
          className="ff-equipment-subsection-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {icon}
          <span className="ff-equipment-subsection-toggle-text">
            <strong>{title}</strong>
            {description ? <span>{description}</span> : null}
          </span>
          {badge}
          {expanded ? (
            <ChevronUp aria-hidden="true" size={18} className="ff-equipment-subsection-chevron" />
          ) : (
            <ChevronDown aria-hidden="true" size={18} className="ff-equipment-subsection-chevron" />
          )}
        </button>
        {actions ? (
          <div className="ff-equipment-subsection-actions" onClick={(event) => event.stopPropagation()}>
            {actions}
          </div>
        ) : null}
      </div>

      {expanded ? <div className="ff-equipment-subsection-body">{children}</div> : null}
    </section>
  )
}
