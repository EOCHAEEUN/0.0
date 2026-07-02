import { useCallback, useEffect, useMemo, useState } from "react"
import type {
  CreateEquipmentEvidencePayload,
  EquipmentEvidenceRecord,
  UpdateEquipmentEvidencePayload,
} from "../equipmentEvidence.contract"
import {
  EQUIPMENT_EVIDENCE_USE_MOCK,
  getEquipmentEvidenceRecords,
  initializeEquipmentEvidenceMockSeed,
  removeEquipmentEvidenceRecord,
  saveEquipmentEvidenceRecord,
} from "../equipmentEvidence.client"
import { computeEvidenceSummaryStats } from "../equipmentEvidence.utils"

type UseEquipmentEvidenceRecordsOptions = {
  equipmentId?: string
  companyId?: string
  enabled?: boolean
}

export function useEquipmentEvidenceRecords({
  equipmentId,
  companyId,
  enabled = true,
}: UseEquipmentEvidenceRecordsOptions) {
  const [records, setRecords] = useState<EquipmentEvidenceRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    if (!equipmentId || !enabled) {
      setRecords([])
      setTotalCount(0)
      return
    }

    if (EQUIPMENT_EVIDENCE_USE_MOCK && companyId) {
      initializeEquipmentEvidenceMockSeed({
        equipmentId,
        companyId,
      })
    }

    setLoading(true)
    setError("")
    try {
      const data = await getEquipmentEvidenceRecords(equipmentId)
      setRecords(data.records)
      setTotalCount(data.total_count)
    } catch (nextError) {
      setRecords([])
      setTotalCount(0)
      setError(
        nextError instanceof Error
          ? nextError.message
          : "안전·정비 근거를 불러오지 못했습니다.",
      )
    } finally {
      setLoading(false)
    }
  }, [companyId, enabled, equipmentId])

  useEffect(() => {
    void reload()
  }, [reload])

  const stats = useMemo(() => computeEvidenceSummaryStats(records), [records])

  const saveRecord = useCallback(
    async (params: {
      evidenceId?: string
      payload: CreateEquipmentEvidencePayload | UpdateEquipmentEvidencePayload
    }) => {
      if (!equipmentId) return null
      setSaving(true)
      setError("")
      try {
        const result = await saveEquipmentEvidenceRecord({
          equipmentId,
          evidenceId: params.evidenceId,
          payload: params.payload,
        })
        await reload()
        return result.record
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "근거 저장에 실패했습니다."
        setError(message)
        throw nextError
      } finally {
        setSaving(false)
      }
    },
    [equipmentId, reload],
  )

  const deleteRecord = useCallback(
    async (evidenceId: string) => {
      if (!equipmentId) return
      setError("")
      try {
        await removeEquipmentEvidenceRecord({ equipmentId, evidenceId })
        await reload()
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : "근거 삭제에 실패했습니다."
        setError(message)
        throw nextError
      }
    },
    [equipmentId, reload],
  )

  return {
    records,
    totalCount,
    stats,
    loading,
    saving,
    error,
    reload,
    saveRecord,
    deleteRecord,
  }
}
