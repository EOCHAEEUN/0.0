import type { AdvisorMessage } from "./aiAdvisor.contract"

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

export function toAdvisorChatHistory(
  messages: AdvisorMessage[],
): { role: string; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.text }))
}

export async function requestAdvisorAnswer(
  message: string,
  history?: { role: string; content: string }[],
) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      message,
      history: history ?? [],
      source: "global_ai_advisor",
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `AI Advisor 요청에 실패했습니다. (${response.status})`,
    )
  }

  return (
    payload?.data?.answer ||
    payload?.answer ||
    payload?.final_response ||
    payload?.message ||
    "AI 답변을 불러왔지만 표시할 문장이 없습니다."
  )
}

export function buildLocalAdvisorResponse(text: string): AdvisorMessage {
  const normalized = text.trim()

  if (!normalized) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "질문을 입력하거나 빠른 질문을 선택해 주세요.",
    }
  }

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: "현재 화면 기준으로 확인해볼게요. 저장된 기업정보, 설비정보, ROI 결과, 지원사업 매칭 결과를 함께 보면 더 정확한 판단이 가능합니다.",
  }
}
