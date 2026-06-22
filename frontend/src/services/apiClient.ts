const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api"

const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
).replace(/\/+$/, "")

type RefreshResult = "refreshed" | "unauthorized" | "unavailable"

let refreshPromise: Promise<RefreshResult> | null = null

export function buildApiUrl(path: string) {
  const targetPath = path.startsWith("/") ? path : `/${path}`

  if (API_BASE_URL.endsWith("/api") && targetPath.startsWith("/api/")) {
    return `${API_BASE_URL}${targetPath.slice(4)}`
  }

  if (!API_BASE_URL.endsWith("/api") && !targetPath.startsWith("/api/")) {
    return `${API_BASE_URL}/api${targetPath}`
  }

  return `${API_BASE_URL}${targetPath}`
}

export function clearLegacyAuthStorage() {
  if (typeof window === "undefined") return

  window.localStorage.removeItem("factofit_access_token")
  window.localStorage.removeItem("factofit_refresh_token")
  window.localStorage.removeItem("factofit_auth_session")
}

export function clearFactofitUserStorage() {
  if (typeof window === "undefined") return

  const keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith("factofit_")) keys.push(key)
  }
  keys.forEach((key) => window.localStorage.removeItem(key))
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(buildApiUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (response.ok) return "refreshed" as const
        if (response.status === 401 || response.status === 403) {
          return "unauthorized" as const
        }
        return "unavailable" as const
      })
      .catch(() => "unavailable" as const)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options: { retryAuth?: boolean } = {},
) {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
    },
  })

  const retryAuth = options.retryAuth ?? true
  if (response.status !== 401 || !retryAuth) {
    return response
  }

  const refreshResult = await refreshSession()
  if (refreshResult === "refreshed") {
    return fetch(buildApiUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        ...init.headers,
      },
    })
  }

  if (refreshResult === "unauthorized") {
    clearFactofitUserStorage()
    window.dispatchEvent(new Event("factofit:session-expired"))
  }
  return response
}
