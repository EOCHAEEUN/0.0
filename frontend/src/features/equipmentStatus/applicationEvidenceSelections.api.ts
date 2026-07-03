import type {
  ApplicationEvidenceSelection,
  ApplicationEvidenceSelectionsResponse,
  UpsertApplicationEvidenceSelectionPayload,
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

export async function fetchApplicationEvidenceSelections(params: {
  analysisId: string
  policyId: string
  equipmentId: string
}): Promise<ApplicationEvidenceSelectionsResponse> {
  const query = new URLSearchParams({
    analysis_id: params.analysisId,
    policy_id: params.policyId,
    equipment_id: params.equipmentId,
  })
  const response = await fetch(
    buildApiUrl(`/api/application-evidence-selections?${query.toString()}`),
    {
      method: "GET",
      headers: authHeaders(),
      credentials: "include",
    },
  )
  return parseJson<ApplicationEvidenceSelectionsResponse>(response)
}

export async function createApplicationEvidenceSelection(
  payload: UpsertApplicationEvidenceSelectionPayload,
) {
  const response = await fetch(buildApiUrl("/api/application-evidence-selections"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  return parseJson<{ selection: ApplicationEvidenceSelection }>(response)
}

export async function updateApplicationEvidenceSelection(params: {
  selectionId: string
  payload: Partial<UpsertApplicationEvidenceSelectionPayload>
}) {
  const response = await fetch(
    buildApiUrl(`/api/application-evidence-selections/${params.selectionId}`),
    {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(params.payload),
    },
  )
  return parseJson<{ selection: ApplicationEvidenceSelection }>(response)
}

export async function deleteApplicationEvidenceSelection(selectionId: string) {
  const response = await fetch(
    buildApiUrl(`/api/application-evidence-selections/${selectionId}`),
    {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "include",
    },
  )
  return parseJson<{ deleted_selection_id: string }>(response)
}
