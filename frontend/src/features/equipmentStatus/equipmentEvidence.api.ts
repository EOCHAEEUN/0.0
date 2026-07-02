import type {
  CreateEquipmentEvidencePayload,
  EquipmentEvidenceRecord,
  EquipmentEvidenceRecordsResponse,
  UpdateEquipmentEvidencePayload,
} from "./equipmentEvidence.contract"

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
    payload = JSON.parse(text) as {
      success?: boolean
      data?: T
      message?: string
      detail?: string
    }
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "근거 API가 아직 연결되지 않았습니다. Backend API 준비 전에는 frontend/.env.local에 VITE_EQUIPMENT_EVIDENCE_USE_MOCK=true 를 설정해 주세요.",
      )
    }
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

export async function fetchEquipmentEvidenceRecords(
  equipmentId: string,
): Promise<EquipmentEvidenceRecordsResponse> {
  const response = await fetch(
    buildApiUrl(`/api/equipment/${equipmentId}/evidence-records`),
    {
      method: "GET",
      headers: authHeaders(),
      credentials: "include",
    },
  )
  return parseJson<EquipmentEvidenceRecordsResponse>(response)
}

export async function createEquipmentEvidenceRecord(params: {
  equipmentId: string
  payload: CreateEquipmentEvidencePayload
}) {
  const response = await fetch(
    buildApiUrl(`/api/equipment/${params.equipmentId}/evidence-records`),
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(params.payload),
    },
  )
  return parseJson<{ record: EquipmentEvidenceRecord; total_count: number }>(response)
}

export async function updateEquipmentEvidenceRecord(params: {
  equipmentId: string
  evidenceId: string
  payload: UpdateEquipmentEvidencePayload
}) {
  const response = await fetch(
    buildApiUrl(
      `/api/equipment/${params.equipmentId}/evidence-records/${params.evidenceId}`,
    ),
    {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(params.payload),
    },
  )
  return parseJson<{ record: EquipmentEvidenceRecord }>(response)
}

export async function deleteEquipmentEvidenceRecord(params: {
  equipmentId: string
  evidenceId: string
}) {
  const response = await fetch(
    buildApiUrl(
      `/api/equipment/${params.equipmentId}/evidence-records/${params.evidenceId}`,
    ),
    {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "include",
    },
  )
  return parseJson<{ deleted_evidence_id: string; total_count: number }>(response)
}
