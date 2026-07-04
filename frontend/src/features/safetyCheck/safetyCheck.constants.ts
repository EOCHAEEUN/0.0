import type { InspectionPurpose } from "./safetyCheck.contract"

export const INSPECTION_PDF_MAX_BYTES = 10 * 1024 * 1024

export const INSPECTION_PDF_ACCEPT = ".pdf,application/pdf"

export const PURPOSE_META: Record<
  InspectionPurpose,
  { label: string; badgeClass: string }
> = {
  safety_device: { label: "안전장치점검", badgeClass: "badge-safety" },
  maintenance: { label: "유지보수점검", badgeClass: "badge-maintenance" },
  safety_training: { label: "안전교육", badgeClass: "badge-training" },
}

export const PURPOSE_OPTIONS: Array<{ value: InspectionPurpose; label: string }> = [
  { value: "safety_device", label: PURPOSE_META.safety_device.label },
  { value: "maintenance", label: PURPOSE_META.maintenance.label },
  { value: "safety_training", label: PURPOSE_META.safety_training.label },
]

export function getPurposeLabel(
  purpose: string,
  fallbackLabel?: string | null,
): string {
  if (fallbackLabel?.trim()) return fallbackLabel.trim()
  if (purpose in PURPOSE_META) {
    return PURPOSE_META[purpose as InspectionPurpose].label
  }
  return purpose
}

export function getCheckContent(item: {
  current_safety_measures?: string | null
  check_content?: string | null
}) {
  const primary = item.current_safety_measures?.trim()
  if (primary) return primary
  return item.check_content?.trim() || "-"
}
