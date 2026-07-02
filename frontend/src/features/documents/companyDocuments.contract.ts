export type CompanyDocumentCatalogItem = {
  documentCategory: string
  documentCategoryLabel: string
  documentType: string
  documentLabel: string
  description?: string
}

export type CompanyDocumentRecord = {
  document_id: string
  user_id: string
  company_id: string
  document_type: string
  document_label: string
  original_filename: string
  storage_bucket?: string | null
  storage_path?: string | null
  public_url?: string | null
  mime_type?: string | null
  file_size?: number | null
  parse_status?: string | null
  created_at?: string | null
  updated_at?: string | null
  document_category?: string | null
  document_category_label?: string | null
}

export type CompanyDocumentsListResponse = {
  success: boolean
  documents: CompanyDocumentRecord[]
}

export const COMPANY_DOCUMENT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const

export const COMPANY_DOCUMENT_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"

export const COMPANY_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
