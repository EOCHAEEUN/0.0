import { useMemo } from "react"
import { buildApplicationDraftDashboardModel } from "../applicationDraftDashboard.utils"

export function useApplicationDraftDashboard() {
  return useMemo(() => buildApplicationDraftDashboardModel(), [])
}
