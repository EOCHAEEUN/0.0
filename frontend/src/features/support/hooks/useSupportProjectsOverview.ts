import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  clearSupportProjectsOverviewCache,
  fetchSupportProjectsOverview,
  refreshLiveMatchedPolicies,
  SupportProjectsOverviewApiError,
} from "../supportProjectsOverview.api"
import { mapSupportProjectsOverview } from "../supportProjectsOverview.mapper"
import type { SupportProjectsViewState } from "../supportProjectsOverview.types"
import { getAccessToken } from "../../../services/auth"

const COMPANY_ID_STORAGE_KEY = "factofit_company_id"

function readCompanyIdFromStorage() {
  try {
    return window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || ""
  } catch {
    return ""
  }
}

function readEquipmentIdFromStorage() {
  try {
    return (
      window.localStorage.getItem("factofit_selected_equipment_id") ||
      window.localStorage.getItem("factofit_equipment_id") ||
      ""
    )
  } catch {
    return ""
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export function useSupportProjectsOverview({
  companyId,
  analysisId,
  equipmentId,
}: {
  companyId: string
  analysisId?: string
  equipmentId?: string
}) {
  const [state, setState] = useState<SupportProjectsViewState>({ kind: "loading" })
  const [isRecalculating, setIsRecalculating] = useState(false)
  const requestIdRef = useRef(0)
  const hasRenderableDataRef = useRef(false)
  const loadedFetchKeyRef = useRef<string | null>(null)

  const fetchKey = useMemo(
    () => `${companyId}|${analysisId || ""}|${equipmentId || ""}`,
    [analysisId, companyId, equipmentId],
  )

  const loadOverview = useCallback(async (options?: { force?: boolean }) => {
    const resolvedCompanyId = companyId || readCompanyIdFromStorage()
    if (!resolvedCompanyId) {
      hasRenderableDataRef.current = false
      setState({
        kind: "error",
        message: "기업 정보가 없습니다. 마이페이지에서 기업을 등록해주세요.",
      })
      return
    }

    if (!getAccessToken()) {
      hasRenderableDataRef.current = false
      setState({
        kind: "error",
        message: "로그인이 필요합니다. 다시 로그인한 뒤 이용해주세요.",
        status: 401,
        isAuthError: true,
      })
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (!hasRenderableDataRef.current) {
      setState({ kind: "loading" })
    }

    try {
      const data = await fetchSupportProjectsOverview({
        companyId: resolvedCompanyId,
        analysisId,
        equipmentId: equipmentId || readEquipmentIdFromStorage(),
        skipCache: options?.force,
      })

      if (requestId !== requestIdRef.current) return

      const model = mapSupportProjectsOverview(data, {
        companyId: resolvedCompanyId,
        analysisId,
      })

      if (model.legacyState === "POLICY_SNAPSHOT_MISSING") {
        hasRenderableDataRef.current = true
        setState({ kind: "legacy_missing", model })
        return
      }

      const hasSnapshotPolicies =
        Boolean(model.priorityPolicy) ||
        model.priorityPolicies.length > 0 ||
        model.allMatched.length > 0

      if (!hasSnapshotPolicies && model.liveDiscovery.items.length === 0) {
        hasRenderableDataRef.current = true
        setState({ kind: "empty", model })
        return
      }

      hasRenderableDataRef.current = true
      setState({ kind: "ready", model })
    } catch (error: unknown) {
      if (requestId !== requestIdRef.current) return
      if (isAbortError(error)) return

      const message =
        error instanceof SupportProjectsOverviewApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "지원사업 정보를 불러오지 못했습니다."

      const status = error instanceof SupportProjectsOverviewApiError ? error.status : undefined
      const isAuthError =
        status === 401 ||
        message.toLowerCase().includes("access token") ||
        message.includes("Authorization header")

      hasRenderableDataRef.current = false
      setState({
        kind: "error",
        message: isAuthError
          ? "로그인이 만료되었거나 인증 정보가 없습니다. 다시 로그인한 뒤 이용해주세요."
          : message,
        status,
        isAuthError,
        previous: null,
      })
    }
  }, [analysisId, companyId, equipmentId])

  useEffect(() => {
    const isNewContext = loadedFetchKeyRef.current !== fetchKey
    if (isNewContext) {
      hasRenderableDataRef.current = false
      loadedFetchKeyRef.current = fetchKey
    }

    void loadOverview()

    return () => {
      requestIdRef.current += 1
    }
  }, [fetchKey, loadOverview])

  const reload = useCallback(async () => {
    const resolvedCompanyId = companyId || readCompanyIdFromStorage()
    if (resolvedCompanyId) {
      clearSupportProjectsOverviewCache(
        resolvedCompanyId,
        analysisId,
        equipmentId || readEquipmentIdFromStorage(),
      )
    }
    await loadOverview({ force: true })
  }, [analysisId, companyId, equipmentId, loadOverview])

  const recalculateLiveMatches = useCallback(async () => {
    const resolvedCompanyId = companyId || readCompanyIdFromStorage()
    const resolvedEquipmentId = equipmentId || readEquipmentIdFromStorage()
    if (!resolvedCompanyId || analysisId) return

    setIsRecalculating(true)
    try {
      await refreshLiveMatchedPolicies({
        companyId: resolvedCompanyId,
        equipmentId: resolvedEquipmentId,
      })
      clearSupportProjectsOverviewCache(resolvedCompanyId, analysisId, resolvedEquipmentId)
      await loadOverview({ force: true })
    } catch (error: unknown) {
      if (isAbortError(error)) return

      const message =
        error instanceof SupportProjectsOverviewApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "최신 추천을 다시 계산하지 못했습니다."
      setState({ kind: "error", message })
    } finally {
      setIsRecalculating(false)
    }
  }, [analysisId, companyId, equipmentId, loadOverview])

  return {
    state,
    reload,
    recalculateLiveMatches,
    isRecalculating,
  }
}
