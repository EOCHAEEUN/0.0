import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchDashboardOnboarding,
  getStoredCompanyId,
} from "../../dashboard/dashboard.api"
import { mapRemoteEquipment } from "../../equipmentStatus/equipmentStatus.mapper"
import {
  findCompanyId,
  getCurrentUserId,
  getErrorMessage,
  type EquipmentInfo,
} from "../../mypage/myPage.parts"
import {
  createSafetyCheckItem,
  deleteSafetyCheckItem,
  fetchSafetyCheckItems,
  updateSafetyCheckImprovement,
} from "../safetyCheck.api"
import type { InspectionPurpose, SafetyCheckItem } from "../safetyCheck.contract"
import { PURPOSE_META } from "../safetyCheck.constants"
import { uploadInspectionPdf } from "../safetyCheck.storage"

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getStringValue(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

export type SafetyCheckTab = "equipment" | "application"

export function useSafetyCheckData() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [equipmentList, setEquipmentList] = useState<EquipmentInfo[]>([])
  const [representativeEquipmentId, setRepresentativeEquipmentId] = useState("")
  const [itemsByEquipmentId, setItemsByEquipmentId] = useState<
    Record<string, SafetyCheckItem[]>
  >({})

  const loadBaseData = useCallback(async () => {
    const onboarding = await fetchDashboardOnboarding()
    const data = getObject(onboarding) ?? {}
    const company = getObject(data.company)
    const resolvedCompanyId =
      findCompanyId(onboarding) ||
      getStringValue(company?.company_id) ||
      getStoredCompanyId() ||
      ""
    const equipments = Array.isArray(data.equipments) ? data.equipments : []

    setCompanyId(resolvedCompanyId)
    setEquipmentList(
      equipments.length > 0 ? equipments.map(mapRemoteEquipment) : [],
    )
    setRepresentativeEquipmentId(getStringValue(company?.representative_equipment_id))

    return {
      companyId: resolvedCompanyId,
      equipmentList:
        equipments.length > 0 ? equipments.map(mapRemoteEquipment) : [],
    }
  }, [])

  const loadSafetyItems = useCallback(
    async (params: { companyId: string; equipmentList: EquipmentInfo[] }) => {
      if (!params.companyId) {
        setItemsByEquipmentId({})
        return
      }

      const savedEquipments = params.equipmentList.filter((item) => item.equipmentId)
      if (savedEquipments.length === 0) {
        setItemsByEquipmentId({})
        return
      }

      const entries = await Promise.all(
        savedEquipments.map(async (equipment) => {
          const items = await fetchSafetyCheckItems({
            companyId: params.companyId,
            equipmentId: equipment.equipmentId as string,
          })
          return [equipment.equipmentId as string, items] as const
        }),
      )

      setItemsByEquipmentId(Object.fromEntries(entries))
    },
    [],
  )

  const refreshAll = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError("")

      try {
        const base = await loadBaseData()
        await loadSafetyItems(base)
      } catch (nextError) {
        setError(getErrorMessage(nextError))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [loadBaseData, loadSafetyItems],
  )

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  const representativeEquipment = useMemo(
    () => equipmentList.find((item) => item.equipmentId === representativeEquipmentId),
    [equipmentList, representativeEquipmentId],
  )

  const representativeItems = useMemo(() => {
    if (!representativeEquipmentId) return []
    return itemsByEquipmentId[representativeEquipmentId] || []
  }, [itemsByEquipmentId, representativeEquipmentId])

  const createEvidence = useCallback(
    async (params: {
      equipment: EquipmentInfo
      inspectionPurpose: InspectionPurpose
      currentSafetyMeasures: string
      file: File
    }) => {
      if (!companyId) {
        throw new Error("회사 정보를 먼저 등록해주세요.")
      }
      if (!params.equipment.equipmentId) {
        throw new Error("저장된 설비만 점검 증빙을 등록할 수 있습니다.")
      }

      const uploaded = await uploadInspectionPdf({
        file: params.file,
        inspectionPurpose: params.inspectionPurpose,
      })

      const created = await createSafetyCheckItem({
        company_id: companyId,
        user_id: getCurrentUserId() || undefined,
        equipment_id: params.equipment.equipmentId,
        equipment_name: params.equipment.name || undefined,
        inspection_purpose: params.inspectionPurpose,
        inspection_purpose_label: PURPOSE_META[params.inspectionPurpose].label,
        current_safety_measures: params.currentSafetyMeasures.trim(),
        inspection_pdf_file: uploaded.fileName,
        pdf_file_url: uploaded.publicUrl,
      })

      setItemsByEquipmentId((prev) => {
        const current = prev[params.equipment.equipmentId as string] || []
        return {
          ...prev,
          [params.equipment.equipmentId as string]: [...current, created],
        }
      })

      setFeedback("점검 증빙이 등록되었습니다.")
    },
    [companyId],
  )

  const removeEvidence = useCallback(async (item: SafetyCheckItem) => {
    await deleteSafetyCheckItem(item.id)
    setItemsByEquipmentId((prev) => {
      const current = prev[item.equipment_id] || []
      return {
        ...prev,
        [item.equipment_id]: current.filter((entry) => entry.id !== item.id),
      }
    })
    setFeedback("점검 증빙을 삭제했습니다.")
  }, [])

  const saveImprovementPlan = useCallback(
    async (params: { itemId: string; equipmentId: string; improvementPlan: string }) => {
      const updated = await updateSafetyCheckImprovement({
        itemId: params.itemId,
        improvementPlan: params.improvementPlan,
      })

      setItemsByEquipmentId((prev) => {
        const current = prev[params.equipmentId] || []
        return {
          ...prev,
          [params.equipmentId]: current.map((entry) =>
            entry.id === updated.id ? updated : entry,
          ),
        }
      })
      setFeedback("향후 관리 계획을 저장했습니다.")
    },
    [],
  )

  const clearImprovementPlan = useCallback(
    async (params: { itemId: string; equipmentId: string }) => {
      await saveImprovementPlan({
        itemId: params.itemId,
        equipmentId: params.equipmentId,
        improvementPlan: "",
      })
      setFeedback("향후 관리 계획을 삭제했습니다.")
    },
    [saveImprovementPlan],
  )

  return {
    loading,
    refreshing,
    error,
    feedback,
    setFeedback,
    companyId,
    equipmentList,
    representativeEquipmentId,
    representativeEquipment,
    representativeItems,
    itemsByEquipmentId,
    refreshAll,
    createEvidence,
    removeEvidence,
    saveImprovementPlan,
    clearImprovementPlan,
  }
}
