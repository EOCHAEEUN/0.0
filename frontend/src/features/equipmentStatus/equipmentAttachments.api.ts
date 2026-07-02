import type { EquipmentAttachmentType, EquipmentAttachmentsResponse } from "./equipmentAttachments.contract"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000/api"

function getAccessToken() {
  const direct = window.localStorage.getItem("factofit_access_token")
  if (direct) return direct
  const sessionRaw = window.localStorage.getItem("factofit_auth_session")
  if (!sessionRaw) return ""
  try {
    const session = JSON.parse(sessionRaw) as { access_token?: string; token?: string }
    return session.access_token || session.token || ""
  } catch {
    return ""
  }
}

function buildApiUrl(path: string) {
  if (API_BASE_URL.endsWith("/api")) {
    return `${API_BASE_URL}${path.replace(/^\/api/, "")}`
  }
  return `${API_BASE_URL}${path}`
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let payload: { success?: boolean; data?: T; message?: string; detail?: string } | null = null
  try {
    payload = JSON.parse(text) as { success?: boolean; data?: T; message?: string; detail?: string }
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detailValue = payload?.detail
    const detail =
      (typeof detailValue === "string" ? detailValue : undefined) ||
      payload?.message ||
      text.slice(0, 160) ||
      "요청을 처리하지 못했습니다."
    throw new Error(detail)
  }

  if (!payload?.data) {
    throw new Error("응답 형식이 올바르지 않습니다.")
  }
  return payload.data
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAccessToken()
  return {
        ...(extra || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
}

export async function fetchEquipmentAttachments(
  equipmentId: string,
): Promise<EquipmentAttachmentsResponse> {
  const response = await fetch(buildApiUrl(`/api/equipment/${equipmentId}/attachments`), {
    method: "GET",
    headers: authHeaders(),
    credentials: "include",
  })
  return parseJson<EquipmentAttachmentsResponse>(response)
}

export async function uploadEquipmentAttachment(params: {
  equipmentId: string
  file: File
  attachmentType: EquipmentAttachmentType
  isPrimaryPhoto?: boolean
}) {
  const body = new FormData()
  body.set("attachment_type", params.attachmentType)
  body.set("is_primary_photo", params.isPrimaryPhoto ? "true" : "false")
  body.set("file", params.file)

  const response = await fetch(
    buildApiUrl(`/api/equipment/${params.equipmentId}/attachments`),
    {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body,
    },
  )
  return parseJson<{ attachment: EquipmentAttachmentsResponse["attachments"][number]; total_count: number }>(
    response,
  )
}

export async function deleteEquipmentAttachment(params: {
  equipmentId: string
  attachmentId: string
}) {
  const response = await fetch(
    buildApiUrl(
      `/api/equipment/${params.equipmentId}/attachments/${params.attachmentId}`,
    ),
    {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "include",
    },
  )
  return parseJson<{ deleted_attachment_id: string; total_count: number }>(response)
}

export async function setEquipmentAttachmentPrimary(params: {
  equipmentId: string
  attachmentId: string
}) {
  const response = await fetch(
    buildApiUrl(
      `/api/equipment/${params.equipmentId}/attachments/${params.attachmentId}/primary`,
    ),
    {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
    },
  )
  return parseJson<{ attachment: EquipmentAttachmentsResponse["attachments"][number] }>(response)
}
