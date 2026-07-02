import { useCallback, useEffect, useState } from "react"
import type { ApplicationEvidenceSelection } from "../equipmentEvidence.contract"
import {
  getApplicationEvidenceSelections,
  saveApplicationEvidenceSelectionBatch,
} from "../equipmentEvidence.client"

type UseApplicationEvidenceSelectionsOptions = {
  analysisId?: string
  policyId?: string
  equipmentId?: string
  companyId?: string
  enabled?: boolean
}

export function useApplicationEvidenceSelections({
  analysisId,
  policyId,
  equipmentId,
  companyId,
  enabled = true,
}: UseApplicationEvidenceSelectionsOptions) {
  const [selections, setSelections] = useState<ApplicationEvidenceSelection[]>([])
  const [selectedCount, setSelectedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const canLoad = Boolean(
    enabled && analysisId && policyId && equipmentId,
  )

  const reload = useCallback(async () => {
    if (!canLoad || !analysisId || !policyId || !equipmentId) {
      setSelections([])
      setSelectedCount(0)
      return
    }

    setLoading(true)
    setError("")
    try {
      const data = await getApplicationEvidenceSelections({
        analysisId,
        policyId,
        equipmentId,
      })
      setSelections(data.selections)
      setSelectedCount(data.selected_count)
    } catch (nextError) {
      setSelections([])
      setSelectedCount(0)
      setError(
        nextError instanceof Error
          ? nextError.message
          : "신청서 반영 선택을 불러오지 못했습니다.",
      )
    } finally {
      setLoading(false)
    }
  }, [analysisId, canLoad, equipmentId, policyId])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveSelections = useCallback(
    async (
      items: Array<{
        evidence_id: string
        application_section: ApplicationEvidenceSelection["application_section"]
        reflected_text: string
        is_selected: boolean
        selection_id?: string
      }>,
    ) => {
      if (!canLoad || !analysisId || !policyId || !equipmentId || !companyId) {
        throw new Error("신청서 반영에 필요한 정보가 부족합니다.")
      }

      setSaving(true)
      setError("")
      try {
        const data = await saveApplicationEvidenceSelectionBatch({
          analysisId,
          policyId,
          equipmentId,
          companyId,
          items,
        })
        setSelections(data.selections)
        setSelectedCount(data.selected_count)
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "신청서 반영 선택 저장에 실패했습니다."
        setError(message)
        throw nextError
      } finally {
        setSaving(false)
      }
    },
    [analysisId, canLoad, companyId, equipmentId, policyId],
  )

  return {
    selections,
    selectedCount,
    loading,
    saving,
    error,
    canLoad,
    reload,
    saveSelections,
  }
}
