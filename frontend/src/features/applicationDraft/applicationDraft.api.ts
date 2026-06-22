import {
  COMPANY_ID_STORAGE_KEY,
  EQUIPMENT_ID_STORAGE_KEY,
} from "./applicationDraft.constants"
import type { AnalysisData } from "./applicationDraft.contract"
import { apiFetch } from "../../services/apiClient"

function getCompanyId(analysisData?: AnalysisData) {
  return (
    analysisData?.company?.company_id ||
    window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) ||
    ""
  )
}

function getEquipmentId(analysisData?: AnalysisData) {
  return (
    analysisData?.equipment?.equipment_id ||
    analysisData?.equipment_id ||
    window.localStorage.getItem(EQUIPMENT_ID_STORAGE_KEY) ||
    ""
  )
}

export function buildDraftRequestPayload(
  analysisData: AnalysisData,
  policyId?: string | null,
) {
  return {
    company_id: getCompanyId(analysisData),
    equipment_id: getEquipmentId(analysisData),
    policy_id: policyId || "",
  }
}

export async function requestApplicationDraft(
  analysisData: AnalysisData,
  policyId?: string | null,
) {
  const payload = buildDraftRequestPayload(analysisData, policyId)

  if (!payload.company_id || !payload.equipment_id) {
    throw new Error("company_id 또는 equipment_id가 없어 신청서 초안 API를 호출할 수 없습니다.")
  }
  if (!payload.policy_id) {
    throw new Error("policy_id가 없어 신청서 초안 API를 호출할 수 없습니다.")
  }

  const response = await apiFetch(
    "/draft",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { timeoutMs: 30000 },
  )

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(data?.message || data?.detail || "신청서 초안 생성에 실패했습니다.")
  }

  return data
}

function getFileNameFromDisposition(disposition: string | null) {
  if (!disposition) return "factofit_application_report.pdf"

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ""))
  }

  const fallbackMatch = disposition.match(/filename="?([^";]+)"?/i)
  return fallbackMatch?.[1] || "factofit_application_report.pdf"
}

export async function downloadApplicationReport(
  analysisData: AnalysisData,
  policyId?: string | null,
) {
  const payload = {
    company_id: getCompanyId(analysisData),
    equipment_id: getEquipmentId(analysisData),
    policy_id: policyId || undefined,
    tone: "submission",
  }

  if (!payload.company_id || !payload.equipment_id) {
    throw new Error("company_id 또는 equipment_id가 없어 PDF를 생성할 수 없습니다.")
  }

  const response = await apiFetch(
    "/reports/application.pdf",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/pdf",
      },
      body: JSON.stringify(payload),
    },
    { timeoutMs: 30000 },
  )

  if (!response.ok) {
    const text = await response.text()
    let message = "PDF 다운로드에 실패했습니다."
    try {
      const data = text ? JSON.parse(text) : null
      message = data?.message || data?.detail || message
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const fileName = getFileNameFromDisposition(response.headers.get("Content-Disposition"))
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)

  return fileName
}
