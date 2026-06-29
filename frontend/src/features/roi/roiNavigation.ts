import { hydrateAccountData } from "../../services/accountHydration"
import { getAnalysisResult } from "../onboarding/onboardingState"

function getCurrentAnalysisId(pathname: string, search: string) {
  const queryId = new URLSearchParams(search).get("analysisId")
  if (queryId) return queryId

  const pathMatch = pathname.match(/^\/analysis\/([^/]+)(?:\/|$)/)
  const pathId = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : ""
  return pathId === "new" || pathId === "review" ? "" : pathId
}

export async function resolveRoiNavigationPath(pathname: string, search: string) {
  const currentAnalysisId = getCurrentAnalysisId(pathname, search)
  if (currentAnalysisId) {
    return `/analysis/${encodeURIComponent(currentAnalysisId)}/result`
  }

  const storedLatest = getAnalysisResult()
  if (storedLatest?.id) {
    return `/analysis/${encodeURIComponent(storedLatest.id)}/result`
  }

  await hydrateAccountData()
  const hydratedLatest = getAnalysisResult()
  if (hydratedLatest?.id) {
    return `/analysis/${encodeURIComponent(hydratedLatest.id)}/result`
  }

  return "/analysis/new"
}
