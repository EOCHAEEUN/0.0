import { getAccessToken } from "../../services/auth"



function getApiBase() {

  const envBase = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"

  return String(envBase).replace(/\/$/, "")

}



function buildApiUrl(path: string) {

  const base = getApiBase()

  if (base.endsWith("/api")) {

    return `${base}${path.replace(/^\/api/, "")}`

  }

  return `${base}${path}`

}



function resolveAccessToken() {

  return getAccessToken() || ""

}



export class SupportProjectsOverviewApiError extends Error {

  status: number



  constructor(message: string, status: number) {

    super(message)

    this.name = "SupportProjectsOverviewApiError"

    this.status = status

  }

}



function buildOverviewCacheKey(

  companyId: string,

  analysisId?: string,

  equipmentId?: string,

) {

  return `support-projects-overview:${companyId}:${analysisId || "live"}:${equipmentId || "all"}`

}



const overviewMemoryCache = new Map<string, unknown>()

const overviewInFlightCache = new Map<string, Promise<unknown>>()



export function clearSupportProjectsOverviewCache(

  companyId: string,

  analysisId?: string,

  equipmentId?: string,

) {

  overviewMemoryCache.delete(buildOverviewCacheKey(companyId, analysisId, equipmentId))

}



export async function fetchSupportProjectsOverview({

  companyId,

  analysisId,

  equipmentId,

  skipCache = false,

}: {

  companyId: string

  analysisId?: string

  equipmentId?: string

  skipCache?: boolean

}) {

  const cacheKey = buildOverviewCacheKey(companyId, analysisId, equipmentId)



  if (!skipCache) {

    const cached = overviewMemoryCache.get(cacheKey)

    if (cached !== undefined) return cached



    const inFlight = overviewInFlightCache.get(cacheKey)

    if (inFlight) return inFlight

  }



  const query = new URLSearchParams({ company_id: companyId })

  if (analysisId) query.set("analysis_id", analysisId)

  if (equipmentId) query.set("equipment_id", equipmentId)



  const requestPromise = fetch(

    buildApiUrl(`/api/support-projects/overview?${query.toString()}`),

    {

      method: "GET",

      headers: {

        "Content-Type": "application/json",

        ...(resolveAccessToken() ? { Authorization: `Bearer ${resolveAccessToken()}` } : {}),

      },

    },

  )

    .then(async (response) => {

      const json = (await response.json().catch(() => ({}))) as {

        success?: boolean

        data?: unknown

        detail?: string

        message?: string

      }



      if (!response.ok || json.success === false) {

        throw new SupportProjectsOverviewApiError(

          json.detail || json.message || `Support projects overview failed: ${response.status}`,

          response.status,

        )

      }



      return json.data

    })

    .then((data) => {

      overviewMemoryCache.set(cacheKey, data)

      return data

    })

    .finally(() => {

      overviewInFlightCache.delete(cacheKey)

    })



  overviewInFlightCache.set(cacheKey, requestPromise)

  return requestPromise

}



export async function refreshLiveMatchedPolicies({

  companyId,

  equipmentId,

}: {

  companyId: string

  equipmentId?: string

}) {

  const query = new URLSearchParams({

    company_id: companyId,

    limit: "40",

    refresh: "true",

  })

  if (equipmentId) query.set("equipment_id", equipmentId)



  const response = await fetch(

    buildApiUrl(`/api/analyze/support-projects?${query.toString()}`),

    {

      method: "GET",

      headers: {

        "Content-Type": "application/json",

        ...(resolveAccessToken() ? { Authorization: `Bearer ${resolveAccessToken()}` } : {}),

      },

    },

  )



  if (!response.ok) {

    const json = (await response.json().catch(() => ({}))) as { message?: string; detail?: string }

    throw new SupportProjectsOverviewApiError(

      json.detail || json.message || `Support projects refresh failed: ${response.status}`,

      response.status,

    )

  }

}


