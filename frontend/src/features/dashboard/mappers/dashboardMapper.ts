import type {
  DashboardAnalysisStorage,
  DashboardCompanyContract,
  DashboardEquipmentContract,
  DashboardMatchedPolicyContract,
  DashboardOnboardingMeResponse,
} from "../dashboard.contract"

export type InvestmentActionStatus = "empty" | "draft" | "completed"

export type DashboardPolicySummary = {
  totalPolicyCount: string
  activePolicyCount: string
  matchedPolicyCount: string
}

export type DashboardDeadline = {
  label: string
  dday: string
  policyTitle: string
  supportAmountText: string
  deadlineDisplay: string
  policyId: string | null
}

export type DashboardDeadlineListItem = {
  policyId: string | null
  policyTitle: string
  sourceName: string
  deadlineDisplay: string
  daysRemaining: number
  dday: string
  urgency: "urgent" | "upcoming"
  isPriority: boolean
  path: string
}

export type DashboardDeadlineList = {
  title: string
  subtitle: string
  viewAllLabel: string
  emptyMessage: string
  items: DashboardDeadlineListItem[]
}

export type DashboardKpi = {
  label: string
  value: string
}

export type DashboardAnalysisRow = {
  id: string | null
  title: string
  equipmentName: string
  status: InvestmentActionStatus
  statusLabel: string
  summary: string
  detail: string
  ctaLabel: string
  ctaPath: string
}

export type DashboardWorkspace = {
  status: InvestmentActionStatus
  analysisId: string | null
  companyName: string
  industryLabel: string
  regionLabel: string
  actionCount: number
  nearestDeadlineSummary: string
  briefingTitle: string
  recentStatusMessage: string
  equipmentName: string
  actionTitle: string
  actionMessage: string
  priorityPolicyTitle: string
  priorityPolicyId: string | null
  deadlinePolicyId: string | null
  matchedPolicyCount: string
  needsText: string
  priorityChips: string[]
  roiPath: string
  policyPath: string
  draftPath: string
  advisorPath: string
  engiTitle: string
  kpis: DashboardKpi[]
  analysisMetricText: string
  recommendedScenarioName: string
  summaryStatusText: string
  policySummary: DashboardPolicySummary
  deadline: DashboardDeadline
  deadlineList: DashboardDeadlineList
  progressText: string
  nextStepText: string
  engiMessage: string
  analyses: DashboardAnalysisRow[]
  hasMoreAnalyses: boolean
}

export type CompanySummaryRow = {
  label: string
  value: string
}

export type EquipmentSummaryRow = {
  title: string
  status: string
  subtitle: string
}

export type DashboardViewModel = {
  companyRows: CompanySummaryRow[]
  equipmentRows: EquipmentSummaryRow[]
  workspace: DashboardWorkspace
  isFallback: boolean
}

type MapDashboardDataParams = {
  onboarding: DashboardOnboardingMeResponse | null
  analysis: DashboardAnalysisStorage | null
}

function compactText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(" / ")
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function formatCommaNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value))
}

function formatCount(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${formatCommaNumber(value)}건`
    : "-"
}

function formatManwon(value: number | null, prefix = "") {
  if (value === null || !Number.isFinite(value)) return "-"
  if (value >= 10000) {
    const eok = value / 10000
    const formatted = Number.isInteger(eok) ? String(eok) : eok.toFixed(1)
    return `${prefix}${formatted}억원`
  }

  return `${prefix}${formatCommaNumber(value)}만원`
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-"
  // roi_pct는 백엔드에서 이미 퍼센트 값(예: 15.5)으로 반환된다. 자동 스케일링 없음.
  return `${Math.round(value)}%`
}

function formatPayback(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-"
  // payback_years는 백엔드에서 이미 "년" 단위로 반환된다.
  return `${value.toFixed(1)}년`
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function findNumberByKeys(value: unknown, keys: string[]): number | null {
  const record = readRecord(value)
  if (!record) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findNumberByKeys(item, keys)
        if (found !== null) return found
      }
    }
    return null
  }

  const lowerKeyMap = new Map(
    Object.keys(record).map((key) => [key.toLowerCase(), key]),
  )

  for (const key of keys) {
    const actualKey = lowerKeyMap.get(key.toLowerCase())
    if (!actualKey) continue
    const direct = readNumber(record[actualKey])
    if (direct !== null) return direct
  }

  for (const child of Object.values(record)) {
    const found = findNumberByKeys(child, keys)
    if (found !== null) return found
  }

  return null
}

function findTextByKeys(value: unknown, keys: string[]): string {
  const record = readRecord(value)
  if (!record) return ""

  const lowerKeyMap = new Map(
    Object.keys(record).map((key) => [key.toLowerCase(), key]),
  )

  for (const key of keys) {
    const actualKey = lowerKeyMap.get(key.toLowerCase())
    if (!actualKey) continue
    const text = compactText(record[actualKey])
    if (text) return text
  }

  for (const child of Object.values(record)) {
    const found = findTextByKeys(child, keys)
    if (found) return found
  }

  return ""
}

function normalizeEquipments(
  onboarding: DashboardOnboardingMeResponse | null,
  analysis: DashboardAnalysisStorage | null,
) {
  const merged = [
    ...(onboarding?.equipments ?? []),
    ...(analysis?.equipments ?? []),
    ...(analysis?.equipment ? [analysis.equipment] : []),
  ]
  const unique = new Map<string, DashboardEquipmentContract>()

  merged.forEach((equipment, index) => {
    const key =
      equipment.equipment_id ??
      equipment.id ??
      `${equipment.name ?? "equipment"}-${index}`
    if (!unique.has(key)) unique.set(key, equipment)
  })

  return Array.from(unique.values())
}

function normalizePolicies(analysis: DashboardAnalysisStorage | null) {
  const record = readRecord(analysis)
  return (
    analysis?.matched_policies ??
    analysis?.policies ??
    analysis?.raw_candidates ??
    (Array.isArray(record?.policies)
      ? (record.policies as DashboardMatchedPolicyContract[])
      : null) ??
    []
  )
}

function getRoiData(analysis: DashboardAnalysisStorage | null) {
  const record = readRecord(analysis)
  return (
    analysis?.roi_data ??
    analysis?.roi_result ??
    readRecord(record?.roiResult) ??
    analysis?.roi_output?.roi_data ??
    null
  )
}

function getPolicyScore(policy: DashboardMatchedPolicyContract | undefined) {
  const score =
    policy?.hybrid_score ??
    policy?.final_score ??
    policy?.match_score ??
    policy?.llm_score ??
    null

  if (score === null || !Number.isFinite(score)) return null
  return score > 0 && score <= 1 ? score * 100 : score
}

function getPolicyId(policy: DashboardMatchedPolicyContract | undefined) {
  const id = policy?.policy_id ?? policy?.id ?? null
  return id === null || id === undefined ? null : String(id)
}

function getPolicySourceName(policy: DashboardMatchedPolicyContract | undefined) {
  if (!policy) return "공고 확인 필요"
  return (
    compactText(policy.organization) ||
    compactText(policy.agency) ||
    compactText(policy.provider) ||
    findTextByKeys(policy.metadata, [
      "organization",
      "agency",
      "provider",
      "source_name",
      "sourceName",
    ]) ||
    "공고 확인 필요"
  )
}

function getPriorityPolicy(policies: DashboardMatchedPolicyContract[]) {
  return [...policies].sort((a, b) => {
    const left = getPolicyScore(a) ?? -1
    const right = getPolicyScore(b) ?? -1
    return right - left
  })[0]
}

function getPolicyDateValue(policy: DashboardMatchedPolicyContract) {
  const metadata = policy.metadata ?? null
  const raw =
    compactText(policy.deadline) ||
    compactText(policy.deadline_display) ||
    compactText(policy.end_date) ||
    compactText(policy.application_end_date) ||
    compactText(policy.reception_end_date) ||
    findTextByKeys(metadata, [
      "deadline",
      "deadline_display",
      "end_date",
      "application_end_date",
      "reception_end_date",
      "deadline_date",
      "apply_end_date",
      "receipt_end_date",
      "pblanc_end_date",
    ])

  if (!raw || raw === "None" || raw === "마감일 미정") return ""
  return raw
}

function parseDeadline(raw: string) {
  const normalized = raw.match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/)?.[0]
  if (!normalized) return null

  const [year, month, day] = normalized.split(/[-./]/).map(Number)
  const date = new Date(year, month - 1, day, 23, 59, 59)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDeadlineDisplay(raw: string) {
  const date = parseDeadline(raw)
  if (!date) return raw || "공고 확인 필요"
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}.${String(date.getDate()).padStart(2, "0")}`
}

function getDaysRemaining(raw: string) {
  const date = parseDeadline(raw)
  if (!date) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

function getDeadlineLabel(daysRemaining: number | null) {
  if (daysRemaining === null) return "마감 일정 확인 필요"
  if (daysRemaining <= 7) return "마감 임박"
  if (daysRemaining <= 30) return "이번 달 마감"
  return "마감 일정"
}

function getSupportAmount(policy: DashboardMatchedPolicyContract | undefined) {
  if (!policy) return "-"
  const metadata = policy.metadata ?? null
  const amount =
    readNumber(policy.max_amount_manwon) ??
    readNumber(policy.max_amount) ??
    readNumber(policy.support_amount) ??
    readNumber(policy.subsidy_amount) ??
    readNumber(policy.support_limit) ??
    findNumberByKeys(metadata, [
      "max_amount_manwon",
      "max_amount",
      "support_amount",
      "subsidy_amount",
      "support_limit",
      "support_amount_manwon",
      "subsidy_amount_manwon",
    ])

  return formatManwon(amount, amount === null ? "" : "최대 ")
}

function getNearestDeadline(policies: DashboardMatchedPolicyContract[]) {
  const dated = policies
    .map((policy) => {
      const raw = getPolicyDateValue(policy)
      const daysRemaining = raw ? getDaysRemaining(raw) : null
      return { policy, raw, daysRemaining }
    })
    .filter(
      (item): item is typeof item & { daysRemaining: number } =>
        typeof item.daysRemaining === "number",
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  return dated[0] ?? null
}

function getPolicyDetailPath(
  analysisId: string,
  policy: DashboardMatchedPolicyContract | undefined,
) {
  const policyId = getPolicyId(policy)
  if (!analysisId) return "/support-projects"
  return policyId
    ? `/analysis/${analysisId}/policies/${policyId}`
    : `/analysis/${analysisId}/policies`
}

function mapDeadlineList(
  policies: DashboardMatchedPolicyContract[],
  priorityPolicyId: string | null,
  analysisId: string,
): DashboardDeadlineList {
  const dated = policies
    .map((policy) => {
      const raw = getPolicyDateValue(policy)
      const daysRemaining = raw ? getDaysRemaining(raw) : null
      return { policy, raw, daysRemaining }
    })
    .filter(
      (item): item is typeof item & { raw: string; daysRemaining: number } =>
        Boolean(item.raw) &&
        typeof item.daysRemaining === "number" &&
        item.daysRemaining >= 0,
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  const urgent = dated.filter((item) => item.daysRemaining <= 7)
  const sourceItems = urgent.length > 0 ? urgent : dated
  const visibleItems = sourceItems.slice(0, 3)
  const title =
    dated.length === 0
      ? "마감 일정"
      : urgent.length > 0
        ? "마감 임박 매칭 공고"
        : "다가오는 마감 일정"
  const subtitle =
    dated.length === 0
      ? "현재 확인 가능한 마감일이 있는 매칭 공고가 없습니다."
      : urgent.length > 0
        ? `D-7 이내 ${formatCount(urgent.length)}`
        : `가장 가까운 마감 ${formatCount(visibleItems.length)}`

  return {
    title,
    subtitle,
    viewAllLabel: `전체 ${formatCount(policies.length)} 보기`,
    emptyMessage: "현재 확인 가능한 마감일이 있는 매칭 공고가 없습니다.",
    items: visibleItems.map(({ policy, raw, daysRemaining }) => {
      const policyId = getPolicyId(policy)
      return {
        policyId,
        policyTitle: compactText(policy.title) || "공고 확인 필요",
        sourceName: getPolicySourceName(policy),
        deadlineDisplay: formatDeadlineDisplay(raw),
        daysRemaining,
        dday: `D-${Math.max(0, daysRemaining)}`,
        urgency: daysRemaining <= 7 ? "urgent" : "upcoming",
        isPriority: Boolean(priorityPolicyId && policyId === priorityPolicyId),
        path: getPolicyDetailPath(analysisId, policy),
      }
    }),
  }
}

function getAnalysisId(analysis: DashboardAnalysisStorage | null) {
  const record = readRecord(analysis)
  return (
    compactText(record?.id) ||
    compactText(record?.analysis_id) ||
    compactText(record?.draft_id) ||
    ""
  )
}

function getEquipmentName(
  analysis: DashboardAnalysisStorage | null,
  equipments: DashboardEquipmentContract[],
) {
  const record = readRecord(analysis)
  return (
    compactText(record?.equipmentName) ||
    compactText(analysis?.draft_result?.equipment_name) ||
    compactText(analysis?.equipment?.name) ||
    compactText(equipments[0]?.name) ||
    "투자 설비"
  )
}

function getAnalysisStatus(
  analysis: DashboardAnalysisStorage | null,
  matchedCount: number,
) {
  if (!analysis) return "empty"
  if (getRoiData(analysis) || analysis.draft_result || matchedCount > 0) return "completed"
  return "draft"
}

function getProgressPercent(analysis: DashboardAnalysisStorage | null) {
  if (!analysis) return null

  const equipment = analysis.equipment
  const fields = [
    equipment?.name,
    equipment?.category,
    equipment?.age_years,
    equipment?.energy_cost_annual,
    equipment?.maintenance_cost_annual,
    equipment?.scenario_a_investment_manwon,
    equipment?.scenario_b_investment_manwon,
  ]
  const completed = fields.filter((value) => compactText(value)).length
  return Math.max(10, Math.round((completed / fields.length) * 100))
}

function getPolicySummary(
  analysis: DashboardAnalysisStorage | null,
  matchedCount: number,
): DashboardPolicySummary {
  const summary = analysis?.policy_summary ?? null
  const total =
    readNumber(analysis?.total_policy_count) ??
    findNumberByKeys(summary, ["totalPolicyCount", "total_policy_count", "total"])
  const active =
    readNumber(analysis?.active_policy_count) ??
    findNumberByKeys(summary, [
      "activePolicyCount",
      "active_policy_count",
      "active",
    ])

  return {
    totalPolicyCount: formatCount(total),
    activePolicyCount: formatCount(active),
    matchedPolicyCount: formatCount(matchedCount),
  }
}

function getCompanyName(company: DashboardCompanyContract | null | undefined) {
  return compactText(company?.company_name)
}

function getIndustryLabel(company: DashboardCompanyContract | null | undefined) {
  return (
    compactText(company?.industry_name) ||
    compactText(company?.industry_codes) ||
    compactText(company?.industry_code)
  )
}

function getRegionLabel(company: DashboardCompanyContract | null | undefined) {
  return compactText(company?.region)
}

function uniqueCompact(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) return false
    seen.add(trimmed)
    return true
  })
}

function mapCompanyRows(company: DashboardCompanyContract | null | undefined) {
  if (!company) return []

  const industryName =
    compactText(company.industry_name) ||
    compactText(company.industry_codes) ||
    compactText(company.industry_code) ||
    "업종 정보 확인"

  return [
    { label: "업종", value: industryName },
    { label: "지역", value: compactText(company.region) || "지역 정보 확인" },
    {
      label: "기업규모",
      value: compactText(company.company_type) || "기업규모 확인",
    },
  ]
}

function mapEquipmentRows(equipments: DashboardEquipmentContract[]) {
  return equipments.slice(0, 3).map((equipment) => ({
    title: compactText(equipment.name) || "이름 미입력 설비",
    status:
      typeof equipment.age_years === "number"
        ? `${equipment.age_years}년 사용`
        : "사용연수 확인 필요",
    subtitle: compactText(equipment.process) || compactText(equipment.category) || "-",
  }))
}

function getNetInvestment(analysis: DashboardAnalysisStorage | null) {
  const roiData = getRoiData(analysis)

  // 추천 시나리오(A/B)의 net_investment_manwon을 먼저 시도한다.
  // findNumberByKeys는 재귀 탐색으로 scenario_a를 항상 먼저 찾기 때문에
  // recommended가 B인 경우 잘못된 값을 반환할 수 있다.
  const roiRecord = readRecord(roiData)
  if (roiRecord) {
    const recommended = String(roiRecord.recommended ?? "").trim().toUpperCase()
    const scenarioKey = recommended === "B" ? "scenario_b" : "scenario_a"
    const preferredScenario = readRecord(roiRecord[scenarioKey])
    if (preferredScenario) {
      const explicitNetPreferred = readNumber(preferredScenario["net_investment_manwon"])
      if (explicitNetPreferred !== null) return explicitNetPreferred
    }
  }

  const investment =
    analysis?.draft_result?.investment_manwon ??
    analysis?.equipment?.scenario_b_investment_manwon ??
    analysis?.equipment?.scenario_a_investment_manwon ??
    findNumberByKeys(roiData, [
      "net_investment_manwon",
      "investment_manwon",
      "scenario_b_investment_manwon",
      "scenario_a_investment_manwon",
    ])
  const subsidy =
    analysis?.draft_result?.subsidy_manwon ??
    findNumberByKeys(roiData, [
      "subsidy_manwon",
      "expected_subsidy_manwon",
      "total_subsidy_manwon",
      "scenario_a_subsidy_manwon",
      "scenario_b_subsidy_manwon",
    ])

  const explicitNet = findNumberByKeys(roiData, ["net_investment_manwon"])
  if (explicitNet !== null) return explicitNet
  if (investment !== null && subsidy !== null) return Math.max(0, investment - subsidy)
  return investment
}

function getRecommendedScenarioName(
  analysis: DashboardAnalysisStorage | null,
  roiData: unknown,
) {
  const record = readRecord(analysis)
  const scenario =
    findTextByKeys(record, ["recommendedScenario", "recommended_scenario"]) ||
    findTextByKeys(roiData, ["recommended", "recommended_scenario", "scenario"])

  const normalized = scenario.trim().toUpperCase()
  if (normalized === "A" || normalized.includes("SCENARIO_A")) return "A안 전체 교체"
  if (normalized === "B" || normalized.includes("SCENARIO_B")) return "B안 부분 교체"
  return scenario || "ROI 결과의 우선 시나리오"
}

function getSummaryStatusText(status: InvestmentActionStatus, daysRemaining: number | null) {
  if (status !== "completed") return status === "draft" ? "작성 중" : "분석 필요"
  return daysRemaining === null ? "분석 완료" : `분석 완료 · D-${Math.max(0, daysRemaining)}`
}

function getPriorityChips(
  company: DashboardCompanyContract | null | undefined,
  equipment: DashboardEquipmentContract | undefined,
  priorityPolicy: DashboardMatchedPolicyContract | undefined,
) {
  return [
    ...uniqueCompact([
      getIndustryLabel(company),
      compactText(equipment?.category),
      compactText(equipment?.process),
      compactText(priorityPolicy?.scenario_label),
      findTextByKeys(priorityPolicy?.metadata, [
        "policy_category",
        "category",
        "service_category",
        "subcategory",
        "policy_subcategory",
      ]),
    ]).slice(0, 3),
    "우선 검토 1순위",
  ]
}

function mapWorkspace(
  company: DashboardCompanyContract | null | undefined,
  analysis: DashboardAnalysisStorage | null,
  equipments: DashboardEquipmentContract[],
): DashboardWorkspace {
  const analysisRecord = readRecord(analysis)
  const policies = normalizePolicies(analysis)
  const matchedCount = policies.length
  const status = getAnalysisStatus(analysis, matchedCount)
  const analysisId = getAnalysisId(analysis)
  const equipmentName = getEquipmentName(analysis, equipments)
  const priorityPolicy = getPriorityPolicy(policies)
  const priorityPolicyTitle = compactText(priorityPolicy?.title) || "공고 확인 필요"
  const priorityPolicyId = getPolicyId(priorityPolicy)
  const nearestDeadline = getNearestDeadline(policies)
  const deadlinePolicy = nearestDeadline?.policy ?? priorityPolicy
  const deadlinePolicyId = getPolicyId(deadlinePolicy)
  const deadlineRaw = nearestDeadline?.raw || (deadlinePolicy ? getPolicyDateValue(deadlinePolicy) : "")
  const daysRemaining = deadlineRaw ? getDaysRemaining(deadlineRaw) : null
  const policyPath = analysisId
    ? priorityPolicyId
      ? getPolicyDetailPath(analysisId, priorityPolicy)
      : `/analysis/${analysisId}/policies`
    : "/support-projects"
  const draftPath = analysisId ? `/analysis/new?draftId=${analysisId}` : "/analysis/new"
  const roiData = getRoiData(analysis)
  const roi =
    findNumberByKeys(analysisRecord, ["roiPct", "roiPercent"]) ??
    findNumberByKeys(roiData, ["roi_percent", "roi_rate", "expected_roi", "roi"])
  const payback =
    findNumberByKeys(analysisRecord, ["paybackYears"]) ??
    analysis?.draft_result?.payback_months ??
    findNumberByKeys(roiData, ["payback_years", "payback_months", "payback_period_months"])
  const progress = getProgressPercent(analysis)
  const policySummary = getPolicySummary(analysis, matchedCount)
  const deadlineList = mapDeadlineList(policies, priorityPolicyId, analysisId)
  const companyName = getCompanyName(company)
  const industryLabel = getIndustryLabel(company)
  const regionLabel = getRegionLabel(company)
  const urgentActionCount = deadlineList.items.filter(
    (item) => item.urgency === "urgent",
  ).length
  const actionCount = urgentActionCount > 0 ? urgentActionCount : status === "empty" ? 0 : 1
  const nearestDeadlineSummary =
    typeof daysRemaining === "number"
      ? `D-${Math.max(0, daysRemaining)} 공고 조건 확인`
      : "확인할 마감 일정 없음"
  const briefingTitle = companyName
    ? `${companyName}의 오늘 확인할 작업`
    : "오늘 확인할 작업"
  const netInvestmentText = formatManwon(getNetInvestment(analysis))
  const roiText = formatPercent(roi)
  const metricText = [
    roiText !== "-" ? `ROI ${roiText}` : "",
    netInvestmentText !== "-" ? `실부담금 ${netInvestmentText}` : "",
    matchedCount > 0 ? `매칭 공고 ${formatCount(matchedCount)}` : "",
  ].filter(Boolean).join(" · ")
  const recommendedScenarioName = getRecommendedScenarioName(analysis, roiData)
  const advisorParams = new URLSearchParams()
  if (companyName) advisorParams.set("companyName", companyName)
  if (equipmentName) advisorParams.set("equipmentName", equipmentName)
  if (analysisId) advisorParams.set("analysisId", analysisId)
  if (priorityPolicyId) advisorParams.set("priorityPolicyId", priorityPolicyId)
  advisorParams.set("matchedPolicyCount", String(matchedCount))
  if (deadlinePolicyId) advisorParams.set("deadlinePolicyId", deadlinePolicyId)
  const advisorPath = advisorParams.toString()
    ? `/advisor?${advisorParams.toString()}`
    : "/advisor"

  const completedWorkspace: DashboardWorkspace = {
    status,
    analysisId: analysisId || null,
    companyName,
    industryLabel,
    regionLabel,
    actionCount,
    nearestDeadlineSummary,
    briefingTitle,
    recentStatusMessage: `${equipmentName} 분석이 완료됐어요.`,
    equipmentName,
    actionTitle: "오늘 확인할 작업",
    actionMessage: "지금은 이 지원사업의 조건을 확인하세요.",
    priorityPolicyTitle,
    priorityPolicyId,
    deadlinePolicyId,
    matchedPolicyCount: formatCount(matchedCount),
    needsText: "세부 업종코드 · 제출서류",
    priorityChips: getPriorityChips(company, analysis?.equipment ?? equipments[0], priorityPolicy),
    roiPath: analysisId ? `/roi?analysisId=${analysisId}` : "/roi",
    policyPath,
    draftPath,
    advisorPath,
    engiTitle: "Engi가 정리한 우선 행동",
    kpis: [
      { label: "예상 ROI", value: formatPercent(roi) },
      { label: "실부담금", value: formatManwon(getNetInvestment(analysis)) },
      { label: "예상 회수기간", value: formatPayback(payback) },
      { label: "매칭 지원사업", value: formatCount(matchedCount) },
    ],
    analysisMetricText: metricText,
    recommendedScenarioName,
    summaryStatusText: getSummaryStatusText(status, daysRemaining),
    policySummary,
    deadline: {
      label: getDeadlineLabel(daysRemaining),
      dday: daysRemaining === null ? "-" : `D-${Math.max(0, daysRemaining)}`,
      policyTitle: compactText(deadlinePolicy?.title) || "공고 확인 필요",
      supportAmountText: getSupportAmount(deadlinePolicy),
      deadlineDisplay: deadlineRaw ? formatDeadlineDisplay(deadlineRaw) : "공고 확인 필요",
      policyId: getPolicyId(deadlinePolicy),
    },
    deadlineList,
    progressText: "완료: 기업 정보 · 투자 조건 · ROI 분석",
    nextStepText: "다음 단계: 지원사업 조건 확인",
    engiMessage: `Engi: ${daysRemaining === null ? "마감일 확인이 필요한 공고라" : `D-${Math.max(0, daysRemaining)} 공고라`} 업종코드와 제출서류를 먼저 확인해보세요.`,
    analyses: [],
    hasMoreAnalyses: false,
  }

  if (status === "empty") {
    return {
      ...completedWorkspace,
      recentStatusMessage: "첫 투자 분석을 시작해보세요.",
      actionMessage: "첫 투자 분석을 시작해보세요.",
      priorityPolicyTitle: "설비 투자 조건을 입력하면 ROI, 회수기간, 지원사업 매칭을 함께 확인할 수 있습니다.",
      engiMessage: "Engi: 설비 투자 조건을 입력하면 ROI와 지원사업을 함께 정리해드릴게요.",
      progressText: "분석 필요",
      nextStepText: "다음 단계: 새 투자 분석 시작",
      analysisMetricText: "",
    }
  }

  if (status === "draft") {
    return {
      ...completedWorkspace,
      recentStatusMessage: `${equipmentName} 분석을 이어서 진행해보세요.`,
      actionMessage: `${equipmentName} 투자 분석을 작성 중입니다.`,
      priorityPolicyTitle: `현재 입력 완료 ${progress ?? "-"}%`,
      engiMessage: "Engi: 투자금과 운영비를 입력하면 ROI 결과를 더 정확하게 확인할 수 있어요.",
      progressText: `작성 중: 투자 조건 ${progress ?? "-"}% 입력`,
      nextStepText: "다음 단계: 누락된 투자 조건 입력",
      analysisMetricText: "",
    }
  }

  return completedWorkspace
}

function mapAnalysisRows(
  workspace: DashboardWorkspace,
  analysis: DashboardAnalysisStorage | null,
) {
  if (!analysis) return []

  const row: DashboardAnalysisRow = {
    id: workspace.analysisId,
    title:
      compactText(analysis.draft_result?.application_purpose) ||
      `${workspace.equipmentName} 투자 분석`,
    equipmentName: workspace.equipmentName,
    status: workspace.status,
    statusLabel:
      workspace.status === "completed"
        ? "분석 완료"
        : workspace.status === "draft"
          ? "작성 중"
          : "분석 필요",
    summary:
      workspace.status === "completed"
        ? `ROI ${workspace.kpis[0].value} · 매칭 공고 ${workspace.matchedPolicyCount}`
        : workspace.progressText.replace("작성 중: ", ""),
    detail:
      workspace.status === "completed"
        ? `우선 검토 정책 ${workspace.priorityPolicyTitle} · ${workspace.deadline.dday} 일정 확인 필요`
        : "투자금과 운영비 조건을 입력하면 ROI 분석을 이어갈 수 있습니다.",
    ctaLabel: workspace.status === "completed" ? "결과 보기" : "이어서 작성",
    ctaPath:
      workspace.status === "completed" ? workspace.roiPath : workspace.draftPath,
  }

  return [row]
}

export function mapDashboardData({
  onboarding,
  analysis,
}: MapDashboardDataParams): DashboardViewModel {
  const company = onboarding?.company ?? analysis?.company ?? null
  const equipments = normalizeEquipments(onboarding, analysis)
  const workspace = mapWorkspace(company, analysis, equipments)
  const analyses = mapAnalysisRows(workspace, analysis).slice(0, 5)

  return {
    companyRows: mapCompanyRows(company),
    equipmentRows: mapEquipmentRows(equipments),
    workspace: {
      ...workspace,
      analyses,
      hasMoreAnalyses: analyses.length > 5,
    },
    isFallback: !analysis,
  }
}
