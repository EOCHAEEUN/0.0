const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"

export type AuthSession = {
  access_token: string | null
  refresh_token: string | null
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
}

function getCompanyIdFromSession(session: AuthSession) {
  if (session.company_id) return session.company_id

  const nestedCompanyId = session.company?.company_id

  return typeof nestedCompanyId === "string" ? nestedCompanyId : null
}

export function saveAuthSession(session: AuthSession) {
  if (session.access_token) {
    localStorage.setItem("factofit_access_token", session.access_token)
  }

  if (session.refresh_token) {
    localStorage.setItem("factofit_refresh_token", session.refresh_token)
  }

  const companyId = getCompanyIdFromSession(session)

  if (companyId) {
    localStorage.setItem("factofit_company_id", companyId)
  }

  localStorage.setItem("factofit_auth_session", JSON.stringify(session))
}

export function getAccessToken() {
  return localStorage.getItem("factofit_access_token")
}

async function postAuth<T>(
  path: string,
  payload: unknown,
  options: { authenticated?: boolean } = {},
): Promise<T> {
  const token = options.authenticated ? getAccessToken() : null

  if (options.authenticated && !token) {
    throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.")
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  const json = (await response.json()) as ApiResponse<T>

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error || json.message || "API request failed.")
  }

  return json.data
}

export async function signupWithProfile(payload: unknown) {
  return postAuth<AuthSession>("/auth/signup", payload, { authenticated: true })
}

export async function loginWithPassword(email: string, password: string) {
  return postAuth<AuthSession>("/auth/login", { email, password })
}

export async function sendSignupEmailCode(email: string) {
  return postAuth<{ email: string; message: string }>("/auth/send-email-code", {
    email,
  })
}

export async function verifySignupEmailCode(email: string, token: string) {
  return postAuth<AuthSession>("/auth/verify-email-code", { email, token })
}

export async function createCompanyOnboarding(payload: unknown) {
  return postAuth<{ company_id: string; company: Record<string, unknown> }>(
    "/onboarding",
    payload,
    { authenticated: true },
  )
}