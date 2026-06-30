import type { AdvisorApiResponse, AdvisorMessage } from "./aiAdvisor.contract"

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

function getCompanyId(): string {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem("factofit_company_id") ?? ""
}

function normalizeChatId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getSelectedEquipmentId(): string {
  if (typeof window === "undefined") return ""
  return (
    window.localStorage.getItem("factofit_selected_equipment_id") ||
    window.localStorage.getItem("factofit_equipment_id") ||
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
  options?: {
    companyId?: string
    selectedEquipmentId?: string
    policyIntentChoice?: string
    analysisId?: string
    action?: string
    chatId?: string
    sessionId?: string
  },
): Promise<AdvisorApiResponse> {
  const { companyId, selectedEquipmentId, policyIntentChoice, analysisId, action, chatId, sessionId } = options ?? {}

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      company_id: companyId ?? getCompanyId(),
      message,
      chat_history: history ?? [],
      selected_equipment_id: selectedEquipmentId ?? getSelectedEquipmentId(),
      policy_intent_choice: policyIntentChoice ?? "",
      analysis_id: analysisId ?? "",
      action: action ?? "",
      chat_id: chatId ?? "",
      session_id: sessionId ?? chatId ?? "",
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

  const answer =
    payload?.data?.answer ||
    payload?.answer ||
    payload?.response ||
    payload?.final_response ||
    payload?.message ||
    "AI 답변을 불러왔지만 표시할 문장이 없습니다."

  return {
    text: answer,
    intent: payload?.intent ?? "",
    cards: payload?.cards ?? [],
    matchedPolicies: payload?.matched_policies ?? [],
    selectedEquipmentForPolicy: payload?.selected_equipment_for_policy ?? null,
    nextQuestions: payload?.next_questions ?? [],
    chatId:
      normalizeChatId(payload?.session_id) ??
      normalizeChatId(payload?.chat_id) ??
      normalizeChatId(payload?.id),
    raw: payload,
  }
}

export async function requestAdvisorSimulation(params: {
  companyId: string
  equipmentId: string
  analysisId?: string
  scenarioAInvestmentManwon?: number
  scenarioBInvestmentManwon?: number
}) {
  const response = await fetch(`${API_BASE_URL}/roi/simulate`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      company_id: params.companyId,
      equipment_id: params.equipmentId,
      analysis_id: params.analysisId,
      scenario_a_investment_manwon: params.scenarioAInvestmentManwon,
      scenario_b_investment_manwon: params.scenarioBInvestmentManwon,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `ROI 시뮬레이션 요청에 실패했습니다. (${response.status})`,
    )
  }
  return payload?.data ?? null
}

export type AdvisorChatSessionItem = {
  session_id: string
  chat_id: string
  intent: string
  title: string
  preview: string
  updated_at: string
  created_at: string
  analysis_id: string
  equipment_id?: string
}

export async function fetchAdvisorChatSessions(companyId: string) {
  const response = await fetch(
    `${API_BASE_URL}/advisor/sessions?company_id=${encodeURIComponent(companyId)}`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `대화 내역 조회에 실패했습니다. (${response.status})`,
    )
  }
  return Array.isArray(payload?.data) ? (payload.data as AdvisorChatSessionItem[]) : []
}

export async function fetchAdvisorChatSessionDetail(
  companyId: string,
  sessionId: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/advisor/sessions/${encodeURIComponent(sessionId)}?company_id=${encodeURIComponent(companyId)}`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `대화 상세 조회에 실패했습니다. (${response.status})`,
    )
  }
  return payload?.data ?? null
}

export async function createAdvisorChatSession(params: {
  companyId: string
  analysisId?: string
  equipmentId?: string
}) {
  const response = await fetch(`${API_BASE_URL}/advisor/sessions`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      company_id: params.companyId,
      analysis_id: params.analysisId ?? "",
      equipment_id: params.equipmentId ?? "",
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.detail ||
        payload?.message ||
        `새 대화 생성에 실패했습니다. (${response.status})`,
    )
  }
  return payload?.data ?? null
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
