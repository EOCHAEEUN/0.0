import { INSPECTION_PDF_MAX_BYTES } from "./safetyCheck.constants"

export function sanitizePdfFilename(filename: string) {
  const trimmed = filename.trim()
  const lastDot = trimmed.lastIndexOf(".")
  const stem = (lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed)
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "_")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
  const ext = lastDot > 0 ? trimmed.slice(lastDot).toLowerCase() : ".pdf"
  return `${stem || "inspection"}${ext === ".pdf" ? ext : ".pdf"}`
}

export function buildInspectionStoragePath(inspectionPurpose: string, filename: string) {
  const now = new Date()
  const timestamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("-") + `_${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`

  const sanitized = sanitizePdfFilename(filename)
  const finalFilename = `${timestamp}_${sanitized}`
  return {
    storagePath: `${inspectionPurpose}_${finalFilename}`,
    fileName: finalFilename,
  }
}

export function validateInspectionPdfFile(file: File) {
  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith(".pdf")) {
    throw new Error("PDF 파일만 업로드할 수 있습니다.")
  }
  if (file.type && file.type !== "application/pdf") {
    throw new Error("PDF 파일만 업로드할 수 있습니다.")
  }
  if (file.size <= 0) {
    throw new Error("빈 파일은 업로드할 수 없습니다.")
  }
  if (file.size > INSPECTION_PDF_MAX_BYTES) {
    throw new Error("파일 크기는 10MB 이하만 가능합니다.")
  }
}

export function formatEquipmentRegisteredAt(value?: string) {
  if (!value?.trim()) return "등록 정보 없음"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

export function getEquipmentEmoji(category: string) {
  const normalized = category.trim().toLowerCase()
  if (normalized.includes("press") || normalized.includes("프레스")) return "🔧"
  if (normalized.includes("cnc") || normalized.includes("공작") || normalized.includes("가공")) {
    return "⚙️"
  }
  if (normalized.includes("injection") || normalized.includes("사출")) return "🏭"
  return "⚙️"
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}
