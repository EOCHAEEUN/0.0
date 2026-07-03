import type {
  PreWorkChecklistResponse,
  SafetyCheckStatusPayload,
  SafetyDashboardResponse,
} from "./safety.contract"

const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:8000/api"
).replace(/\/$/, "")

function getAccessToken() {
  return (
    window.localStorage.getItem("factofit_access_token") ||
    window.localStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    ""
  )
}

function buildHeaders() {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null

  if (!response.ok) {
    const errorPayload = payload as Record<string, unknown> | null
    const detail = errorPayload?.detail
    const message =
      typeof errorPayload?.message === "string"
        ? errorPayload.message
        : typeof detail === "string"
          ? detail
          : `요청에 실패했습니다. (${response.status})`

    throw new Error(message)
  }

  if (!payload) {
    throw new Error("응답 데이터가 비어 있습니다.")
  }

  return payload
}

export async function fetchSafetyDashboard() {
  const response = await fetch(`${API_BASE_URL}/safety/dashboard`, {
    method: "GET",
    headers: buildHeaders(),
  })

  return parseJson<SafetyDashboardResponse>(response)
}

export async function fetchPreWorkChecklist(equipmentId: string) {
  const url = new URL(`${API_BASE_URL}/safety/pre-work-checklist`)
  url.searchParams.set("equipment_id", equipmentId)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildHeaders(),
  })

  return parseJson<PreWorkChecklistResponse>(response)
}

export async function updateSafetyCheckStatus(payload: SafetyCheckStatusPayload) {
  const response = await fetch(`${API_BASE_URL}/safety/check-status`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  })

  return parseJson<{ success?: boolean; data?: unknown; message?: string }>(
    response,
  )
}
