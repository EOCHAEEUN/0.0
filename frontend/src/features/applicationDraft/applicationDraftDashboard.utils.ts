import type {
  AnalysisData,
  DraftResult,
  PolicySelection,
  ScenarioKey,
  StatusTone,
} from "./applicationDraft.contract"
import {
  COMPANY_ID_STORAGE_KEY,
  EQUIPMENT_ID_STORAGE_KEY,
} from "./applicationDraft.constants"
import {
  formatManwon,
  formatMonthlyPayback,
  getInitialScenarioKey,
  getIndustryText,
  getPaybackMonths,
  getScenarioByKey,
  getScenarioInvestment,
  hasValue,
  pickFirstMatchedPolicy,
  readAnalysisData,
  readJsonFromStorage,
  readStoredPolicySelection,
} from "./applicationDraft.utils"

type Dict = Record<string, unknown>

export type DashboardChecklistItem = {
  key: string
  label: string
  description: string
  status: "완료" | "확인 필요" | "분석 필요" | "선택 필요"
  tone: StatusTone
}

export type DashboardDraftWorkItem = {
  id: string
  title: string
  createdLabel: string
  updatedLabel: string
  statusLabel: string
  statusTone: StatusTone
  canOpen: boolean
}

export type DraftNavigationParams = {
  companyId: string
  equipmentId: string
  policyId: string
  analysisId?: string
  selectedProject?: Dict
}

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key)?.trim() ?? ""
  } catch {
    return ""
  }
}

function asDict(value: unknown): Dict | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Dict)
    : null
}

function pickText(source: Dict | null | undefined, keys: string[]) {
  if (!source) return ""

  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return ""
}

function getSelectedProjectFromState(locationState: unknown) {
  const state = asDict(locationState)
  const selectedProject = asDict(state?.selectedProject)

  return selectedProject ?? state
}

function getSelectedProjectFromStorage() {
  return (
    asDict(readJsonFromStorage("factofit_selected_project")) ??
    asDict(readJsonFromStorage("factofit_selected_policy")) ??
    asDict(readJsonFromStorage("selectedProject"))
  )
}

function getStoredAnalysisData(): AnalysisData {
  return readAnalysisData()
}

export function computeDraftNavigationParams(
  locationState: unknown,
  routeContext?: {
    analysisId?: string
    policyId?: string
    selectedProject?: unknown
  },
): DraftNavigationParams | null {
  const state = asDict(locationState)
  const selectedProjectFromState = getSelectedProjectFromState(locationState)
  const selectedProjectFromStorage = getSelectedProjectFromStorage()
  const analysisData = getStoredAnalysisData()
  const resolvedRoutePolicyId = routeContext?.policyId?.trim() || ""
  const resolvedRouteAnalysisId = routeContext?.analysisId?.trim() || ""
  const isAnalysisPolicyRoute = Boolean(resolvedRouteAnalysisId && resolvedRoutePolicyId)
  const routeProject =
    asDict(routeContext?.selectedProject) ?? selectedProjectFromState ?? null

  if (isAnalysisPolicyRoute && !routeProject) return null

  const companyId =
    pickText(state, ["companyId", "company_id"]) ||
    pickText(routeProject, ["companyId", "company_id"]) ||
    pickText(selectedProjectFromState, ["companyId", "company_id"]) ||
    (!isAnalysisPolicyRoute
      ? pickText(selectedProjectFromStorage, ["companyId", "company_id"])
      : "") ||
    pickText(asDict(analysisData.company), ["company_id", "companyId"]) ||
    readLocalStorage(COMPANY_ID_STORAGE_KEY) ||
    readLocalStorage("company_id")

  const equipmentId =
    pickText(state, ["equipmentId", "equipment_id", "selectedEquipmentId"]) ||
    pickText(routeProject, ["equipmentId", "equipment_id", "selectedEquipmentId"]) ||
    pickText(selectedProjectFromState, [
      "equipmentId",
      "equipment_id",
      "selectedEquipmentId",
    ]) ||
    (!isAnalysisPolicyRoute
      ? pickText(selectedProjectFromStorage, [
          "equipmentId",
          "equipment_id",
          "selectedEquipmentId",
        ])
      : "") ||
    pickText(asDict(analysisData.equipment), ["equipment_id", "equipmentId", "id"]) ||
    readLocalStorage(EQUIPMENT_ID_STORAGE_KEY) ||
    readLocalStorage("factofit_selected_equipment_id") ||
    readLocalStorage("selected_equipment_id") ||
    readLocalStorage("equipment_id")

  const policyId =
    resolvedRoutePolicyId ||
    pickText(state, ["policyId", "policy_id", "id"]) ||
    pickText(routeProject, ["policyId", "policy_id", "id", "rawId", "matched_policy_id"]) ||
    pickText(selectedProjectFromState, [
      "policyId",
      "policy_id",
      "id",
      "matched_policy_id",
    ]) ||
    (!isAnalysisPolicyRoute
      ? pickText(selectedProjectFromStorage, [
          "policyId",
          "policy_id",
          "id",
          "matched_policy_id",
        ])
      : "") ||
    readLocalStorage("factofit_policy_id") ||
    readLocalStorage("factofit_selected_policy_id") ||
    readLocalStorage("selected_policy_id") ||
    readLocalStorage("policy_id")

  const analysisId =
    resolvedRouteAnalysisId ||
    pickText(state, ["analysisId", "analysis_id", "id"]) ||
    pickText(selectedProjectFromState, ["analysisId", "analysis_id"]) ||
    readLocalStorage("factofit_analysis_id") ||
    readLocalStorage("analysis_id")

  if (!companyId || !equipmentId || !policyId) return null

  const selectedProject =
    routeProject ??
    selectedProjectFromState ??
    (!isAnalysisPolicyRoute ? selectedProjectFromStorage : null) ??
    undefined

  return {
    companyId,
    equipmentId,
    policyId,
    analysisId: analysisId || undefined,
    selectedProject: selectedProject ?? undefined,
  }
}

function readStorageTimestamp(): { created?: string; updated?: string } {
  try {
    const raw = window.localStorage.getItem("factofit_analysis_result")
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Dict
    const data = asDict(parsed?.data) ?? parsed

    const created = pickText(data, ["created_at", "createdAt", "saved_at", "savedAt"])
    const updated = pickText(data, ["updated_at", "updatedAt", "modified_at", "modifiedAt"])

    return { created, updated }
  } catch {
    return {}
  }
}

function formatDateLabel(value?: string) {
  if (!value?.trim()) return ""

  const normalized = value.slice(0, 10).replace(/-/g, ".")
  return normalized
}

function isUrgentDeadline(deadlineRaw?: string | null) {
  if (!deadlineRaw || deadlineRaw === "None" || deadlineRaw === "마감일 미정") {
    return false
  }

  const normalized = deadlineRaw.slice(0, 10)
  const deadlineDate = new Date(`${normalized}T23:59:59`)
  if (Number.isNaN(deadlineDate.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000)

  return diff >= 0 && diff <= 14
}

function countUrgentPolicies(policies: AnalysisData["matched_policies"]) {
  if (!policies?.length) return 0

  return policies.filter((policy) => {
    const metadata = policy.metadata as Record<string, unknown> | undefined
    const deadline =
      typeof metadata?.deadline === "string"
        ? metadata.deadline
        : typeof metadata?.deadline_display === "string"
          ? metadata.deadline_display
          : null

    return isUrgentDeadline(deadline)
  }).length
}

function companyIsComplete(company: AnalysisData["company"], draft: DraftResult) {
  const name = company?.company_name || draft.company_name
  const industry = company?.industry_name || company?.industry_code

  return Boolean(name?.trim()) && Boolean(industry)
}

function equipmentIsComplete(
  equipment: AnalysisData["equipment"],
  draft: DraftResult,
) {
  const name = equipment?.name || draft.equipment_name

  return Boolean(name?.trim()) && hasValue(equipment?.category ?? equipment?.age_years)
}

function policyIsComplete(
  policySelection: PolicySelection | null,
  draft: DraftResult,
  matchedCount: number,
) {
  return Boolean(
    policySelection?.title ||
      draft.selected_policy ||
      matchedCount > 0,
  )
}

export function buildDashboardChecklist(
  analysisData: AnalysisData,
  draft: DraftResult,
  policySelection: PolicySelection | null,
): DashboardChecklistItem[] {
  const companyDone = companyIsComplete(analysisData.company, draft)
  const equipmentDone = equipmentIsComplete(analysisData.equipment, draft)
  const roiDone = Boolean(analysisData.roi_result)
  const matchedCount = analysisData.matched_policies?.length ?? 0
  const policyDone = policyIsComplete(policySelection, draft, matchedCount)

  return [
    {
      key: "company",
      label: "기업정보",
      description: "사업자 정보, 업종, 재무 현황 등",
      status: companyDone ? "완료" : "확인 필요",
      tone: companyDone ? "ok" : "warn",
    },
    {
      key: "equipment",
      label: "설비정보",
      description: "설비 사양, 사진, 교체 필요성 등",
      status: equipmentDone ? "완료" : "확인 필요",
      tone: equipmentDone ? "ok" : "warn",
    },
    {
      key: "roi",
      label: "ROI 분석",
      description: "투자금, 지원금, 회수기간 등",
      status: roiDone ? "완료" : "분석 필요",
      tone: roiDone ? "ok" : "need",
    },
    {
      key: "policy",
      label: "지원사업",
      description: "추천 사업 적합도 및 요건",
      status: policyDone ? "완료" : "선택 필요",
      tone: policyDone ? "ok" : "need",
    },
  ]
}

export function computeReadinessPercent(items: DashboardChecklistItem[]) {
  const completed = items.filter((item) => item.status === "완료").length
  return Math.round((completed / items.length) * 100)
}

export function buildEngiMessage(
  checklist: DashboardChecklistItem[],
  hasDraft: boolean,
) {
  if (hasDraft) {
    return "저장된 신청서 초안을 확인하고 PDF 생성을 진행할 수 있습니다."
  }

  const pending = checklist.find((item) => item.status !== "완료")

  if (!pending) {
    return "준비 항목이 충족되어 초안 생성을 시작할 수 있습니다."
  }

  if (pending.key === "policy") {
    return "먼저 추천 지원사업을 선택해 주세요."
  }

  if (pending.key === "roi") {
    return "ROI 분석이 완료되면 초안 생성 정확도가 높아집니다."
  }

  if (pending.key === "company" || pending.key === "equipment") {
    return "기업정보와 설비정보를 확인하면 초안 생성 정확도가 높아집니다."
  }

  return "현재 준비 상태를 확인한 뒤 다음 단계를 진행해 주세요."
}

export function buildStatusTags(input: {
  roiDone: boolean
  matchedCount: number
  scenarioLabel: string
  policySelected: boolean
  readinessPercent: number
}) {
  const tags: string[] = []

  if (input.roiDone) tags.push("ROI 분석 완료")
  if (input.matchedCount > 0) tags.push(`매칭 사업 ${input.matchedCount}건`)
  if (input.scenarioLabel && input.scenarioLabel !== "시나리오 선택 필요") {
    tags.push(input.scenarioLabel)
  }
  if (input.policySelected) tags.push("정책 선택 완료")
  if (input.readinessPercent >= 75) tags.push("초안 생성 준비")

  return tags.slice(0, 4)
}

export function buildIncompletePrepLabels(items: DashboardChecklistItem[]) {
  const labels = items
    .filter((item) => item.status !== "완료")
    .map((item) => {
      if (item.key === "company") return "기업정보"
      if (item.key === "equipment") return "설비정보"
      if (item.key === "roi") return "ROI"
      return "지원사업"
    })

  return labels.length > 0 ? labels.join(" · ") : "준비 완료"
}

function draftHasContent(draft: DraftResult | null | undefined) {
  if (!draft) return false

  return Boolean(
    draft.selected_policy?.trim() ||
      draft.business_necessity?.trim() ||
      draft.expected_effects?.trim(),
  )
}

function resolveDraftStatusLabel(draft: DraftResult) {
  if (draft.business_necessity && draft.expected_effects) {
    return { label: "PDF 생성 가능", tone: "ok" as StatusTone }
  }

  if (draft.business_necessity || draft.selected_policy) {
    return { label: "초안 준비 중", tone: "warn" as StatusTone }
  }

  return { label: "정보 입력 중", tone: "need" as StatusTone }
}

export function buildDraftWorkItems(
  analysisData: AnalysisData,
  navigationParams: DraftNavigationParams | null,
): DashboardDraftWorkItem[] {
  const draft = analysisData.draft_result
  if (!draftHasContent(draft)) return []

  const timestamps = readStorageTimestamp()
  const createdLabel = formatDateLabel(timestamps.created)
  const updatedLabel = formatDateLabel(timestamps.updated)
  const equipmentName =
    draft?.equipment_name || analysisData.equipment?.name || "설비"
  const policyTitle = draft?.selected_policy || "지원사업"
  const status = resolveDraftStatusLabel(draft!)

  return [
    {
      id: navigationParams?.policyId || "stored-draft",
      title: `${equipmentName} ${policyTitle} 신청서 초안`.trim(),
      createdLabel: createdLabel || "날짜 정보 없음",
      updatedLabel: updatedLabel || createdLabel || "날짜 정보 없음",
      statusLabel: status.label,
      statusTone: status.tone,
      canOpen: Boolean(navigationParams),
    },
  ]
}

export function buildApplicationDraftDashboardModel() {
  const analysisData = getStoredAnalysisData()
  const draft = analysisData.draft_result ?? {}
  const policySelection =
    readStoredPolicySelection() ?? pickFirstMatchedPolicy(analysisData.matched_policies)
  const scenarioKey = getInitialScenarioKey(analysisData.roi_result, policySelection)
  const scenario = getScenarioByKey(analysisData.roi_result, scenarioKey)
  const scenarioLabel =
    policySelection?.scenarioLabel ||
    scenario?.label ||
    (scenarioKey === "A" ? "A안 전체교체" : "B안 부분교체")

  const checklist = buildDashboardChecklist(analysisData, draft, policySelection)
  const readinessPercent = computeReadinessPercent(checklist)
  const matchedCount = analysisData.matched_policies?.length ?? 0
  const priorityCount = matchedCount > 0 ? 1 : 0
  const urgentDeadlineCount = countUrgentPolicies(analysisData.matched_policies)
  const incompletePrepCount = checklist.filter((item) => item.status !== "완료").length
  const navigationSeed = computeDraftNavigationParams(null, undefined)
  const draftWorkItems = buildDraftWorkItems(analysisData, navigationSeed)
  const hasStoredDraft = draftWorkItems.length > 0

  const companyName =
    analysisData.company?.company_name || draft.company_name || "기업 정보 확인 필요"
  const industryText = getIndustryText(analysisData.company)
  const regionText = analysisData.company?.region?.trim() || "정보 없음"
  const equipmentName =
    analysisData.equipment?.name || draft.equipment_name || "선택된 설비 없음"
  const hasEquipment = equipmentName !== "선택된 설비 없음"
  const roiDone = Boolean(analysisData.roi_result)
  const policySelected = Boolean(policySelection?.title || draft.selected_policy)

  const investmentManwon = getScenarioInvestment(
    scenarioKey,
    analysisData.equipment,
    draft,
    scenario,
  )
  const subsidyManwon =
    draft.subsidy_manwon ?? scenario?.subsidy_manwon ?? policySelection?.maxAmountManwon ?? null
  const paybackMonths = getPaybackMonths(draft, scenario)

  const todayTaskCount =
    incompletePrepCount + draftWorkItems.length + urgentDeadlineCount

  return {
    analysisData,
    companyName,
    industryText,
    regionText,
    equipmentName,
    hasEquipment,
    scenarioKey: scenarioKey as ScenarioKey,
    scenarioLabel: roiDone ? scenarioLabel : "시나리오 선택 필요",
    readinessPercent,
    checklist,
    matchedCount,
    priorityCount,
    urgentDeadlineCount,
    incompletePrepCount,
    incompletePrepLabels: buildIncompletePrepLabels(checklist),
    todayTaskCount,
    canCountTodayTasks: todayTaskCount > 0,
    engiMessage: buildEngiMessage(checklist, hasStoredDraft),
    statusTags: buildStatusTags({
      roiDone,
      matchedCount,
      scenarioLabel: roiDone ? scenarioLabel : "시나리오 선택 필요",
      policySelected,
      readinessPercent,
    }),
    showPriorityBadges: policySelected || matchedCount > 0 || hasStoredDraft,
    investmentLabel:
      investmentManwon !== null ? formatManwon(investmentManwon) : "분석 필요",
    subsidyLabel:
      subsidyManwon !== null ? formatManwon(subsidyManwon) : "정책 선택 필요",
    paybackLabel:
      paybackMonths !== null ? formatMonthlyPayback(paybackMonths) : "분석 필요",
    recommendedCountLabel:
      matchedCount > 0 ? String(matchedCount) : "지원사업 매칭 필요",
    recommendedSubLabel:
      matchedCount > 0 ? `우선 검토 ${priorityCount}건` : "정책 선택 필요",
    draftWorkItems,
    hasStoredDraft,
    canStartDraft: Boolean(navigationSeed),
    navigationSeed,
    policySelection,
  }
}

export type ApplicationDraftDashboardModel = ReturnType<
  typeof buildApplicationDraftDashboardModel
>
