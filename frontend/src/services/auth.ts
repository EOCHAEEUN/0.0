const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"
export const AUTH_EXPIRED_EVENT = "factofit:auth-expired"
const AUTH_EXPIRED_MESSAGE_KEY = "factofit_auth_expired_message"

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

function readSessionExpiry() {
  try {
    const raw = localStorage.getItem("factofit_auth_session")
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      expires_at?: number | null
      data?: { expires_at?: number | null }
      session?: { expires_at?: number | null }
    }
    const expiry =
      parsed.expires_at ?? parsed.data?.expires_at ?? parsed.session?.expires_at ?? null
    if (typeof expiry !== "number" || !Number.isFinite(expiry)) return null
    // Supabase/session payloads can be in seconds. Normalize to seconds.
    return expiry > 1_000_000_000_000 ? Math.floor(expiry / 1000) : Math.floor(expiry)
  } catch {
    return null
  }
}

export function hasValidAuthSession() {
  const token = getAccessToken()
  if (!token) return false
  const expiresAt = readSessionExpiry()
  if (!expiresAt) return true
  const now = Math.floor(Date.now() / 1000)
  return expiresAt > now
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

/**
 * refresh token이 명백히 무효(만료·폐기)라 재로그인이 필요한 경우.
 * 이 오류를 던지기 전에 refreshAccessToken이 세션을 삭제한다.
 * 네트워크 오류·5xx·파싱 오류 등 일시 장애는 일반 Error로 던지며 세션을 유지한다.
 */
export class AuthSessionInvalidError extends Error {
  constructor(message?: string) {
    super(message || "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.")
    this.name = "AuthSessionInvalidError"
  }
}

function getStoredRefreshToken(): string {
  return (
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
  )
}

let refreshPromise: Promise<string> | null = null

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken()

    if (!refreshToken) {
      clearAuthSession()
      throw new AuthSessionInvalidError()
    }

    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // 네트워크 오류 — 세션 유지
      throw new Error("인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.")
    }

    const payload = (await response.json().catch(() => null)) as
      | (ApiResponse<AuthSession> & { code?: string })
      | null

    if (response.ok && payload?.success && payload.data?.access_token) {
      // 로그아웃 등으로 refresh 도중 세션이 삭제됐다면 다시 저장하지 않는다 (세션 부활 방지)
      if (!getStoredRefreshToken()) {
        throw new AuthSessionInvalidError()
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
    }

    if (response.status === 401 && payload?.code === "REFRESH_TOKEN_INVALID") {
      // refresh token 무효가 명시된 경우에만 세션을 삭제한다
      clearAuthSession()
      throw new AuthSessionInvalidError(payload?.message)
    }

    // 5xx / 파싱 실패 / 코드 없는 401 등 그 외 모든 실패 — 일시 장애로 보고 세션 유지
    throw new Error(
      payload?.message ||
        "인증 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    )
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

export async function purgeStaleAuthSessionIfNeeded() {
  const token = getAccessToken()
  if (!token) return

  try {
    await refreshAccessToken()
  } catch {
    // refresh token 무효일 때는 refreshAccessToken이 이미 세션을 삭제했다.
    // 네트워크 오류·5xx·파싱 오류 등 일시 장애에서는 세션을 유지한다.
  }
}

export function markAuthExpired(message = "로그인이 만료되었습니다. 다시 로그인해주세요.") {
  if (typeof window === "undefined") return
  clearAuthSession()
  try {
    window.sessionStorage.setItem(AUTH_EXPIRED_MESSAGE_KEY, message)
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: { message },
    }),
  )
}

export function consumeAuthExpiredMessage() {
  if (typeof window === "undefined") return ""
  try {
    const message = window.sessionStorage.getItem(AUTH_EXPIRED_MESSAGE_KEY) || ""
    if (message) window.sessionStorage.removeItem(AUTH_EXPIRED_MESSAGE_KEY)
    return message
  } catch {
    return ""
  }
}
