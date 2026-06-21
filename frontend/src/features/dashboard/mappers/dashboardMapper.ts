import type {
  DashboardAnalysisStorage,
  DashboardCompanyContract,
  DashboardEquipmentContract,
  DashboardMatchedPolicyContract,
  DashboardOnboardingMeResponse,
} from "../dashboard.contract"
import {
  ddayItems,
  kpiCards,
  processItems,
  reasonItems,
  serviceCards,
  type DdayItem,
  type KpiCard,
  type ProcessItem,
  type ReasonItem,
  type ServiceCard,
  type Tone,
} from "../dashboard.parts"

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
  kpiCards: KpiCard[]
  serviceCards: ServiceCard[]
  processItems: ProcessItem[]
  reasonItems: ReasonItem[]
  ddayItems: DdayItem[]
  isFallback: boolean
}

type MapDashboardDataParams = {
  onboarding: DashboardOnboardingMeResponse | null
  analysis: DashboardAnalysisStorage | null
}

const fallbackCompanyRows: CompanySummaryRow[] = [
  { label: "업종", value: "금속 가공업" },
  { label: "지역", value: "경기 안산시" },
  { label: "종업원", value: "45명" },
  { label: "기업규모", value: "중소기업" },
  { label: "주요목적", value: "설비 교체 / 에너지 절감" },
]

const fallbackEquipmentRows: EquipmentSummaryRow[] = [
  {
    title: "유압 프레스 라인 A",
    status: "15년 · 교체 권고",
    subtitle: "주요 공정 설비",
  },
  {
    title: "CNC 선반 B-3호기",
    status: "11년 · 점검 필요",
    subtitle: "주요 공정 설비",
  },
  {
    title: "자동 용접기 W-2",
    status: "4년 · 정상",
    subtitle: "주요 공정 설비",
  },
]

function compactText(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join(" / ")
  }

  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)

  return ""
}

function formatCommaNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value))
}

function formatManwon(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null
  if (value >= 10000) {
    const eok = value / 10000
    const formatted = Number.isInteger(eok) ? String(eok) : eok.toFixed(1)
    return `${formatted}억원`
  }

  return `${formatCommaNumber(value)}만원`
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null

  const percent = value > 0 && value <= 5 ? value * 100 : value
  return `${Math.round(percent)}%`
}

function formatPayback(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null

  const months = value > 0 && value <= 10 ? value * 12 : value
  const years = months / 12
  return `${years.toFixed(1)}년`
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null

  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function findNumberByKeys(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== "object") return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumberByKeys(item, keys)
      if (found !== null) return found
    }

    return null
  }

  const record = value as Record<string, unknown>
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

function getPolicyScore(policy: DashboardMatchedPolicyContract | undefined) {
  const score =
    policy?.hybrid_score ??
    policy?.final_score ??
    policy?.match_score ??
    policy?.llm_score ??
    null

  if (score === null || !Number.isFinite(score)) return null

  return score > 0 && score <= 1 ? Math.round(score * 100) : Math.round(score)
}

function getGrade(score: number) {
  if (score >= 90) return "S등급"
  if (score >= 80) return "A등급"
  if (score >= 70) return "B등급"
  return "C등급"
}

function getToneByScore(score: number): Tone {
  if (score >= 90) return "blue"
  if (score >= 80) return "green"
  if (score >= 70) return "orange"
  return "red"
}

function getEquipmentAgeStatus(ageYears: number | null | undefined) {
  if (typeof ageYears !== "number" || !Number.isFinite(ageYears)) {
    return "정보 확인"
  }

  if (ageYears >= 15) return "교체 권고"
  if (ageYears >= 10) return "점검 필요"
  return "정상"
}

function getEquipmentScore(equipment: DashboardEquipmentContract) {
  const age = equipment.age_years ?? 0
  const defect = equipment.defect_rate ?? 0
  const maintenanceCost = equipment.maintenance_cost_annual ?? 0

  const ageScore = Math.max(0, 100 - age * 2)
  const defectPenalty = Math.min(18, defect * 2)
  const maintenancePenalty = maintenanceCost > 0 ? Math.min(12, maintenanceCost / 1000) : 0

  return Math.max(55, Math.round(ageScore - defectPenalty - maintenancePenalty))
}

function normalizeEquipments(
  onboarding: DashboardOnboardingMeResponse | null,
  analysis: DashboardAnalysisStorage | null,
) {
  const onboardingEquipments = onboarding?.equipments ?? []
  const analysisEquipments = analysis?.equipments ?? []
  const singleAnalysisEquipment = analysis?.equipment ? [analysis.equipment] : []

  const merged = [
    ...onboardingEquipments,
    ...analysisEquipments,
    ...singleAnalysisEquipment,
  ]

  const unique = new Map<string, DashboardEquipmentContract>()

  merged.forEach((equipment, index) => {
    const key = equipment.equipment_id ?? equipment.id ?? `${equipment.name ?? "equipment"}-${index}`
    if (!unique.has(key)) unique.set(key, equipment)
  })

  return Array.from(unique.values())
}

function normalizePolicies(analysis: DashboardAnalysisStorage | null) {
  return analysis?.matched_policies ?? analysis?.raw_candidates ?? []
}

function getRoiData(analysis: DashboardAnalysisStorage | null) {
  return analysis?.roi_data ?? analysis?.roi_output?.roi_data ?? null
}

function findPolicyForEquipment(
  policies: DashboardMatchedPolicyContract[],
  equipment: DashboardEquipmentContract,
  index: number,
) {
  const equipmentId = equipment.equipment_id ?? equipment.id

  return (
    policies.find(
      (policy) => equipmentId && policy.equipment_id && policy.equipment_id === equipmentId,
    ) ??
    policies[index] ??
    policies[0]
  )
}

function mapCompanyRows(company: DashboardCompanyContract | null | undefined) {
  if (!company) return fallbackCompanyRows

  const industryName =
    compactText(company.industry_name) ||
    compactText(company.industry_codes) ||
    compactText(company.industry_code) ||
    "업종 정보 확인"

  return [
    { label: "업종", value: industryName },
    { label: "지역", value: compactText(company.region) || "지역 정보 확인" },
    {
      label: "종업원",
      value:
        typeof company.employee_count === "number"
          ? `${formatCommaNumber(company.employee_count)}명`
          : "인원 정보 확인",
    },
    {
      label: "기업규모",
      value: compactText(company.company_type) || "기업규모 확인",
    },
    {
      label: "주요목적",
      value: compactText(company.primary_purpose) || "지원사업 추천 / ROI 분석",
    },
  ]
}

function mapEquipmentRows(equipments: DashboardEquipmentContract[]) {
  if (equipments.length === 0) return fallbackEquipmentRows

  return equipments.slice(0, 3).map((equipment) => ({
    title: equipment.name?.trim() || "이름 미입력 설비",
    status: `${equipment.age_years ?? "-"}년 · ${getEquipmentAgeStatus(
      equipment.age_years,
    )}`,
    subtitle: compactText(equipment.process) || compactText(equipment.category) || "주요 공정 설비",
  }))
}

function mapKpiCards(
  analysis: DashboardAnalysisStorage | null,
  policies: DashboardMatchedPolicyContract[],
) {
  const roiData = getRoiData(analysis)
  const draft = analysis?.draft_result ?? null

  const subsidyManwon =
    draft?.subsidy_manwon ??
    findNumberByKeys(roiData, [
      "subsidy_manwon",
      "expected_subsidy_manwon",
      "total_subsidy_manwon",
      "scenario_a_subsidy_manwon",
      "scenario_b_subsidy_manwon",
    ])

  const roiPercent = findNumberByKeys(roiData, [
    "roi_percent",
    "roi_rate",
    "expected_roi",
    "roi",
  ])

  const paybackMonths =
    draft?.payback_months ??
    findNumberByKeys(roiData, ["payback_months", "payback_period_months"])

  return kpiCards.map((card) => {
    if (card.label === "예상 지원금") {
      return {
        ...card,
        value: formatManwon(subsidyManwon) ?? card.value,
        description: subsidyManwon ? "분석 결과 기준 산정" : card.description,
      }
    }

    if (card.label === "지원사업") {
      return {
        ...card,
        value: policies.length > 0 ? `${policies.length}건` : card.value,
        description: policies.length > 0 ? "AI 매칭 결과 기준" : card.description,
      }
    }

    if (card.label === "예상 ROI") {
      return {
        ...card,
        value: formatPercent(roiPercent) ?? card.value,
        description: roiPercent ? "ROI 분석 결과 기준" : card.description,
      }
    }

    if (card.label === "회수기간") {
      return {
        ...card,
        value: formatPayback(paybackMonths) ?? card.value,
        description: paybackMonths ? "분석 결과 기준" : card.description,
      }
    }

    return card
  })
}

function mapProcessItems(
  equipments: DashboardEquipmentContract[],
  policies: DashboardMatchedPolicyContract[],
  analysis: DashboardAnalysisStorage | null,
) {
  if (equipments.length === 0) return processItems

  const roiData = getRoiData(analysis)
  const roi =
    formatPercent(
      findNumberByKeys(roiData, ["roi_percent", "roi_rate", "expected_roi", "roi"]),
    ) ?? processItems[2].roi
  const payback =
    formatPayback(
      analysis?.draft_result?.payback_months ??
        findNumberByKeys(roiData, ["payback_months", "payback_period_months"]),
    ) ?? processItems[2].payback
  const expectedSupport =
    formatManwon(
      analysis?.draft_result?.subsidy_manwon ??
        findNumberByKeys(roiData, ["subsidy_manwon", "expected_subsidy_manwon"]),
    ) ?? processItems[2].expectedSupport

  return equipments.slice(0, 5).map((equipment, index) => {
    const fallback = processItems[index] ?? processItems[processItems.length - 1]
    const policy = findPolicyForEquipment(policies, equipment, index)
    const score = getPolicyScore(policy) ?? getEquipmentScore(equipment)
    const tone = getToneByScore(score)

    return {
      ...fallback,
      step: String(index + 1).padStart(2, "0"),
      title: equipment.name?.trim() || fallback.title,
      status: getEquipmentAgeStatus(equipment.age_years),
      description:
        compactText(equipment.process) ||
        compactText(equipment.category) ||
        `${equipment.age_years ?? "-"}년 사용 설비`,
      score,
      grade: getGrade(score),
      tone,
      supportProgram: policy?.title?.trim() || fallback.supportProgram,
      expectedSupport,
      applicationStatus: policy?.eligible === false ? "조건 확인 필요" : "검토 추천",
      nextStep: policy?.reason ? "지원조건 확인" : fallback.nextStep,
      roi,
      payback,
    }
  })
}

function mapReasonItems(
  policies: DashboardMatchedPolicyContract[],
  equipments: DashboardEquipmentContract[],
) {
  const policyReasons = policies
    .map((policy) => ({
      title: policy.title?.trim() || "지원사업 매칭 근거",
      description: policy.reason?.trim() || "기업 조건과 설비 정보를 기준으로 추천되었습니다.",
    }))
    .filter((item) => item.title || item.description)

  if (policyReasons.length > 0) return policyReasons.slice(0, 5)

  const equipment = equipments[0]
  if (!equipment) return reasonItems

  return [
    {
      title: `${equipment.name ?? "선택 설비"} 분석 필요`,
      description: `${equipment.category ?? "설비"} 정보와 사용연수 기준으로 ROI와 지원사업 추천을 확인할 수 있습니다.`,
    },
    ...reasonItems.slice(1),
  ]
}

function mapDdayItems(policies: DashboardMatchedPolicyContract[]) {
  if (policies.length === 0) return ddayItems

  return policies.slice(0, 3).map((policy, index) => ({
    title: policy.title?.trim() || ddayItems[index]?.title || "추천 지원사업",
    amount: ddayItems[index]?.amount ?? "지원금 확인 필요",
    dday: ddayItems[index]?.dday ?? "확인",
  }))
}

export function mapDashboardData({
  onboarding,
  analysis,
}: MapDashboardDataParams): DashboardViewModel {
  const company = onboarding?.company ?? analysis?.company ?? null
  const equipments = normalizeEquipments(onboarding, analysis)
  const policies = normalizePolicies(analysis)

  const hasApiData = Boolean(company || equipments.length > 0 || policies.length > 0)

  return {
    companyRows: mapCompanyRows(company),
    equipmentRows: mapEquipmentRows(equipments),
    kpiCards: mapKpiCards(analysis, policies),
    serviceCards,
    processItems: mapProcessItems(equipments, policies, analysis),
    reasonItems: mapReasonItems(policies, equipments),
    ddayItems: mapDdayItems(policies),
    isFallback: !hasApiData,
  }
}
