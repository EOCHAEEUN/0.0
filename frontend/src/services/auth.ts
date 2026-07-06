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
  const direct = localStorage.getItem("factofit_access_token")
  if (direct?.trim()) return direct.trim()

  try {
    const raw = localStorage.getItem("factofit_auth_session")
    if (raw) {
      const session = JSON.parse(raw) as Record<string, unknown>
      const sessionData = session.data as Record<string, unknown> | undefined
      const nestedSession = session.session as Record<string, unknown> | undefined
      const token =
        session.access_token ??
        sessionData?.access_token ??
        nestedSession?.access_token

      if (typeof token === "string" && token.trim()) return token.trim()
    }
  } catch {
    // ignore malformed session payload
  }

  const legacy =
    localStorage.getItem("access_token") ?? localStorage.getItem("token")
  return legacy?.trim() ? legacy.trim() : null
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

export function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem("factofit_auth_session")
    if (!raw) return null
    const session = JSON.parse(raw) as { user?: { id?: string | null } }
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

export function clearAuthSession() {
  localStorage.removeItem("factofit_access_token")
  localStorage.removeItem("factofit_refresh_token")
  localStorage.removeItem("factofit_company_id")
  localStorage.removeItem("factofit_auth_session")
}

let refreshPromise: Promise<string> | null = null

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken =
      localStorage.getItem("factofit_refresh_token")?.trim() ||
      (() => {
        try {
          const raw = localStorage.getItem("factofit_auth_session")
          if (!raw) return ""
          const session = JSON.parse(raw) as Record<string, unknown>
          return typeof session.refresh_token === "string"
            ? session.refresh_token.trim()
            : ""
        } catch {
          return ""
        }
      })()

    if (!refreshToken) {
      throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.")
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const payload = (await response.json()) as ApiResponse<AuthSession>
    if (!response.ok || !payload.success || !payload.data?.access_token) {
      clearAuthSession()
      throw new Error(
        payload.message || "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      )
    }

    const previous = (() => {
      try {
        return JSON.parse(
          localStorage.getItem("factofit_auth_session") || "{}",
        ) as Partial<AuthSession>
      } catch {
        return {}
      }
    })()
    const nextSession: AuthSession = {
      ...previous,
      ...payload.data,
      user: payload.data.user || previous.user || { id: null, email: null },
    }
    saveAuthSession(nextSession)
    return nextSession.access_token || ""
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}
