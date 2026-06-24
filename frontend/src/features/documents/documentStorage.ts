export type StoredDocument = {
  id: string
  documentName: string
  fileName: string
  savedAt: string
}

export const MYPAGE_DOCUMENT_STORAGE_KEY = "factofit_mypage_documents"

export const DOCUMENT_OPTIONS = [
  "사업신청서",
  "사업계획서",
  "사업자등록증",
  "참여확약서",
  "재무제표",
  "공장등록증",
  "법인등기부등본",
  "중소기업확인서",
  "개인정보 수집·이용 동의서",
  "신용정보 조회 동의서",
  "국세 납세증명서",
  "지방세 납세증명서",
  "지식재산권·인증 증빙",
  "견적서",
  "부가가치세과세표준증명원",
  "기업부설연구소 인정서",
  "통장사본",
  "4대보험 가입자명부",
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

export const DEFAULT_SAVED_DOCUMENTS: StoredDocument[] = [
  {
    id: "default-business-registration",
    documentName: "사업자등록증",
    fileName: "사업자등록증.pdf",
    savedAt: "샘플 저장 문서",
  },
  {
    id: "default-sme-confirmation",
    documentName: "중소기업확인서",
    fileName: "중소기업확인서.pdf",
    savedAt: "샘플 저장 문서",
  },
]

export function normalizeDocumentName(value: string) {
  return value.replace(/\s+/g, "").trim()
}

export function createStoredDocument(documentName: string, fileName: string): StoredDocument {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    documentName,
    fileName,
    savedAt: new Date().toISOString(),
  }
}

export function readStoredDocuments() {
  if (typeof window === "undefined") return DEFAULT_SAVED_DOCUMENTS

  const rawValue = window.localStorage.getItem(MYPAGE_DOCUMENT_STORAGE_KEY)
  if (!rawValue) return DEFAULT_SAVED_DOCUMENTS

  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) return DEFAULT_SAVED_DOCUMENTS

    const documents = parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const record = item as Partial<StoredDocument>
        const documentName = String(record.documentName ?? "").trim()
        const fileName = String(record.fileName ?? "").trim()
        if (!documentName || !fileName) return null

        return {
          id: String(record.id ?? `${documentName}-${fileName}`),
          documentName,
          fileName,
          savedAt: String(record.savedAt ?? ""),
        } satisfies StoredDocument
      })
      .filter((item): item is StoredDocument => Boolean(item))

    return documents.length > 0 ? documents : DEFAULT_SAVED_DOCUMENTS
  } catch {
    return DEFAULT_SAVED_DOCUMENTS
  }
}

export function writeStoredDocuments(documents: StoredDocument[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MYPAGE_DOCUMENT_STORAGE_KEY, JSON.stringify(documents))
}
