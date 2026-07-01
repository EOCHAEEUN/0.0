import {
  AUTH_TOKEN_STORAGE_KEY,
  COMPANY_ID_STORAGE_KEY,
  EQUIPMENT_ID_STORAGE_KEY,
} from "./applicationDraft.constants"
import type {
  AnalysisData,
  ApplicationDraftWorkspaceData,
  SafetyEvidenceSummary,
  ScenarioKey,
} from "./applicationDraft.contract"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000/api"

function getAccessToken() {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ""
}

function buildApiUrl(path: string) {
  if (API_BASE_URL.endsWith("/api")) {
    return `${API_BASE_URL}${path.replace(/^\/api/, "")}`
  }
  return `${API_BASE_URL}${path}`
}

function normalizeDraftScenario(scenario: ScenarioKey) {
  return scenario.toLowerCase() as "a" | "b"
}

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
  scenario: ScenarioKey,
) {
  return {
    company_id: getCompanyId(analysisData),
    equipment_id: getEquipmentId(analysisData),
    scenario: normalizeDraftScenario(scenario),
  }
}

export async function fetchApplicationDraftWorkspace(params: {
  companyId: string
  analysisId?: string
  policyId?: string
}) {
  if (!params.companyId) {
    throw new Error("company_id가 없어 신청서 초안 화면을 불러올 수 없습니다.")
  }

  const search = new URLSearchParams({ company_id: params.companyId })
  if (params.analysisId) search.set("analysis_id", params.analysisId)
  if (params.policyId) search.set("policy_id", params.policyId)

  const accessToken = getAccessToken()
  const response = await fetch(
    buildApiUrl(`/application-draft/workspace?${search.toString()}`),
    {
      method: "GET",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
    },
  )

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.detail ||
      "신청서 초안 화면 데이터를 불러오지 못했습니다."
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    )
  }

  if (payload?.state === "analysis_required") {
    return payload as ApplicationDraftWorkspaceData
  }

  return (payload?.data ?? payload) as ApplicationDraftWorkspaceData
}

export async function requestApplicationDraftGeneration(params: {
  companyId: string
  equipmentId: string
  policyId: string
  analysisId?: string
}) {
  if (!params.companyId || !params.equipmentId || !params.policyId) {
    throw new Error(
      "company_id, equipment_id, policy_id가 없어 신청서 초안을 생성할 수 없습니다.",
    )
  }

  const accessToken = getAccessToken()
  const response = await fetch(buildApiUrl("/draft"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({
      company_id: params.companyId,
      equipment_id: params.equipmentId,
      policy_id: params.policyId,
      ...(params.analysisId ? { analysis_id: params.analysisId } : {}),
    }),
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(data?.message || data?.detail || "신청서 초안 생성에 실패했습니다.")
  }

  return data
}

export async function fetchSafetyEvidenceSummary(params: {
  analysisId: string
  policyId: string
  equipmentId: string
}) {
  const search = new URLSearchParams({
    analysis_id: params.analysisId,
    policy_id: params.policyId,
    equipment_id: params.equipmentId,
  })
  const accessToken = getAccessToken()
  const response = await fetch(
    buildApiUrl(`/safety-evidence/summary?${search.toString()}`),
    {
      method: "GET",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
    },
  )
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.message || "증빙 현황을 불러오지 못했습니다.",
    )
  }
  return (payload?.data || payload) as SafetyEvidenceSummary
}

export async function uploadSafetyEvidencePdf(params: {
  analysisId: string
  policyId: string
  equipmentId: string
  viewpointKey: string
  safetyRuleId: string
  evidenceType: string
  evidenceLabel: string
  memo?: string
  file: File
}) {
  const body = new FormData()
  body.set("analysis_id", params.analysisId)
  body.set("policy_id", params.policyId)
  body.set("equipment_id", params.equipmentId)
  body.set("viewpoint_key", params.viewpointKey)
  body.set("safety_rule_id", params.safetyRuleId)
  body.set("evidence_type", params.evidenceType)
  body.set("evidence_label", params.evidenceLabel)
  if (params.memo) body.set("memo", params.memo)
  body.set("file", params.file)

  const accessToken = getAccessToken()
  const response = await fetch(buildApiUrl("/safety-evidence/upload"), {
    method: "POST",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.message || "증빙 파일 업로드에 실패했습니다.",
    )
  }
  return payload?.data || payload
}

export async function requestSafetyEvidenceDownload(fileId: string) {
  const accessToken = getAccessToken()
  const response = await fetch(
    buildApiUrl(`/safety-evidence/${encodeURIComponent(fileId)}/download`),
    {
      method: "GET",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
    },
  )
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.message || "다운로드 URL을 생성하지 못했습니다.",
    )
  }
  return payload?.data || payload
}

export async function deleteSafetyEvidenceFile(fileId: string) {
  const accessToken = getAccessToken()
  const response = await fetch(
    buildApiUrl(`/safety-evidence/${encodeURIComponent(fileId)}`),
    {
      method: "DELETE",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
    },
  )
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || "파일 삭제에 실패했습니다.")
  }
  return payload?.data || payload
}

export async function generateSafetyPreviewBaseline(params: {
  companyId: string
  analysisId: string
  policyId: string
  equipmentId?: string
}) {
  const accessToken = getAccessToken()
  const search = new URLSearchParams({
    company_id: params.companyId,
    analysis_id: params.analysisId,
    policy_id: params.policyId,
  })
  if (params.equipmentId) search.set("equipment_id", params.equipmentId)
  const response = await fetch(
    buildApiUrl(
      `/safety-evidence/bootstrap?${search.toString()}`,
    ),
    {
      method: "POST",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
    },
  )
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.message || "안전 증빙 기준 생성에 실패했습니다.",
    )
  }
  return payload?.data || payload
}

export async function requestApplicationDraft(
  analysisData: AnalysisData,
  scenario: ScenarioKey,
) {
  const payload = buildDraftRequestPayload(analysisData, scenario)

  if (!payload.company_id || !payload.equipment_id) {
    throw new Error("company_id 또는 equipment_id가 없어 신청서 초안 API를 호출할 수 없습니다.")
  }

  const accessToken = getAccessToken()
  const response = await fetch(`${API_BASE_URL}/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(data?.message || data?.detail || "신청서 초안 생성에 실패했습니다.")
  }

  return data
}
