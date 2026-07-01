import { hydrateAccountData } from "../../services/accountHydration"
import { getAnalysisResult } from "../onboarding/onboardingState"

function getCurrentAnalysisId(pathname: string, search: string) {
  const queryId = new URLSearchParams(search).get("analysisId")
  if (queryId) return queryId

  const pathMatch = pathname.match(/^\/analysis\/([^/]+)(?:\/|$)/)
  const pathId = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : ""
  return pathId === "new" || pathId === "review" ? "" : pathId
}

function getCurrentPolicyId(pathname: string, search: string) {
  const params = new URLSearchParams(search)
  const queryId = params.get("policyId") || params.get("policy_id")
  if (queryId) return queryId

  const policyMatch = pathname.match(/^\/analysis\/[^/]+\/policies\/([^/]+)(?:\/|$)/)
  return policyMatch?.[1] ? decodeURIComponent(policyMatch[1]) : ""
}

function readStoredPolicyId() {
  try {
    return (
      window.localStorage.getItem("factofit_policy_id") ||
      window.localStorage.getItem("factofit_selected_policy_id") ||
      window.localStorage.getItem("policy_id") ||
      window.localStorage.getItem("selected_policy_id") ||
      ""
    )
  } catch {
    return ""
  }
}

async function resolveLatestAnalysisId(pathname: string, search: string) {
  const currentAnalysisId = getCurrentAnalysisId(pathname, search)
  if (currentAnalysisId) return currentAnalysisId

  const storedLatest = getAnalysisResult()
  if (storedLatest?.id) return storedLatest.id

  await hydrateAccountData()
  const hydratedLatest = getAnalysisResult()
  if (hydratedLatest?.id) return hydratedLatest.id

  return ""
}

export async function resolveRoiNavigationPath(pathname: string, search: string) {
  const analysisId = await resolveLatestAnalysisId(pathname, search)
  if (analysisId) {
    return `/analysis/${encodeURIComponent(analysisId)}/result`
  }

  return "/analysis/new"
}

export async function resolveSupportProjectsNavigationPath(pathname: string, search: string) {
  const analysisId = await resolveLatestAnalysisId(pathname, search)
  if (analysisId) {
    return `/support-projects?analysis_id=${encodeURIComponent(analysisId)}`
  }

  return "/support-projects"
}

export async function resolveApplicationDraftNavigationPath(pathname: string, search: string) {
  const analysisId = await resolveLatestAnalysisId(pathname, search)
  if (!analysisId) {
    return "/application-draft"
  }

  const policyId = getCurrentPolicyId(pathname, search) || readStoredPolicyId()
  const query = new URLSearchParams({ analysisId })
  if (policyId) query.set("policyId", policyId)
  return `/application-draft?${query.toString()}`
}
