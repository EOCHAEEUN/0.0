export const MYPAGE_DOCUMENT_STORAGE_KEY = "factofit_mypage_documents"

export type StoredDocument = {
  id: string
  documentName: string
  fileName: string
  uploadedAt: string
}

export const DOCUMENT_GROUPS = [
  {
    label: "기업증빙",
    options: [
      "사업자등록증",
      "공장등록증",
      "법인등기부등본",
      "중소기업확인서",
      "재무제표",
    ],
  },
  {
    label: "세무증빙",
    options: [
      "견적서",
      "국세 납세증명서",
      "지방세 납세증명서",
      "부가가치세과세표준증명원",
      "통장사본",
    ],
  },
  {
    label: "기타증빙",
    options: [
      "참여확약서",
      "기업부설연구소인정서",
      "4대보험 가입자명부",
    ],
  },
] as const

export type DocumentGroupLabel = (typeof DOCUMENT_GROUPS)[number]["label"]

export const DOCUMENT_OPTIONS = DOCUMENT_GROUPS.flatMap((group) => [
  ...group.options,
])

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
    // localStorage 저장 실패 시 화면 동작은 유지
  }
}
