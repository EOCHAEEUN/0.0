import { COMPANY_DOCUMENT_CATALOG } from "./companyDocuments.catalog"
import type { CompanyDocumentCatalogItem, CompanyDocumentRecord } from "./companyDocuments.contract"

export type CompanyDocumentTypeStatus = {
  catalogItem: CompanyDocumentCatalogItem
  latestDocument: CompanyDocumentRecord | null
  previousCount: number
  isRegistered: boolean
}

export type CompanyDocumentSummary = {
  totalRequired: number
  registeredCount: number
  missingCount: number
}

export function validateCompanyDocumentFile(file: File) {
  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ])
  const maxBytes = 20 * 1024 * 1024

  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("jpg, png, webp, pdf 파일만 업로드할 수 있습니다.")
  }

  if (file.size <= 0) {
    throw new Error("빈 파일은 업로드할 수 없습니다.")
  }

  if (file.size > maxBytes) {
    throw new Error("파일 크기는 20MB 이하만 업로드할 수 있습니다.")
  }
}

export function formatCompanyDocumentDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}.${month}.${day}`
}

export function formatCompanyDocumentFileSize(bytes?: number | null) {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function getMimeTypeLabel(mimeType?: string | null) {
  if (!mimeType) return "-"
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "JPG"
  if (mimeType === "image/png") return "PNG"
  if (mimeType === "image/webp") return "WEBP"
  return mimeType
}

export function buildLatestDocumentsByType(documents: CompanyDocumentRecord[]) {
  const grouped = new Map<string, CompanyDocumentRecord[]>()

  for (const document of documents) {
    const type = String(document.document_type || "").trim()
    if (!type) continue
    const current = grouped.get(type) || []
    current.push(document)
    grouped.set(type, current)
  }

  const latestByType = new Map<string, CompanyDocumentRecord>()
  const countByType = new Map<string, number>()

  for (const [type, rows] of grouped.entries()) {
    const sorted = [...rows].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return bTime - aTime
    })
    latestByType.set(type, sorted[0])
    countByType.set(type, sorted.length)
  }

  return { latestByType, countByType }
}

export function computeCompanyDocumentSummary(
  catalog: CompanyDocumentCatalogItem[],
  latestByType: Map<string, CompanyDocumentRecord>,
): CompanyDocumentSummary {
  const totalRequired = catalog.length
  const registeredCount = catalog.filter((item) =>
    latestByType.has(item.documentType),
  ).length

  return {
    totalRequired,
    registeredCount,
    missingCount: totalRequired - registeredCount,
  }
}

export function buildCatalogStatuses(
  catalog: CompanyDocumentCatalogItem[],
  documents: CompanyDocumentRecord[],
  category?: string,
): CompanyDocumentTypeStatus[] {
  const { latestByType, countByType } = buildLatestDocumentsByType(documents)
  const filteredCatalog = category
    ? catalog.filter((item) => item.documentCategory === category)
    : catalog

  return filteredCatalog.map((catalogItem) => {
    const latestDocument = latestByType.get(catalogItem.documentType) || null
    const totalCount = countByType.get(catalogItem.documentType) || 0
    return {
      catalogItem,
      latestDocument,
      previousCount: Math.max(0, totalCount - 1),
      isRegistered: Boolean(latestDocument),
    }
  })
}

export function getUncategorizedDocuments(
  catalog: CompanyDocumentCatalogItem[],
  documents: CompanyDocumentRecord[],
) {
  const catalogTypes = new Set(catalog.map((item) => item.documentType))
  const { latestByType } = buildLatestDocumentsByType(documents)
  return Array.from(latestByType.entries())
    .filter(([type]) => !catalogTypes.has(type))
    .map(([, document]) => document)
}

export function getCategoryRegistrationCounts(
  category: string,
  catalog: CompanyDocumentCatalogItem[] = COMPANY_DOCUMENT_CATALOG,
  latestByType: Map<string, CompanyDocumentRecord>,
) {
  const items = catalog.filter((item) => item.documentCategory === category)
  const registered = items.filter((item) => latestByType.has(item.documentType)).length
  return { registered, total: items.length }
}

export function canPreviewCompanyDocument(document: CompanyDocumentRecord | null) {
  if (!document?.public_url) return false
  const mime = String(document.mime_type || "")
  return mime.startsWith("image/") || mime === "application/pdf"
}

export function openCompanyDocumentPreview(document: CompanyDocumentRecord) {
  const url = String(document.public_url || "").trim()
  if (!url) {
    throw new Error("미리보기 URL이 없습니다.")
  }

  const mime = String(document.mime_type || "")
  if (mime.startsWith("image/") || mime === "application/pdf") {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }

  throw new Error("브라우저에서 미리보기할 수 없는 형식입니다. 다운로드 후 확인해 주세요.")
}
