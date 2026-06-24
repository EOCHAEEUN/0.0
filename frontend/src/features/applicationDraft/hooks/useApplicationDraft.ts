import { useEffect, useMemo, useState } from "react"
import type {
  ChecklistItem,
  DraftStatus,
  ScenarioKey,
  StatusTone,
} from "../applicationDraft.contract"

type Dict = Record<string, unknown>

type DraftContent = {
  company_name?: string | null
  equipment_name?: string | null
  selected_policy?: string | null
  agency?: string | null
  organization?: string | null
  application_purpose?: string | null
  investment_manwon?: number | null
  subsidy_manwon?: number | null
  payback_months?: number | null
  expected_benefits?: string[] | null
  readiness_score?: number | null
  ai_reasons?: string[] | null
  business_necessity?: string | null
  expected_effects?: string | null
  required_documents?: string[] | null
  scenario_used?: string | null
  scenario_label?: string | null
  policy_id?: string | null
}

type DraftApiData = {
  draft_result_id?: string | null
  policy_id?: string | null
  company_id?: string | null
  equipment_id?: string | null
  scenario_used?: string | null
  scenario_label?: string | null
  draft_result?: DraftContent | string | null
}

type DraftApiResponse = {
  success?: boolean
  data?: DraftApiData
  detail?: unknown
  message?: string
}

type DraftParams = {
  companyId: string
  equipmentId: string
  policyId: string
}

type ReadinessPart = {
  key: string
  label: string
  description: string
  score: number
  weight: number
  tone: StatusTone
  status: string
}

const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:8000/api"
).replace(/\/$/, "")

function asDict(value: unknown): Dict | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Dict)
    : null
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseJsonObject(value: string): Dict | null {
  const text = value.trim()
  if (!text) return null

  const unfenced = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
  const start = unfenced.indexOf("{")
  const end = unfenced.lastIndexOf("}")
  const jsonText = start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced

  try {
    return asDict(JSON.parse(jsonText))
  } catch {
    return null
  }
}

function readTextFromAliases(source: Dict, aliases: string[]): string {
  for (const alias of aliases) {
    const text = readText(source[alias])
    if (text) return text
  }

  return ""
}

function readListFromAliases(source: Dict, aliases: string[]): string[] {
  for (const alias of aliases) {
    const value = source[alias]
    const items = asStringList(value)
    if (items.length > 0) return items
  }

  return []
}

function normalizeDraftObject(source: Dict): DraftContent {
  const nested = asDict(source.content)
  const merged = nested ? { ...source, ...nested } : source
  const businessNecessity =
    readTextFromAliases(merged, [
      "business_necessity",
      "business necessity",
      "necessity",
      "사업 필요성",
    ]) ||
    readTextFromAliases(merged, [
      "application_purpose",
      "application purpose",
      "신청 목적",
    ])

  return {
    ...merged,
    company_name: readTextFromAliases(merged, ["company_name", "company name", "companyName"]),
    equipment_name: readTextFromAliases(merged, [
      "equipment_name",
      "equipment name",
      "equipmentName",
    ]),
    selected_policy: readTextFromAliases(merged, [
      "selected_policy",
      "selected policy",
      "_selected_policy",
      "policy_title",
      "policy title",
    ]),
    agency: readTextFromAliases(merged, ["agency", "organization", "provider", "주관사"]),
    organization: readTextFromAliases(merged, ["organization", "agency", "provider", "주관사"]),
    application_purpose: readTextFromAliases(merged, [
      "application_purpose",
      "application purpose",
      "신청 목적",
    ]),
    business_necessity: businessNecessity,
    expected_effects: readTextFromAliases(merged, [
      "expected_effects",
      "expected effects",
      "기대효과",
      "기대 효과",
    ]),
    expected_benefits: readListFromAliases(merged, [
      "expected_benefits",
      "expected benefits",
      "기대효과 목록",
    ]),
    ai_reasons: readListFromAliases(merged, ["ai_reasons", "ai reasons", "작성 근거"]),
    required_documents: readListFromAliases(merged, [
      "required_documents",
      "required documents",
      "제출 서류",
    ]),
  } as DraftContent
}

function cleanDraftPreviewText(value: unknown): string {
  if (typeof value === "string") {
    const parsed = parseJsonObject(value)
    if (parsed) {
      const draft = normalizeDraftObject(parsed)

      return [draft.business_necessity, draft.expected_effects, draft.application_purpose]
        .map(readText)
        .filter(Boolean)
        .join(" ")
    }
  }

  return readText(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/```(?:json)?/gi, " ")
    .replace(/[#*_`>]/g, " ")
    .replace(/\|[-:\s|]+\|/g, " ")
    .replace(/\|/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function shortenDraftPreviewText(value: unknown, fallback: string): string {
  const text = cleanDraftPreviewText(value)

  if (!text) return fallback

  const withoutHeadings = text
    .replace(/^\d+\.\s*/g, "")
    .replace(/^(사업\s*필요성|신청\s*목적|기대\s*효과|추진\s*내용)\s*[:：-]?\s*/g, "")
    .trim()

  const sentences =
    withoutHeadings.match(/[^.!?。]+(?:[.!?。]|습니다\.|니다\.|다\.)?/g) ?? []
  const summary = sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ")

  const result = summary || withoutHeadings

  return result.length > 360 ? `${result.slice(0, 360).trim()}...` : result
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function readLocalStorage(key: string): string {
  try {
    return window.localStorage.getItem(key)?.trim() ?? ""
  } catch {
    return ""
  }
}

function readJsonLocalStorage(key: string): Dict | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    return asDict(JSON.parse(raw))
  } catch {
    return null
  }
}

function pickText(source: Dict | null | undefined, keys: string[]) {
  if (!source) return ""

  for (const key of keys) {
    const value = readText(source[key])
    if (value) return value
  }

  return ""
}

function pickNestedDict(source: Dict | null | undefined, key: string) {
  if (!source) return null

  return asDict(source[key])
}

function getToken() {
  return (
    readLocalStorage("factofit_access_token") ||
    readLocalStorage("access_token") ||
    readLocalStorage("token")
  )
}

function getStoredAnalysisData() {
  const raw =
    readJsonLocalStorage("factofit_analysis_result") ??
    readJsonLocalStorage("analysis_result")

  const data = asDict(raw?.data) ?? raw

  return {
    company: asDict(data?.company) ?? asDict(data?.company_info),
    equipment: asDict(data?.equipment),
    roi_result: asDict(data?.roi_result),
    matched_policies: Array.isArray(data?.matched_policies)
      ? data?.matched_policies
      : Array.isArray(data?.policies)
        ? data?.policies
        : [],
    draft_result: asDict(data?.draft_result),
  }
}

function getSelectedProjectFromState(locationState: unknown) {
  const state = asDict(locationState)
  const selectedProject = pickNestedDict(state, "selectedProject")

  return selectedProject ?? state
}

function getSelectedProjectFromStorage() {
  return (
    readJsonLocalStorage("factofit_selected_project") ??
    readJsonLocalStorage("factofit_selected_policy") ??
    readJsonLocalStorage("selectedProject")
  )
}

function resolveDraftParams(locationState: unknown): DraftParams | null {
  const state = asDict(locationState)
  const selectedProjectFromState = getSelectedProjectFromState(locationState)
  const selectedProjectFromStorage = getSelectedProjectFromStorage()
  const analysisData = getStoredAnalysisData()

  const companyId =
    pickText(state, ["companyId", "company_id"]) ||
    pickText(selectedProjectFromState, ["companyId", "company_id"]) ||
    pickText(selectedProjectFromStorage, ["companyId", "company_id"]) ||
    pickText(analysisData.company, ["company_id", "companyId"]) ||
    readLocalStorage("factofit_company_id") ||
    readLocalStorage("company_id")

  const equipmentId =
    pickText(state, ["equipmentId", "equipment_id", "selectedEquipmentId"]) ||
    pickText(selectedProjectFromState, [
      "equipmentId",
      "equipment_id",
      "selectedEquipmentId",
    ]) ||
    pickText(selectedProjectFromStorage, [
      "equipmentId",
      "equipment_id",
      "selectedEquipmentId",
    ]) ||
    pickText(analysisData.equipment, ["equipment_id", "equipmentId", "id"]) ||
    readLocalStorage("factofit_equipment_id") ||
    readLocalStorage("factofit_selected_equipment_id") ||
    readLocalStorage("selected_equipment_id") ||
    readLocalStorage("equipment_id")

  const policyId =
    pickText(state, ["policyId", "policy_id", "id"]) ||
    pickText(selectedProjectFromState, [
      "policyId",
      "policy_id",
      "id",
      "matched_policy_id",
    ]) ||
    pickText(selectedProjectFromStorage, [
      "policyId",
      "policy_id",
      "id",
      "matched_policy_id",
    ]) ||
    readLocalStorage("factofit_policy_id") ||
    readLocalStorage("factofit_selected_policy_id") ||
    readLocalStorage("selected_policy_id") ||
    readLocalStorage("policy_id")

  if (!companyId || !equipmentId || !policyId) return null

  return {
    companyId,
    equipmentId,
    policyId,
  }
}

function getRoutePolicyInfo(locationState: unknown) {
  const projectFromState = getSelectedProjectFromState(locationState)
  const projectFromStorage = getSelectedProjectFromStorage()
  const project = projectFromState ?? projectFromStorage

  return {
    title: pickText(project, ["title", "name", "policy_title"]),
    agency: pickText(project, [
      "agency",
      "organization",
      "provider",
      "institution",
    ]),
    maxAmountManwon: readNumber(
      project?.maxAmountManwon ??
        project?.max_amount_manwon ??
        project?.max_amount ??
        project?.support_amount,
    ),
    reason: pickText(project, ["reason", "recommend_reason"]),
  }
}

function asStringList(value: unknown): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  const text = String(value).trim()

  return text ? [text] : []
}

function normalizeScenarioKey(
  apiScenarioUsed?: string | null,
  apiScenarioLabel?: string | null,
  draft?: DraftContent | null,
): ScenarioKey {
  const scenarioUsed = readText(apiScenarioUsed ?? draft?.scenario_used).toLowerCase()
  const scenarioLabel = readText(apiScenarioLabel ?? draft?.scenario_label)

  if (scenarioUsed === "b") return "B"
  if (scenarioLabel.includes("B") || scenarioLabel.includes("부분")) return "B"

  return "A"
}

function formatScenarioLabel(scenarioKey: ScenarioKey, scenarioLabel?: string | null) {
  const label = readText(scenarioLabel)

  if (label) return label

  return scenarioKey === "A" ? "A안 전체교체" : "B안 부분교체"
}

function formatIndustryText(company: Dict | null) {
  const industryName = pickText(company, ["industry_name", "industryName"])
  const industryCode = company?.industry_code

  if (industryName) return industryName

  if (Array.isArray(industryCode)) {
    return industryCode.map(String).filter(Boolean).join(", ") || "업종 정보 없음"
  }

  return readText(industryCode) || "업종 정보 없음"
}

function formatRoiText(value: unknown) {
  const numeric = readNumber(value)

  if (numeric === null) return "DB 조회 필요"

  if (numeric <= 1) {
    return `${Math.round(numeric * 100)}%`
  }

  return `${Math.round(numeric)}%`
}

function getDraftObject(value: DraftApiData["draft_result"]): DraftContent | null {
  if (!value) return null

  if (typeof value === "string") {
    const parsed = parseJsonObject(value)
    if (parsed) return normalizeDraftObject(parsed)

    return {
      business_necessity: cleanDraftPreviewText(value),
      expected_effects: "",
    }
  }

  return normalizeDraftObject(value as Dict)
}

function buildReadinessPartsFromDb(params: {
  companyName: string
  equipmentName: string
  selectedPolicy: string
  investmentManwon: number | null
  subsidyManwon: number | null
}): ReadinessPart[] {
  const companyOk = Boolean(params.companyName && params.companyName !== "DB 조회 필요")
  const equipmentOk = Boolean(params.equipmentName && params.equipmentName !== "DB 조회 필요")
  const policyOk = Boolean(params.selectedPolicy && params.selectedPolicy !== "지원사업 선택 필요")
  const roiOk = params.investmentManwon !== null || params.subsidyManwon !== null

  return [
    {
      key: "company",
      label: "기업정보",
      description: "DB에 저장된 기업 기본정보 반영 여부",
      score: companyOk ? 25 : 0,
      weight: 25,
      tone: companyOk ? "ok" : "warn",
      status: companyOk ? "완료" : "확인 필요",
    },
    {
      key: "equipment",
      label: "설비정보",
      description: "선택 설비 기준 신청서 생성 여부",
      score: equipmentOk ? 25 : 0,
      weight: 25,
      tone: equipmentOk ? "ok" : "warn",
      status: equipmentOk ? "완료" : "확인 필요",
    },
    {
      key: "roi",
      label: "ROI 분석",
      description: "ROI 결과와 투자금·지원금 반영 여부",
      score: roiOk ? 25 : 0,
      weight: 25,
      tone: roiOk ? "ok" : "warn",
      status: roiOk ? "완료" : "확인 필요",
    },
    {
      key: "policy",
      label: "지원사업",
      description: "선택한 지원사업 공고 기준 반영 여부",
      score: policyOk ? 25 : 0,
      weight: 25,
      tone: policyOk ? "ok" : "warn",
      status: policyOk ? "완료" : "확인 필요",
    },
  ]
}

function buildChecklistItemsFromDb(parts: ReadinessPart[]): ChecklistItem[] {
  return parts.map((part) => ({
    label: part.label,
    description: part.description,
    status: part.status as ChecklistItem["status"],
    tone: part.tone,
  }))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  return "신청서 초안 생성 중 오류가 발생했습니다."
}

function getApiErrorMessage(payload: DraftApiResponse) {
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message
  }

  if (typeof payload.detail === "string") {
    return payload.detail
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => {
        const row = asDict(item)

        return readText(row?.msg) || JSON.stringify(item)
      })
      .join("\n")
  }

  return "신청서 초안 생성에 실패했습니다."
}

export function useApplicationDraft(locationState: unknown) {
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle")
  const [isChecklistOpen, setIsChecklistOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [apiData, setApiData] = useState<DraftApiData | null>(null)

  const params = useMemo(() => resolveDraftParams(locationState), [locationState])
  const routePolicyInfo = useMemo(
    () => getRoutePolicyInfo(locationState),
    [locationState],
  )
  const storedAnalysisData = useMemo(() => getStoredAnalysisData(), [])

  useEffect(() => {
    let cancelled = false

    async function generateDraft() {
      if (!params) {
        setErrorMessage(
          "company_id, equipment_id, policy_id가 없어 신청서 초안을 생성할 수 없습니다. 지원사업 목록에서 공고를 먼저 선택해주세요.",
        )
        setDraftStatus("idle")
        return
      }

      setIsLoading(true)
      setErrorMessage("")

      try {
        const token = getToken()
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        }

        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        const response = await fetch(`${API_BASE_URL}/draft`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            company_id: params.companyId,
            equipment_id: params.equipmentId,
            policy_id: params.policyId,
          }),
        })

        const payload = (await response.json()) as DraftApiResponse

        if (!response.ok || payload.success === false) {
          throw new Error(getApiErrorMessage(payload))
        }

        if (!cancelled) {
          setApiData(payload.data ?? null)
          setDraftStatus("saved")
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error))
          setDraftStatus("idle")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    generateDraft()

    return () => {
      cancelled = true
    }
  }, [params])

  const draft = getDraftObject(apiData?.draft_result)
  const scenarioKey = normalizeScenarioKey(
    apiData?.scenario_used,
    apiData?.scenario_label,
    draft,
  )
  const [manualScenarioKey, setManualScenarioKey] =
    useState<ScenarioKey>(scenarioKey)

  useEffect(() => {
    setManualScenarioKey(scenarioKey)
  }, [scenarioKey])

  const selectedScenarioKey = manualScenarioKey
  const scenarioLabel = formatScenarioLabel(
    selectedScenarioKey,
    draft?.scenario_label ?? apiData?.scenario_label,
  )

  const companyName =
    readText(draft?.company_name) ||
    pickText(storedAnalysisData.company, ["company_name", "companyName"]) ||
    "DB 조회 필요"

  const equipmentName =
    readText(draft?.equipment_name) ||
    pickText(storedAnalysisData.equipment, [
      "name",
      "equipment_name",
      "equipmentName",
    ]) ||
    "DB 조회 필요"

  const selectedPolicy =
    readText(draft?.selected_policy) ||
    routePolicyInfo.title ||
    "지원사업 선택 필요"

  const selectedAgency =
    readText(draft?.agency) ||
    readText(draft?.organization) ||
    routePolicyInfo.agency ||
    "주관사 정보 없음"

  const applicationPurpose =
    readText(draft?.application_purpose) || "DB 초안 생성 후 표시됩니다."

  const investmentManwon = readNumber(draft?.investment_manwon)

  const subsidyManwon =
    readNumber(draft?.subsidy_manwon) ?? routePolicyInfo.maxAmountManwon ?? null

  const paybackMonths = readNumber(draft?.payback_months)

  const expectedBenefits = asStringList(draft?.expected_benefits)

  const businessNecessity =
    readText(draft?.business_necessity) || "DB 초안 생성 후 표시됩니다."

  const expectedEffects = readText(draft?.expected_effects) || ""

  const draftMessage = shortenDraftPreviewText(
    [businessNecessity, expectedEffects].filter(Boolean).join(" "),
    "DB 초안 생성 후 표시됩니다.",
  )

  const requiredDocuments = asStringList(draft?.required_documents)

  const aiReasons = asStringList(draft?.ai_reasons)

  const readinessParts = buildReadinessPartsFromDb({
    companyName,
    equipmentName,
    selectedPolicy,
    investmentManwon,
    subsidyManwon,
  })

  const computedReadinessScore = readinessParts.reduce(
    (sum, item) => sum + item.score,
    0,
  )

  const readinessScore = clamp(
    readNumber(draft?.readiness_score) ?? computedReadinessScore,
    0,
    100,
  )

  const checklistItems = buildChecklistItemsFromDb(readinessParts)

  const company = {
    ...(storedAnalysisData.company ?? {}),
    company_name: companyName,
  } as Dict & {
    company_name: string
    region?: string | null
    company_type?: string | null
  }

  const industryText = formatIndustryText(storedAnalysisData.company)

  const roiResult = storedAnalysisData.roi_result
  const scenarioRoi =
    selectedScenarioKey === "A"
      ? asDict(roiResult?.scenario_a)
      : asDict(roiResult?.scenario_b)

  const roiText = formatRoiText(
    scenarioRoi?.roi_pct ??
      scenarioRoi?.roi_percent ??
      scenarioRoi?.roi ??
      draft?.readiness_score,
  )

  const pdfStatusLabel =
    draftStatus === "downloadReady"
      ? "준비 완료"
      : draftStatus === "saved"
        ? "초안 저장 완료"
        : isLoading
          ? "생성 중"
          : "대기"

  const handleSaveDraft = () => {
    // /api/draft 호출 시 이미 draft_result DB에 저장됩니다.
    // 이 버튼은 화면 상태만 저장 완료로 확정합니다.
    setDraftStatus("saved")
  }

  const handlePrepareDownload = () => {
    if (!draft) return

    setDraftStatus("downloadReady")
  }

  return {
    analysisData: {
      ...storedAnalysisData,
      draft_result: draft,
      draft_api_data: apiData,
      draft_params: params,
      isLoading,
      errorMessage,
    },
    draftStatus,
    isChecklistOpen,
    scenarioKey: selectedScenarioKey,
    setScenarioKey: setManualScenarioKey,
    setIsChecklistOpen,
    openChecklist: () => setIsChecklistOpen(true),
    closeChecklist: () => setIsChecklistOpen(false),
    company,
    companyName,
    equipmentName,
    selectedPolicy,
    selectedAgency,
    scenarioLabel,
    applicationPurpose,
    investmentManwon,
    subsidyManwon,
    paybackMonths,
    expectedBenefits,
    businessNecessity,
    expectedEffects,
    draftMessage,
    readinessParts,
    readinessScore,
    aiReasons,
    requiredDocuments,
    checklistItems,
    industryText,
    roiText,
    pdfStatusLabel,
    handleSaveDraft,
    handlePrepareDownload,
  }
}

export type ApplicationDraftModel = ReturnType<typeof useApplicationDraft>
