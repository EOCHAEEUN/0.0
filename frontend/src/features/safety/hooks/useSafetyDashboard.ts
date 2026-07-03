import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchPreWorkChecklist,
  fetchSafetyDashboard,
  updateSafetyCheckStatus,
} from "../safety.api"
import type {
  PreWorkChecklistData,
  SafetyCheckStatusPayload,
  SafetyDashboardData,
  SafetyEquipmentDashboardItem,
} from "../safety.contract"

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const date = String(now.getDate()).padStart(2, "0")

  return `${year}-${month}-${date}`
}

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

export function useSafetyDashboard() {
  const [dashboard, setDashboard] = useState<SafetyDashboardData | null>(null)
  const [preWorkChecklist, setPreWorkChecklist] =
    useState<PreWorkChecklistData | null>(null)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("")
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [toastMessage, setToastMessage] = useState("")

  const loadDashboard = useCallback(async () => {
    setIsLoadingDashboard(true)
    setErrorMessage("")

    try {
      const response = await fetchSafetyDashboard()
      const nextDashboard = response.data ?? null
      const firstEquipment = nextDashboard?.items?.[0]
      const storedEquipmentId =
        readLocalStorage("factofit_selected_equipment_id") ||
        readLocalStorage("factofit_equipment_id") ||
        readLocalStorage("equipment_id")

      setDashboard(nextDashboard)

      setSelectedEquipmentId((current) => {
        if (current) return current

        const hasStored = nextDashboard?.items?.some(
          (item) => item.equipment_id === storedEquipmentId,
        )

        if (hasStored) return storedEquipmentId

        return firstEquipment?.equipment_id ?? ""
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "안전점검 대시보드를 불러오지 못했습니다.",
      )
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [])

  const loadPreWorkChecklist = useCallback(async (equipmentId: string) => {
    if (!equipmentId) {
      setPreWorkChecklist(null)
      return
    }

    setIsLoadingChecklist(true)
    setErrorMessage("")

    try {
      const response = await fetchPreWorkChecklist(equipmentId)
      setPreWorkChecklist(response.data ?? null)
    } catch (error) {
      setPreWorkChecklist(null)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "작업 전 체크리스트를 불러오지 못했습니다.",
      )
    } finally {
      setIsLoadingChecklist(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    loadPreWorkChecklist(selectedEquipmentId)
  }, [loadPreWorkChecklist, selectedEquipmentId])

  const equipmentItems = useMemo(
    () => dashboard?.items ?? [],
    [dashboard?.items],
  )

  const selectedEquipment = useMemo<SafetyEquipmentDashboardItem | null>(
    () =>
      equipmentItems.find(
        (item) => item.equipment_id === selectedEquipmentId,
      ) ??
      equipmentItems[0] ??
      null,
    [equipmentItems, selectedEquipmentId],
  )

  const unsupportedEquipmentNames = useMemo(
    () => dashboard?.unsupported_equipment_names ?? [],
    [dashboard?.unsupported_equipment_names],
  )

  const handleSelectEquipment = useCallback(
    (equipment: SafetyEquipmentDashboardItem) => {
      const name = equipment.equipment_name ?? ""

      if (unsupportedEquipmentNames.includes(name)) {
        setToastMessage(
          "현재 안전점검은 프레스, CNC, 사출성형기만 지원합니다.",
        )
        return
      }

      setSelectedEquipmentId(equipment.equipment_id ?? "")
    },
    [unsupportedEquipmentNames],
  )

  const handleCheckStatus = useCallback(
    async (payload: SafetyCheckStatusPayload) => {
      setIsSaving(true)
      setErrorMessage("")

      try {
        await updateSafetyCheckStatus(payload)
        setToastMessage("점검 완료! 최신 상태로 갱신했습니다.")
        await loadDashboard()
        await loadPreWorkChecklist(payload.equipment_id)
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "점검 상태 저장에 실패했습니다.",
        )
      } finally {
        setIsSaving(false)
      }
    },
    [loadDashboard, loadPreWorkChecklist],
  )

  const handlePreWorkCheck = useCallback(
    async (ruleId: string, ruleType: string) => {
      if (!selectedEquipmentId || !ruleId) return

      await handleCheckStatus({
        equipment_id: selectedEquipmentId,
        rule_type: ruleType,
        rule_id: ruleId,
        last_checked_at: getTodayString(),
        is_pre_work_check: true,
      })
    },
    [handleCheckStatus, selectedEquipmentId],
  )

  const handleRegularCheck = useCallback(
    async (ruleId: string, ruleType: string) => {
      if (!selectedEquipmentId || !ruleId) return

      await handleCheckStatus({
        equipment_id: selectedEquipmentId,
        rule_type: ruleType,
        rule_id: ruleId,
        last_checked_at: getTodayString(),
        is_pre_work_check: false,
      })
    },
    [handleCheckStatus, selectedEquipmentId],
  )

  return {
    dashboard,
    selectedEquipment,
    selectedEquipmentId,
    setSelectedEquipmentId,
    equipmentItems,
    unsupportedEquipmentNames,
    preWorkChecklist,
    isLoadingDashboard,
    isLoadingChecklist,
    isSaving,
    errorMessage,
    toastMessage,
    setToastMessage,
    reloadDashboard: loadDashboard,
    handleSelectEquipment,
    handlePreWorkCheck,
    handleRegularCheck,
  }
}
