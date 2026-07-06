import { buildApiUrl, getAccessToken } from "../mypage/myPage.parts"
import type {
  SafetyCheckCreatePayload,
  SafetyCheckImprovementPayload,
  SafetyCheckItem,
  SafetyCheckListResponse,
} from "./safetyCheck.contract"

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  const payload = (() => {
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return null
    }
  })()

  if (!response.ok) {
    const detail =
      (typeof payload?.detail === "string" ? payload.detail : undefined) ||
      (typeof payload?.message === "string" ? payload.message : undefined) ||
      text.slice(0, 180) ||
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

export async function fetchSafetyCheckItems(params: {
  companyId: string
  equipmentId: string
}): Promise<SafetyCheckItem[]> {
  const response = await fetch(
    buildApiUrl(
      `/api/safety-check/${encodeURIComponent(params.companyId)}/${encodeURIComponent(params.equipmentId)}`,
    ),
    {
      method: "GET",
      headers: authHeaders(),
      credentials: "include",
    },
  )

  const payload = await parseResponse<SafetyCheckListResponse>(response)
  return payload.items || []
}

export async function createSafetyCheckItem(payload: SafetyCheckCreatePayload) {
  const response = await fetch(buildApiUrl("/api/safety-check/create"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(payload),
  })

  return parseResponse<SafetyCheckItem>(response)
}

export async function updateSafetyCheckImprovement(params: {
  itemId: string
  improvementPlan: string
  additionalInfo: string
}) {
  const body: SafetyCheckImprovementPayload = {
    improvement_plan: params.improvementPlan,
    additional_info: params.additionalInfo,
  }

  const response = await fetch(
    buildApiUrl(`/api/safety-check/${encodeURIComponent(params.itemId)}/improvement`),
    {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(body),
    },
  )

  return parseResponse<SafetyCheckItem>(response)
}

export async function deleteSafetyCheckItem(itemId: string) {
  const response = await fetch(buildApiUrl(`/api/safety-check/${encodeURIComponent(itemId)}`), {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "include",
  })

  return parseResponse<{ success: boolean; message?: string }>(response)
}
