import type { InspectionPurpose } from "../safetyCheck.contract"
import { PURPOSE_META } from "../safetyCheck.constants"

type SafetyCheckPurposeBadgeProps = {
  purpose: string
  label?: string | null
}

export default function SafetyCheckPurposeBadge({
  purpose,
  label,
}: SafetyCheckPurposeBadgeProps) {
  const meta =
    purpose in PURPOSE_META
      ? PURPOSE_META[purpose as InspectionPurpose]
      : { label: label || purpose, badgeClass: "badge-safety" }

  return (
    <span className={`badge ${meta.badgeClass}`}>{label?.trim() || meta.label}</span>
  )
}
