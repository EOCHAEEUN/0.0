import type {
  AnalysisConditionDraft,
  AnalysisResultSnapshot,
  CompanyProfileDraft,
} from "./onboardingState"
import {
  ANALYSIS_RESULT_SCHEMA_VERSION,
  emptyAnalysisConditionDraft,
} from "./onboardingState"
import { resolveCanonicalPolicies } from "./analysisPolicySource"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api"

const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const EQUIPMENT_ID_STORAGE_KEY = "factofit_equipment_id"
const SELECTED_EQUIPMENT_ID_STORAGE_KEY = "factofit_selected_equipment_id"
const AUTH_SESSION_STORAGE_KEY = "factofit_auth_session"

type ApiRecord = Record<string, unknown>

function buildApiUrl(path: string) {
  const base = String(API_BASE_URL).replace(/\/$/, "")
  return base.endsWith("/api") ? `${base}${path.replace(/^\/api/, "")}` : `${base}${path}`
}

function safeJsonParse<T = unknown>(value: string | null): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function getTextValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function getSupabaseStorageToken() {
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue

    const stored = safeJsonParse<ApiRecord>(window.localStorage.getItem(key))
    const currentSession = asRecord(stored?.currentSession)
    const session = asRecord(stored?.session)

    const token = getTextValue(
      stored?.access_token,
      currentSession.access_token,
      session.access_token,
    )

    if (token) return token
  }

  return ""
}

function getAccessToken() {
  const session = safeJsonParse<ApiRecord>(
    window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY),
  )
  const sessionData = asRecord(session?.data)
  const nestedSession = asRecord(session?.session)

  return getTextValue(
    window.localStorage.getItem("factofit_access_token"),
    window.localStorage.getItem("access_token"),
    window.localStorage.getItem("token"),
    session?.access_token,
    sessionData.access_token,
    nestedSession.access_token,
    getSupabaseStorageToken(),
  )
}

function getHeaders(token = getAccessToken()) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function requestJson(path: string, init: RequestInit) {
  const token = getAccessToken()

  if (!token) {
    console.warn("[onboarding-analysis] Missing access token", {
      path,
      hasFactofitSession: Boolean(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)),
      localStorageKeys: Object.keys(window.localStorage),
    })
    throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해주세요.")
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      ...getHeaders(token),
      ...(init.headers ?? {}),
    },
  })
  const json = await response.json().catch(() => null)

  if (!response.ok || json?.success === false) {
    console.error("[onboarding-analysis] API error", {
      path,
      status: response.status,
      body: json,
      hasAuthorizationHeader: Boolean(token),
    })

    if (response.status === 401) {
      throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해주세요.")
    }

    const message =
      json?.message ??
      json?.detail ??
      json?.error ??
      `API 요청에 실패했습니다. (${response.status})`
    throw new Error(typeof message === "string" ? message : JSON.stringify(message))
  }

  return json
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""))
  return Number.isFinite(numeric) ? numeric : fallback
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

function toFirstNumber(value: unknown) {
  const match = String(value ?? "").match(/\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const numeric = Number(match[0].replace(/,/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

function toAnnualManwonFromMonthly(value: unknown) {
  const monthly = toOptionalNumber(value)
  return monthly === null ? null : Math.round(monthly * 12)
}

function splitIndustryCodes(value: string) {
  const codes = value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
  return codes.length > 0 ? codes : ["C"]
}

function parseEmployeeCount(value: string) {
  const numeric = toFirstNumber(value)
  return numeric === null ? null : numeric
}

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApiRecord)
    : {}
}

function getFirstRecord(...values: unknown[]): ApiRecord {
  for (const value of values) {
    const record = asRecord(value)
    if (Object.keys(record).length > 0) return record
  }
  return {}
}

function getFirstArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) return value
  }
  return []
}

function getText(record: ApiRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function getNumber(record: ApiRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    const parsed = toOptionalNumber(value)
    if (parsed !== null) return parsed
  }
  return null
}

function findRecordWithKeys(value: unknown, keys: string[]): ApiRecord {
  const record = asRecord(value)
  if (Object.keys(record).length === 0) return {}

  if (keys.some((key) => record[key] !== undefined)) return record

  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findRecordWithKeys(item, keys)
        if (Object.keys(found).length > 0) return found
      }
      continue
    }

    const found = findRecordWithKeys(child, keys)
    if (Object.keys(found).length > 0) return found
  }

  return {}
}

function findRoiResult(analyzeResponse: ApiRecord) {
  const data = getFirstRecord(analyzeResponse.data, analyzeResponse)
  const analysis = asRecord(data.analysis)
  const recommendation = asRecord(data.recommendation)
  const direct = getFirstRecord(
    data.roi_result,
    data.roi_data,
    data.roi,
    analysis.roi_result,
    analysis.roi_data,
    analysis.roi,
    recommendation.roi_result,
    recommendation.roi,
    analyzeResponse.roi_result,
    analyzeResponse.roi_data,
    analyzeResponse.roi,
  )

  if (Object.keys(direct).length > 0) return direct

  return findRecordWithKeys(analyzeResponse, [
    "scenario_a",
    "scenario_b",
    "scenarioA",
    "scenarioB",
    "scenarios",
  ])
}

function normalizeRecommended(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase()
  const compact = text.replace(/[\s_-]/g, "")
  if (
    compact === "b" ||
    compact === "scenariob" ||
    compact.startsWith("b안") ||
    compact.startsWith("b案")
  ) {
    return "B"
  }
  return "A"
}

function scenarioHasMetric(record: ApiRecord) {
  return (
    getNumber(record, "roi_pct", "roi_percent", "roiPercent", "roi") !== null ||
    getNumber(record, "payback_years", "paybackYears", "payback", "payback_period_years") !== null
  )
}

function getScenario(roiResult: ApiRecord) {
  const recommended = normalizeRecommended(roiResult.recommended)
  const scenarioA = getFirstRecord(roiResult.scenario_a, roiResult.scenarioA)
  const scenarioB = getFirstRecord(roiResult.scenario_b, roiResult.scenarioB)
  const scenarios = getFirstArray(roiResult.scenarios, roiResult.scenario_results)
    .map(asRecord)
    .filter((record) => Object.keys(record).length > 0)
  const selected = recommended === "B" ? scenarioB : scenarioA

  if (scenarioHasMetric(selected)) {
    return { recommended, selected, source: `roi_result.scenario_${recommended.toLowerCase()}` }
  }

  const fallbackScenario = [scenarioA, scenarioB, ...scenarios].find(scenarioHasMetric)
  if (fallbackScenario) {
    return { recommended, selected: fallbackScenario, source: "roi_result.scenario fallback" }
  }

  return { recommended, selected: {}, source: "" }
}

function getPolicyTitle(policy: unknown) {
  const record = asRecord(policy)
  const metadata = asRecord(record.metadata)
  return (
    getText(record, "title", "policy_title", "name") ||
    getText(metadata, "title", "policy_title", "name")
  )
}

function getRecommendationDetail(roiResult: ApiRecord) {
  const ai = asRecord(roiResult.ai_recommendation)
  return getText(ai, "summary") || getText(roiResult, "summary", "message", "recommendation")
}

function compactScenario(record: ApiRecord) {
  const compact: ApiRecord = {}
  const numericKeys = [
    "investment_manwon",
    "subsidy_manwon",
    "net_investment_manwon",
    "net_cost_manwon",
    "annual_net_benefit_manwon",
    "annual_saving_manwon",
    "saving_manwon",
    "roi_pct",
    "roi_percent",
    "payback_years",
    "paybackYears",
  ]

  for (const key of numericKeys) {
    const value = getNumber(record, key)
    if (value !== null) compact[key] = value
  }

  const policyApplication = asRecord(record.policy_application)
  const policyStatus = getText(policyApplication, "status")
  const supportAmount = getNumber(policyApplication, "applied_support_manwon")
  if (policyStatus || supportAmount !== null) {
    compact.policy_application = {
      ...(policyStatus ? { status: policyStatus } : {}),
      ...(supportAmount !== null ? { applied_support_manwon: supportAmount } : {}),
    }
  }

  return compact
}

function buildCompactRoiResult(roiResult: ApiRecord) {
  const scenarioA = compactScenario(getFirstRecord(roiResult.scenario_a, roiResult.scenarioA))
  const scenarioB = compactScenario(getFirstRecord(roiResult.scenario_b, roiResult.scenarioB))
  const aiRecommendation = asRecord(roiResult.ai_recommendation)
  const aiSummary = getText(aiRecommendation, "summary")
  const aiBullets = Array.isArray(aiRecommendation.reason_bullets)
    ? aiRecommendation.reason_bullets
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 3)
    : []

  return {
    recommended: normalizeRecommended(roiResult.recommended),
    ...(Object.keys(scenarioA).length > 0 ? { scenario_a: scenarioA } : {}),
    ...(Object.keys(scenarioB).length > 0 ? { scenario_b: scenarioB } : {}),
    ...(aiSummary || aiBullets.length > 0
      ? {
        ai_recommendation: {
          ...(aiSummary ? { summary: aiSummary } : {}),
          ...(aiBullets.length > 0 ? { reason_bullets: aiBullets } : {}),
        },
      }
      : {}),
  }
}

function getRecommendationTitle(policyCount: number) {
  void policyCount
  return "현재 조건에서 투자 검토를 권장합니다."
}

function buildSnapshot(
  id: string,
  condition: AnalysisConditionDraft,
  companyId: string,
  equipmentId: string,
  analyzeResponse: ApiRecord,
): AnalysisResultSnapshot {
  const data = getFirstRecord(analyzeResponse.data, analyzeResponse)
  const savedRoiOutput = asRecord(data.roi_output)
  const resolvedId =
    getText(data, "analysis_id") ||
    getText(savedRoiOutput, "id", "analysis_id", "analysisId") ||
    id
  const roiResult = findRoiResult(analyzeResponse)
  const canonical = resolveCanonicalPolicies({
    analysisId: resolvedId,
    roiSnapshot: savedRoiOutput.policy_snapshot,
    matchedPolicies: getFirstArray(data.matched_policies, data.policies),
    allowEquipmentFallback: false,
  })
  const policies = canonical.policies
  const { recommended, selected, source } = getScenario(roiResult)
  const roiPct = getNumber(selected, "roi_pct", "roi_percent", "roiPercent", "roi")
  const paybackYears = getNumber(
    selected,
    "payback_years",
    "paybackYears",
    "payback",
    "payback_period_years",
  )
  const priorityPolicyName = getPolicyTitle(policies[0])

  console.debug("[onboarding-analysis] raw roi_result", {
    recommended: roiResult.recommended,
    scenario_a: roiResult.scenario_a ?? roiResult.scenarioA,
    scenario_b: roiResult.scenario_b ?? roiResult.scenarioB,
  })

  console.debug("[onboarding-analysis] selected ROI scenario", {
    roiSource: source,
    rawRecommended: roiResult.recommended,
    recommendedScenario: recommended,
    selectedScenario: selected,
    roiPct,
    paybackYears,
    policyCount: policies.length,
  })

  return {
    schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION,
    id: resolvedId,
    equipmentName: condition.equipmentName || "검토 설비",
    recommendation: getRecommendationTitle(policies.length),
    recommendationDetail: getRecommendationDetail(roiResult),
    roiPct,
    roiPercent: roiPct,
    paybackYears,
    matchedPolicies: policies.length,
    priorityPolicies: priorityPolicyName ? 1 : 0,
    priorityPolicyName,
    recommendedScenario: recommended,
    companyId,
    equipmentId,
    roiResult: buildCompactRoiResult(roiResult),
    policies,
    policyStatus:
      getText(asRecord(savedRoiOutput.policy_snapshot), "policy_status") ||
      (canonical.missingState === "missing" ? "missing" : "") ||
      (typeof data.policy_status === "string" ? data.policy_status : undefined),
    policyError: typeof data.policy_error === "string" ? data.policy_error : null,
    createdAt: new Date().toISOString(),
  }
}

function buildCompanyPayload(profile: CompanyProfileDraft, primaryPurpose: string[] = []) {
  const region = [profile.regionSido, profile.regionSigungu]
    .filter((value) => value.trim())
    .join(" ")

  const purposeList =
    primaryPurpose.length > 0
      ? primaryPurpose
      : profile.purpose && profile.purpose !== "선택 필요"
        ? [profile.purpose]
        : []

  return {
    company_name: profile.companyName || "미입력 기업",
    business_registration_no: profile.businessNumber.trim() || null,
    industry_name: profile.industry || null,
    industry_code: splitIndustryCodes(profile.industryCode),
    region: region || "지역 미입력",
    company_type:
      profile.companyType && profile.companyType !== "선택 필요"
        ? profile.companyType
        : "중소기업",
    primary_purpose: purposeList,
    employee_count:
      parseEmployeeCount(profile.employees) ??
      parseEmployeeCount(profile.employeeRange),
    annual_revenue: toOptionalNumber(profile.annualRevenue) ?? 0,
    established_year: toOptionalNumber(profile.foundedYear),
    workplace_type:
      profile.businessSiteType && profile.businessSiteType !== "선택 필요"
        ? profile.businessSiteType
        : null,
  }
}

function buildEquipmentPayload(condition: AnalysisConditionDraft) {
  const investmentA = toOptionalNumber(condition.investmentAmount || condition.investmentRange)
  const investmentB = toOptionalNumber(condition.scenarioBInvestmentManwon)
  const capacity = toOptionalNumber(condition.equipmentCapacity)

  const payload = {
    name: condition.equipmentName || "검토 설비",
    category: condition.equipmentCategory || "press",
    process: condition.process || condition.purpose || null,
    age_years: toNumber(condition.ageYears, 0),
    energy_cost_annual: toOptionalNumber(condition.energyCostAnnual),
    defect_rate: toOptionalNumber(condition.defectRate),
    maintenance_cost_annual: toAnnualManwonFromMonthly(condition.monthlyMaintenanceCost),
    current_capacity_value: capacity,
    production_qty:
      toFirstNumber(condition.monthlyProduction) === null
        ? null
        : Math.round((toFirstNumber(condition.monthlyProduction) ?? 0) * 12),
    contribution_margin_won: toOptionalNumber(condition.contributionMarginWon),
    scenario_a_investment_manwon: investmentA,
    scenario_b_investment_manwon: investmentB,
  }

  console.debug("[onboarding-analysis] equipment payload", payload)

  return payload
}

function findCompanyId(json: ApiRecord) {
  const data = asRecord(json.data)
  const company = getFirstRecord(data.company, json.company)
  return String(data.company_id ?? company.company_id ?? json.company_id ?? "")
}

function findEquipmentId(json: ApiRecord) {
  const data = asRecord(json.data)
  const equipment = getFirstRecord(data.equipment, json.equipment)
  return String(data.equipment_id ?? equipment.equipment_id ?? json.equipment_id ?? "")
}

export async function saveOnboardingCompany(
  profile: CompanyProfileDraft,
  primaryPurpose: string[] = [],
) {
  const companyPayload = buildCompanyPayload(profile, primaryPurpose)
  let companyId = window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || ""

  if (companyId) {
    await requestJson(`/api/onboarding/company/${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify(companyPayload),
    })
  } else {
    const companyJson = (await requestJson("/api/onboarding", {
      method: "POST",
      body: JSON.stringify(companyPayload),
    })) as ApiRecord
    companyId = findCompanyId(companyJson)
  }

  if (!companyId) {
    throw new Error("기업 정보 저장 응답에서 company_id를 찾지 못했습니다.")
  }

  window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, companyId)
  return companyId
}

export type OnboardingEquipmentInput = {
  name: string
  category: string
  ageYears: number
  process?: string
  energyCostAnnual?: number | null
}

export async function createOnboardingEquipment(
  companyId: string,
  equipment: OnboardingEquipmentInput,
) {
  const equipmentJson = (await requestJson(
    `/api/onboarding/${encodeURIComponent(companyId)}/equipment`,
    {
      method: "POST",
      body: JSON.stringify({
        name: equipment.name,
        category: equipment.category,
        age_years: equipment.ageYears,
        process: equipment.process?.trim() || null,
        energy_cost_annual: equipment.energyCostAnnual ?? null,
      }),
    },
  )) as ApiRecord
  const equipmentId = findEquipmentId(equipmentJson)

  if (!equipmentId) {
    throw new Error("설비 정보 저장 응답에서 equipment_id를 찾지 못했습니다.")
  }

  window.localStorage.setItem(EQUIPMENT_ID_STORAGE_KEY, equipmentId)
  window.localStorage.setItem(SELECTED_EQUIPMENT_ID_STORAGE_KEY, equipmentId)
  return equipmentId
}

export async function runOnboardingAnalysis(
  id: string,
  profile: CompanyProfileDraft,
  condition: AnalysisConditionDraft,
) {
  let companyId = window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || ""

  if (companyId) {
    try {
      companyId = await saveOnboardingCompany(
        profile,
        condition.purpose ? [condition.purpose] : [],
      )
    } catch (error) {
      console.warn(
        "[onboarding-analysis] Existing company update failed; continuing with stored company_id.",
        error,
      )
    }
  } else {
    try {
      companyId = await saveOnboardingCompany(
        profile,
        condition.purpose ? [condition.purpose] : [],
      )
    } catch {
      throw new Error("기업 정보 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.")
    }
  }

  if (!companyId) {
    throw new Error("기업 정보 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.")
  }

  window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, companyId)

  const equipmentJson = (await requestJson(
    `/api/onboarding/${encodeURIComponent(companyId)}/equipment`,
    {
      method: "POST",
      body: JSON.stringify(buildEquipmentPayload(condition)),
    },
  )) as ApiRecord
  const equipmentId = findEquipmentId(equipmentJson)

  if (!equipmentId) {
    throw new Error("설비 정보 저장 응답에서 equipment_id를 찾지 못했습니다.")
  }

  window.localStorage.setItem(EQUIPMENT_ID_STORAGE_KEY, equipmentId)
  window.localStorage.setItem(SELECTED_EQUIPMENT_ID_STORAGE_KEY, equipmentId)

  const query = new URLSearchParams({
    company_id: companyId,
    equipment_id: equipmentId,
  })
  const analyzeJson = (await requestJson(`/api/analyze?${query.toString()}`, {
    method: "POST",
  })) as ApiRecord

  return {
    ...buildSnapshot(id, condition, companyId, equipmentId, analyzeJson),
  }
}

export type SavedEquipment = {
  equipmentId: string
  name: string
  category: string
  purpose: string
  process: string
  ageYears: string
  energyCostAnnual: string
  monthlyMaintenanceCost: string
  defectRate: string
  monthlyProduction: string
  contributionMarginWon: string
  investmentAmount: string
  scenarioBInvestmentManwon: string
}

function unwrapData(value: unknown) {
  const record = asRecord(value)
  return getFirstRecord(record.data, record)
}

function equipmentToSaved(value: unknown): SavedEquipment {
  const item = asRecord(value)
  const annualMaintenance = getNumber(item, "maintenance_cost_annual")
  return {
    equipmentId: getText(item, "equipment_id", "equipmentId"),
    name: getText(item, "name"),
    category: getText(item, "category"),
    purpose: getText(item, "primary_purpose", "purpose", "process"),
    process: getText(item, "process"),
    ageYears: String(getNumber(item, "age_years") ?? ""),
    energyCostAnnual: String(getNumber(item, "energy_cost_annual") ?? ""),
    monthlyMaintenanceCost:
      annualMaintenance === null ? "" : String(Math.round(annualMaintenance / 12)),
    defectRate: String(getNumber(item, "defect_rate") ?? ""),
    monthlyProduction: String(
      (getNumber(item, "production_qty") ?? 0) > 0
        ? Math.round((getNumber(item, "production_qty") ?? 0) / 12)
        : "",
    ),
    contributionMarginWon: String(getNumber(item, "contribution_margin_won") ?? ""),
    investmentAmount: String(getNumber(item, "scenario_a_investment_manwon") ?? ""),
    scenarioBInvestmentManwon: String(
      getNumber(item, "scenario_b_investment_manwon") ?? "",
    ),
  }
}

export async function fetchAnalysisEntryContext() {
  const json = await requestJson("/api/onboarding/me", { method: "GET" })
  const data = unwrapData(json)
  const latestAnalysis = asRecord(data.latest_roi_output)
  return {
    companyId: getText(asRecord(data.company), "company_id"),
    equipments: getFirstArray(data.equipments).map(equipmentToSaved),
    latestAnalysisId: getText(latestAnalysis, "id", "analysis_id", "analysisId"),
    latestEquipmentId: getText(latestAnalysis, "equipment_id", "equipmentId"),
  }
}

export async function runExistingEquipmentAnalysis(
  id: string,
  profile: CompanyProfileDraft,
  condition: AnalysisConditionDraft,
  companyId: string,
  equipmentId: string,
) {
  void profile
  const equipmentPayload = buildEquipmentPayload(condition)
  await requestJson(`/api/equipment/${encodeURIComponent(equipmentId)}`, {
    method: "PATCH",
    body: JSON.stringify(equipmentPayload),
  })

  const query = new URLSearchParams({ company_id: companyId, equipment_id: equipmentId })
  const analyzeJson = (await requestJson(`/api/analyze?${query.toString()}`, {
    method: "POST",
  })) as ApiRecord
  return {
    ...buildSnapshot(id, condition, companyId, equipmentId, analyzeJson),
  }
}

export async function runSetupRoiAnalysis(
  companyId: string,
  equipmentId: string,
  equipmentName = "검토 설비",
): Promise<AnalysisResultSnapshot> {
  const query = new URLSearchParams({
    company_id: companyId,
    equipment_id: equipmentId,
  })
  const analyzeJson = (await requestJson(`/api/analyze?${query.toString()}`, {
    method: "POST",
  })) as ApiRecord

  const data = asRecord(analyzeJson.data)
  const savedRoiOutput = getFirstRecord(
    data.roi_output,
    data.saved_roi_output,
    analyzeJson.roi_output,
  )
  const analysisId =
    getText(data, "analysis_id", "analysisId") ||
    getText(savedRoiOutput, "id", "analysis_id", "analysisId") ||
    getText(analyzeJson, "analysis_id", "analysisId") ||
    `analysis-${Date.now()}`

  const condition: AnalysisConditionDraft = {
    ...emptyAnalysisConditionDraft,
    equipmentName,
  }

  return buildSnapshot(analysisId, condition, companyId, equipmentId, analyzeJson)
}
