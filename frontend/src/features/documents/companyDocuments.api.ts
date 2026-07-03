import { buildApiUrl, getAccessToken } from "../mypage/myPage.parts"
import type {
  CompanyDocumentRecord,
  CompanyDocumentsListResponse,
} from "./companyDocuments.contract"

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let payload: Record<string, unknown> | null = null
  try {
    payload = JSON.parse(text) as Record<string, unknown>
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      (typeof payload?.detail === "string" ? payload.detail : undefined) ||
      (typeof payload?.message === "string" ? payload.message : undefined) ||
      text.slice(0, 160) ||
      "요청을 처리하지 못했습니다."
    throw new Error(detail)
  }

  return payload as T
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAccessToken()
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function fetchCompanyDocuments(params: {
  companyId: string
  userId?: string
  documentType?: string
}) {
  const query = new URLSearchParams()
  if (params.userId) query.set("user_id", params.userId)
  if (params.documentType) query.set("document_type", params.documentType)

  const suffix = query.toString() ? `?${query.toString()}` : ""
  const response = await fetch(
    buildApiUrl(`/api/documents/company/${params.companyId}${suffix}`),
    {
      method: "GET",
      headers: authHeaders(),
      credentials: "include",
    },
  )

  const payload = await parseResponse<CompanyDocumentsListResponse>(response)
  return payload.documents || []
}

export async function uploadCompanyDocument(params: {
  userId: string
  companyId: string
  documentType: string
  documentLabel: string
  file: File
}) {
  const body = new FormData()
  body.set("user_id", params.userId)
  body.set("company_id", params.companyId)
  body.set("document_type", params.documentType)
  body.set("document_label", params.documentLabel)
  body.set("file", params.file)

  const response = await fetch(buildApiUrl("/api/documents/upload"), {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body,
  })

  const payload = await parseResponse<{ success: boolean; data: CompanyDocumentRecord }>(
    response,
  )
  return payload.data
}
