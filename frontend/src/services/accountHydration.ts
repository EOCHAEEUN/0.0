import { getAccessToken, getCurrentUserId } from "./auth"
import {
  saveCompanyProfileDraft,
  saveAnalysisResult,
  updateUserOnboardingState,
  ANALYSIS_RESULT_SCHEMA_VERSION,
  emptyCompanyProfileDraft,
  type CompanyProfileDraft,
} from "../features/onboarding/onboardingState"
import { resolveCanonicalPolicies } from "../features/onboarding/analysisPolicySource"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api"

function buildApiUrl(path: string) {
  const base = String(API_BASE_URL).replace(/\/$/, "")
  return base.endsWith("/api") ? `${base}${path.replace(/^\/api/, "")}` : `${base}${path}`
}

type ApiRecord = Record<string, unknown>

function asRecord(v: unknown): ApiRecord {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as ApiRecord) : {}
}

function pickText(record: ApiRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function getPolicyTitle(policy: ApiRecord): string {
  const metadata = asRecord(policy.metadata)
  return String(
    policy.title ??
      policy.policy_title ??
      policy.name ??
      metadata.title ??
      metadata.policy_title ??
      metadata.name ??
      "",
  ).trim()
}

function mapEmployeeCountToRange(count: number | null | undefined): string {
  if (!count || count <= 0) return ""
  if (count < 5) return "5인 미만"
  if (count < 10) return "5-9명"
  if (count < 30) return "10-29명"
  if (count < 50) return "30-49명"
  if (count < 100) return "50-99명"
  if (count < 300) return "100-299명"
  return "300명 이상"
}

function mapCompanyToProfileDraft(company: ApiRecord): CompanyProfileDraft {
  const region = typeof company.region === "string" ? company.region.trim() : ""
  const regionParts = region.split(" ")
  const regionSido = regionParts[0] ?? ""
  const regionSigungu = regionParts.slice(1).join(" ")

  const industryCodes = Array.isArray(company.industry_code) ? company.industry_code : []
  const firstCode =
    industryCodes.length > 0
      ? industryCodes[0]
      : typeof company.industry_code === "string"
        ? company.industry_code
        : ""

  const employeeCount =
    typeof company.employee_count === "number" ? company.employee_count : null
  const annualRevenue =
    typeof company.annual_revenue === "number" ? company.annual_revenue : null

  return {
    ...emptyCompanyProfileDraft,
    companyName: typeof company.company_name === "string" ? company.company_name : "",
    companyType:
      typeof company.company_type === "string" && company.company_type.trim()
        ? company.company_type
        : "선택 필요",
    regionSido,
    regionSigungu,
    industry: typeof company.industry_name === "string" ? company.industry_name : "",
    industryCode: String(firstCode),
    employeeRange: mapEmployeeCountToRange(employeeCount),
    employees: employeeCount !== null ? String(employeeCount) : "",
    annualRevenue: annualRevenue !== null ? String(annualRevenue) : "",
    businessNumber:
      typeof company.business_registration_no === "string"
        ? company.business_registration_no
        : "",
    purpose:
      Array.isArray(company.primary_purpose) && company.primary_purpose[0]
        ? String(company.primary_purpose[0])
        : "선택 필요",
    businessSiteType:
      typeof company.workplace_type === "string" && company.workplace_type.trim()
        ? company.workplace_type
        : "선택 필요",
    foundedYear:
      typeof company.established_year === "number"
        ? String(company.established_year)
        : "",
    status: "completed",
    updatedAt: new Date().toISOString(),
  }
}

function buildSnapshotFromRoiOutput(
  roiOutput: ApiRecord,
  equipments: ApiRecord[],
  companyId: string,
  allPolicies: ApiRecord[] = [],
): ReturnType<typeof saveAnalysisResult> | null {
  const roiData = asRecord(roiOutput.roi_data)
  if (!roiData || Object.keys(roiData).length === 0) return null

  const analysisId =
    pickText(roiOutput, ["analysis_id", "analysisId"]) || pickText(roiOutput, ["id"])
  const equipmentId = String(roiOutput.equipment_id ?? "")
  const matchedEquipment = equipments.find(
    (e) => String(e.equipment_id ?? "") === equipmentId,
  )
  const equipmentName = String(matchedEquipment?.name ?? roiOutput.equipment_name ?? "검토 설비")

  const analysisMatchedPolicies = allPolicies.filter(
    (policy) => String(policy.analysis_id ?? "").trim() === analysisId,
  )
  const equipmentMatchedPolicies = allPolicies.filter(
    (policy) => String(policy.equipment_id ?? "") === equipmentId,
  )
  const canonical = resolveCanonicalPolicies({
    analysisId,
    roiSnapshot: roiOutput.policy_snapshot,
    matchedPolicies: analysisMatchedPolicies,
    allowEquipmentFallback: !analysisId,
    equipmentFallbackPolicies: equipmentMatchedPolicies,
  })
  const matchedPolicies = canonical.policies

  const recommended = String(roiData.recommended ?? "A").toUpperCase().trim()
  const recScenario = asRecord(recommended === "B" ? roiData.scenario_b : roiData.scenario_a)
  const roiPct =
    typeof recScenario.roi_pct === "number" ? recScenario.roi_pct : null
  const paybackYears =
    typeof recScenario.payback_years === "number" ? recScenario.payback_years : null

  const ai = asRecord(roiData.ai_recommendation)
  const aiSummary =
    typeof ai.summary === "string" && ai.summary.trim() ? ai.summary.trim() : ""

  const snapshot = {
    schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION,
    id: analysisId || equipmentId || `roi-${Date.now()}`,
    equipmentName,
    recommendation: "현재 조건에서 투자 검토를 권장합니다.",
    recommendationDetail: aiSummary,
    roiPct,
    roiPercent: roiPct,
    paybackYears,
    matchedPolicies: matchedPolicies.length,
    priorityPolicies: matchedPolicies.length > 0 ? 1 : 0,
    priorityPolicyName: getPolicyTitle(matchedPolicies[0] ?? {}),
    recommendedScenario: recommended,
    companyId,
    equipmentId,
    roiResult: roiData,
    policies: matchedPolicies,
    policyStatus:
      String(asRecord(roiOutput.policy_snapshot).policy_status ?? "").trim() || undefined,
    policyError: canonical.missingState === "missing" ? "정책 스냅샷 없음" : null,
    createdAt: String(roiOutput.created_at ?? new Date().toISOString()),
  }

  try {
    return saveAnalysisResult(snapshot)
  } catch (e) {
    console.warn("[accountHydration] saveAnalysisResult 실패", e)
    return null
  }
}

export type HydrateResult = {
  hasCompany: boolean
  hasAnalysis: boolean
}

// in-flight guard: 동일 사용자 중복 hydrate 방지
const inflightByUserId = new Map<string, Promise<HydrateResult>>()

export async function hydrateAccountData(): Promise<HydrateResult> {
  const token = getAccessToken()
  if (!token) return { hasCompany: false, hasAnalysis: false }

  const userId = getCurrentUserId() ?? "anonymous"

  const inflight = inflightByUserId.get(userId)
  if (inflight) return inflight

  const promise = _doHydrate(token, userId)
  inflightByUserId.set(userId, promise)
  promise.finally(() => inflightByUserId.delete(userId))
  return promise
}

async function _doHydrate(token: string, requestUserId: string): Promise<HydrateResult> {
  try {
    const response = await fetch(buildApiUrl("/api/onboarding/me"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn("[accountHydration] 토큰 만료 또는 미인증 — hydrate 건너뜀", response.status)
      } else {
        console.warn("[accountHydration] /api/onboarding/me 실패", response.status)
      }
      return { hasCompany: false, hasAnalysis: false }
    }

    const json = (await response.json()) as { success?: boolean; data?: unknown }
    if (!json?.data) return { hasCompany: false, hasAnalysis: false }

    // 응답이 돌아왔을 때 userId가 바뀌지 않았는지 검증 (경쟁 조건 방지)
    const currentUserId = getCurrentUserId()
    if (currentUserId && currentUserId !== requestUserId) {
      console.warn("[accountHydration] userId 변경 감지 — 응답 무시")
      return { hasCompany: false, hasAnalysis: false }
    }

    const data = asRecord(json.data)
    const company = asRecord(data.company as unknown)
    const equipments = Array.isArray(data.equipments)
      ? (data.equipments as unknown[]).map(asRecord)
      : []

    // 1. 기업 프로필 복원
    let hasCompany = false
    if (Object.keys(company).length > 0) {
      const companyId = String(company.company_id ?? "")
      if (companyId) {
        window.localStorage.setItem("factofit_company_id", companyId)
      }
      const profileDraft = mapCompanyToProfileDraft(company)
      saveCompanyProfileDraft(profileDraft)
      hasCompany = true
    }

    // 2. 설비 정보 복원
    if (equipments.length > 0) {
      const firstEquipmentId = String(equipments[0].equipment_id ?? "")
      if (firstEquipmentId) {
        window.localStorage.setItem("factofit_equipment_id", firstEquipmentId)
        window.localStorage.setItem("factofit_selected_equipment_id", firstEquipmentId)
      }
    }

    // 3. ROI 분석 결과 복원
    let hasAnalysis = false
    const roiOutputs = Array.isArray(data.roi_outputs)
      ? (data.roi_outputs as unknown[]).map(asRecord)
      : []
    const fallbackLatestRoiOutput = asRecord(data.latest_roi_output as unknown)
    const allPolicies = Array.isArray(data.matched_policies)
      ? (data.matched_policies as unknown[]).map(asRecord)
      : []
    const companyId = String(company.company_id ?? "")
    const outputsToSave =
      roiOutputs.length > 0
        ? roiOutputs
        : Object.keys(fallbackLatestRoiOutput).length > 0
          ? [fallbackLatestRoiOutput]
          : []
    if (outputsToSave.length > 0 && companyId) {
      const saved = [...outputsToSave]
        .reverse()
        .map((roiOutput) =>
          buildSnapshotFromRoiOutput(roiOutput, equipments, companyId, allPolicies),
        )
        .filter(Boolean)
      hasAnalysis = saved.length > 0
    }

    updateUserOnboardingState({
      companyProfileStatus: hasCompany ? "completed" : "not_started",
      analysisCount: outputsToSave.length,
    })

    console.log("[accountHydration] 완료", { hasCompany, hasAnalysis, userId: requestUserId })
    return { hasCompany, hasAnalysis }
  } catch (error) {
    console.warn("[accountHydration] hydrate 실패", error)
    return { hasCompany: false, hasAnalysis: false }
  }
}
