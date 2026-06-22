import {
  apiFetch,
  clearFactofitUserStorage,
  clearLegacyAuthStorage,
} from "./apiClient"

export type AuthSession = {
  expires_at: number | null
  user: {
    id: string | null
    email: string | null
  }
  user_profile?: Record<string, unknown> | null
  company?: Record<string, unknown> | null
  company_id?: string | null
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
  error?: string
  detail?: string
}

function getCompanyIdFromSession(session: AuthSession) {
  if (session.company_id) return session.company_id

  const nestedCompanyId = session.company?.company_id
  return typeof nestedCompanyId === "string" ? nestedCompanyId : null
}

export function saveAuthSession(session: AuthSession) {
  clearLegacyAuthStorage()
  localStorage.setItem("factofit_auth_session", JSON.stringify(session))

  const companyId = getCompanyIdFromSession(session)
  if (companyId) {
    localStorage.setItem("factofit_company_id", companyId)
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as ApiResponse<T>

  if (!response.ok || !json.success || !json.data) {
    throw new Error(
      json.error || json.message || json.detail || "API request failed.",
    )
  }

  return json.data
}

async function postAuth<T>(
  path: string,
  payload?: unknown,
  options: { retryAuth?: boolean } = {},
): Promise<T> {
  const response = await apiFetch(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    },
    options,
  )

  return readApiResponse<T>(response)
}

export async function signupWithProfile(payload: unknown) {
  return postAuth<AuthSession>("/auth/signup", payload)
}

export async function loginWithPassword(email: string, password: string) {
  return postAuth<AuthSession>(
    "/auth/login",
    { email, password },
    { retryAuth: false },
  )
}

export async function sendSignupEmailCode(email: string) {
  return postAuth<{ email: string; message: string }>(
    "/auth/send-email-code",
    { email },
    { retryAuth: false },
  )
}

export async function verifySignupEmailCode(email: string, token: string) {
  return postAuth<AuthSession>(
    "/auth/verify-email-code",
    { email, token },
    { retryAuth: false },
  )
}

export async function createCompanyOnboarding(payload: unknown) {
  return postAuth<{ company_id: string; company: Record<string, unknown> }>(
    "/onboarding",
    payload,
  )
}

export async function getCurrentAuthSession() {
  const response = await apiFetch(
    "/auth/session",
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
    { timeoutMs: 8000 },
  )
  return readApiResponse<AuthSession>(response)
}

export async function logoutCurrentSession() {
  try {
    await apiFetch(
      "/auth/logout",
      {
        method: "POST",
        headers: { Accept: "application/json" },
      },
      { retryAuth: false },
    )
  } catch {
    // 서버 연결이 끊겨도 브라우저의 로그인 흔적은 제거한다.
  } finally {
    clearFactofitUserStorage()
  }
}
