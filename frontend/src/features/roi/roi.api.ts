import { apiFetch } from "../../services/apiClient"

type RoiSimulationPayload = Record<string, unknown>

type StoredMyPageProfile = {
  selectedAnalysisEquipmentId?: string | number | null
  companyInfo?: Record<string, unknown>
  equipmentList?: Array<Record<string, unknown>>
}

const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const MY_PAGE_STORAGE_KEY = "factofit_mypage_profile"
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"

function safeJsonParse<T = unknown>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function getFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function readMyPageProfile(): StoredMyPageProfile | null {
  if (typeof window === "undefined") return null

  return safeJsonParse<StoredMyPageProfile>(
    window.localStorage.getItem(MY_PAGE_STORAGE_KEY),
  )
}

function findCompanyId(profile: StoredMyPageProfile | null) {
  if (typeof window === "undefined") return ""

  const storedCompanyId = window.localStorage.getItem(COMPANY_ID_STORAGE_KEY)

  if (storedCompanyId) return storedCompanyId

  const companyInfo = profile?.companyInfo ?? {}

  return getFirstString(
    companyInfo.company_id,
    companyInfo.companyId,
    companyInfo.id,
  )
}

function findSelectedEquipment(profile: StoredMyPageProfile | null) {
  const equipmentList = Array.isArray(profile?.equipmentList)
    ? profile?.equipmentList ?? []
    : []

  if (equipmentList.length === 0) return null

  const selectedLocalId = profile?.selectedAnalysisEquipmentId

  const selectedEquipment = equipmentList.find((equipment) => {
    if (selectedLocalId === null || selectedLocalId === undefined) return false

    return String(equipment.id ?? "") === String(selectedLocalId)
  })

  return (
    selectedEquipment ??
    equipmentList.find((equipment) => getFirstString(equipment.equipmentId, equipment.equipment_id)) ??
    equipmentList[0]
  )
}

function findEquipmentId(profile: StoredMyPageProfile | null) {
  const selectedEquipment = findSelectedEquipment(profile)

  return getFirstString(
    selectedEquipment?.equipmentId,
    selectedEquipment?.equipment_id,
    selectedEquipment?.id,
  )
}

function getApiErrorMessage(data: unknown, status: number) {
  if (data && typeof data === "object") {
    const target = data as Record<string, unknown>

    if (typeof target.detail === "string") return target.detail
    if (typeof target.message === "string") return target.message
    if (typeof target.error === "string") return target.error
  }

  if (status === 401) {
    return "로그인 토큰이 만료되었습니다. 다시 로그인한 뒤 ROI 분석을 실행해주세요."
  }

  if (status === 404) {
    return "분석 API를 찾을 수 없습니다. 백엔드 /api/analyze 라우터 연결을 확인해주세요."
  }

  return `분석 API 호출에 실패했습니다. 상태코드: ${status}`
}

export async function requestRoiSimulation(payload: RoiSimulationPayload) {
  const profile = readMyPageProfile()
  const companyId = findCompanyId(profile)
  const equipmentId = findEquipmentId(profile)

  if (!companyId) {
    throw new Error("먼저 마이페이지에서 기업정보와 설비정보를 저장한 뒤 ROI 분석을 실행해주세요.")
  }

  const equipmentQuery = equipmentId
    ? `&equipment_id=${encodeURIComponent(equipmentId)}`
    : ""

  const query = `/api/analyze?company_id=${encodeURIComponent(companyId)}${equipmentQuery}`
  const response = await apiFetch(query, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  })

  const responseText = await response.text()
  const responseData = safeJsonParse(responseText) ?? responseText

  if (!response.ok) {
    console.error("ROI 분석 API 오류:", {
      status: response.status,
      companyId,
      equipmentId,
      response: responseData,
    })

    throw new Error(getApiErrorMessage(responseData, response.status))
  }

  const analysisResult = {
    ...(responseData && typeof responseData === "object" ? responseData : { data: responseData }),
    selected_company_id: companyId,
    selected_equipment_id: equipmentId || null,
    selected_equipment_local_id: profile?.selectedAnalysisEquipmentId ?? null,
    roi_input_snapshot: payload,
    analyzed_at: new Date().toISOString(),
  }

  window.localStorage.setItem(
    ANALYSIS_RESULT_STORAGE_KEY,
    JSON.stringify(analysisResult),
  )

  return analysisResult
}
