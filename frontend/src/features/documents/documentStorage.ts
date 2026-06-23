export const MYPAGE_DOCUMENT_STORAGE_KEY = "factofit_mypage_documents"

export type StoredDocument = {
  id: string
  documentName: string
  fileName: string
  uploadedAt: string
}

export const DOCUMENT_OPTIONS = [
  "사업자등록증",
  "재무제표",
  "설비 견적서",
  "공장등록증",
  "4대보험 가입자 명부",
  "국세·지방세 완납증명서",
  "중소기업 확인서",
  "기타 증빙서류",
]

export const POLICY_REQUIRED_DOCUMENTS = [
  "사업신청서",
  "사업계획서",
  "사업자등록증",
  "중소기업확인서",
  "공장등록증",
  "재무제표",
  "국세 납세증명서",
  "지방세 납세증명서",
]

export function normalizeDocumentName(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase()
}

function createDocumentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createStoredDocument(
  documentName: string,
  fileName: string,
): StoredDocument {
  return {
    id: createDocumentId(),
    documentName: documentName.trim(),
    fileName: fileName.trim(),
    uploadedAt: new Date().toISOString(),
  }
}

export function readStoredDocuments(): StoredDocument[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(MYPAGE_DOCUMENT_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || createDocumentId()),
        documentName: String(item.documentName || ""),
        fileName: String(item.fileName || ""),
        uploadedAt: String(item.uploadedAt || new Date().toISOString()),
      }))
      .filter((item) => item.documentName && item.fileName)
  } catch {
    return []
  }
}

export function writeStoredDocuments(documents: StoredDocument[]) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      MYPAGE_DOCUMENT_STORAGE_KEY,
      JSON.stringify(documents),
    )
  } catch {
    // Ignore localStorage failures so the upload UI can keep working.
  }
}
