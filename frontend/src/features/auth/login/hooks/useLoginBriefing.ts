import { useCallback, useEffect, useState } from "react"

import {
  fetchLoginBriefing,
  type LoginBriefingResponse,
} from "../loginBriefing.api"

export function useLoginBriefing(enabled: boolean) {
  const [data, setData] = useState<LoginBriefingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchLoginBriefing()
      setData(next)
    } catch (loadError) {
      setData(null)
      setError(
        loadError instanceof Error
          ? loadError.message
          : "진단 정보를 불러오지 못했습니다.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  return {
    data,
    loading,
    error,
    reload: load,
  }
}
