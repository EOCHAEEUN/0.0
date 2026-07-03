import {
  ANALYSIS_RESULT_STORAGE_KEY,
  POLICY_SELECTION_STORAGE_KEYS,
} from "./applicationDraft.constants"
import type {
  AnalysisData,
  ChecklistItem,
  DraftResult,
  EquipmentInfo,
  MatchedPolicy,
  PolicySelection,
  ReadinessPart,
  RoiResult,
  RoiScenario,
  ScenarioKey,
  StatusTone,
} from "./applicationDraft.contract"

export function safeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function hasValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function formatManwon(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  const amount = Number(value)

  if (amount >= 10000) {
    const eok = amount / 10000
    return `${eok.toFixed(amount % 10000 === 0 ? 0 : 1)}억원`
  }

  return `${Math.round(amount).toLocaleString()}만원`
}

export function formatCurrencyWonFromManwon(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  const won = Math.round(Number(value) * 10000)
  return `₩ ${won.toLocaleString("ko-KR")}`
}

export function formatMonthlyPayback(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  const months = Number(value)

  if (months < 1) {
    return `${months.toFixed(1)}개월`
  }

  return `약 ${Math.round(months)}개월`
}

export function formatPaybackFromScenario(params: {
  payback_months?: number | null
  payback_years?: number | null
}) {
  if (params.payback_months !== null && params.payback_months !== undefined) {
    return formatMonthlyPayback(params.payback_months)
  }

  if (params.payback_years !== null && params.payback_years !== undefined) {
    const years = Number(params.payback_years)
    if (years >= 1 && Number.isInteger(years)) {
      return `약 ${years}년`
    }
    const months = years * 12
    return formatMonthlyPayback(months)
  }

  return "-"
}

export function formatPaybackYearsCompact(params: {
  payback_months?: number | null
  payback_years?: number | null
}) {
  if (params.payback_years !== null && params.payback_years !== undefined) {
    const years = Number(params.payback_years)
    if (!Number.isNaN(years)) {
      return `${years % 1 === 0 ? years.toFixed(0) : years.toFixed(1)}년`
    }
  }

  if (params.payback_months !== null && params.payback_months !== undefined) {
    const years = Number(params.payback_months) / 12
    if (!Number.isNaN(years)) {
      return `${years % 1 === 0 ? years.toFixed(0) : years.toFixed(1)}년`
    }
  }

  return "-"
}

export function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}%`
}

export function formatAnnualSaving(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  return `연 ${formatManwon(value)}`
}

export function parseResponseDraft(response?: string): DraftResult | null {
  if (!response) return null

  try {
    const parsed = JSON.parse(response)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export function readJsonFromStorage(key: string): unknown | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function readAnalysisData(): AnalysisData {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    const data = parsed?.data ?? parsed ?? {}
    const responseDraft = parseResponseDraft(data?.response)

    return {
      ...data,
      draft_result: data?.draft_result ?? responseDraft ?? null,
      matched_policies: Array.isArray(data?.matched_policies)
        ? data.matched_policies
        : [],
      raw_candidates: Array.isArray(data?.raw_candidates)
        ? data.raw_candidates
        : [],
    }
  } catch {
    return {}
  }
}

export function normalizeScenarioKey(value: unknown): ScenarioKey | null {
  if (!value) return null
  const text = String(value).toLowerCase()

  if (text.includes("b") || text.includes("부분")) return "B"
  if (text.includes("a") || text.includes("전체")) return "A"

  return null
}

export function getScenarioByKey(
  roiResult: RoiResult | null | undefined,
  key: ScenarioKey,
) {
  if (!roiResult) return undefined

  if (key === "B") {
    return roiResult.scenario_b ?? roiResult.scenario_a
  }

  return roiResult.scenario_a ?? roiResult.scenario_b
}

export function getInitialScenarioKey(
  roiResult?: RoiResult | null,
  policySelection?: PolicySelection | null,
): ScenarioKey {
  return (
    policySelection?.scenarioKey ||
    normalizeScenarioKey(policySelection?.scenarioLabel) ||
    normalizeScenarioKey(roiResult?.recommended) ||
    "A"
  )
}

export function getIndustryText(company?: AnalysisData["company"]) {
  if (!company) return "업종 정보 없음"
  if (company.industry_name) return company.industry_name

  if (Array.isArray(company.industry_code)) {
    return company.industry_code.join(", ")
  }

  return company.industry_code || "업종 정보 없음"
}

export function getEquipmentLabel(
  equipment?: EquipmentInfo | null,
  draft?: DraftResult | null,
) {
  const equipmentName =
    draft?.equipment_name || equipment?.name || "설비명 미입력"
  const process = equipment?.process

  if (process && process !== equipmentName) {
    return `${equipmentName} / ${process}`
  }

  return equipmentName
}

export function getPolicyScore(policy?: MatchedPolicy | null) {
  return safeNumber(
    policy?.hybrid_score ??
      policy?.final_score ??
      policy?.match_score ??
      policy?.llm_score,
    0,
  )
}

export function normalizePolicySelection(input: unknown): PolicySelection | null {
  if (!input || typeof input !== "object") return null
  const record = input as Record<string, any>
  const project =
    record.project ?? record.selectedProject ?? record.policy ?? record
  if (!project || typeof project !== "object") return null

  const p = project as Record<string, any>
  const scenarioText =
    p.scenarioKey ?? p.scenario_label ?? p.scenarioLabel ?? p.scenario_match
  const scenarioKey = normalizeScenarioKey(scenarioText)

  return {
    title: p.title ?? p.policy_title ?? p.name ?? null,
    agency: p.agency ?? p.organization ?? p.provider ?? null,
    scenarioKey,
    scenarioLabel: p.scenario_label ?? p.scenarioLabel ?? null,
    score:
      p.score ??
      p.hybrid_score ??
      p.final_score ??
      p.match_score ??
      p.llm_score ??
      null,
    maxAmountManwon: p.max_amount_manwon ?? p.max_amount ?? null,
    reason: p.reason ?? null,
  }
}

export function readStoredPolicySelection(): PolicySelection | null {
  for (const key of POLICY_SELECTION_STORAGE_KEYS) {
    const value = readJsonFromStorage(key)
    const normalized = normalizePolicySelection(value)
    if (normalized?.title) return normalized
  }

  return null
}

export function pickFirstMatchedPolicy(
  policies?: MatchedPolicy[],
): PolicySelection | null {
  const first = policies?.[0]
  if (!first) return null

  return {
    title: first.title ?? first.policy_title ?? null,
    agency: first.agency ?? first.organization ?? first.provider ?? null,
    scenarioKey: normalizeScenarioKey(
      first.scenario_label ?? first.scenario_match,
    ),
    scenarioLabel: first.scenario_label ?? null,
    score: getPolicyScore(first),
    maxAmountManwon: first.max_amount_manwon ?? first.max_amount ?? null,
    reason: first.reason ?? null,
  }
}

export function getExpectedBenefits(
  draft?: DraftResult | null,
  scenario?: RoiScenario,
) {
  const fromDraft = draft?.expected_benefits?.filter(Boolean)

  if (fromDraft && fromDraft.length > 0) {
    return fromDraft
  }

  const breakdown = scenario?.breakdown

  return [
    breakdown?.energy_saving_manwon
      ? `에너지 비용 절감 ${formatAnnualSaving(breakdown.energy_saving_manwon)}`
      : "에너지 비용 절감",
    breakdown?.maintenance_saving_manwon
      ? `유지보수 비용 절감 ${formatAnnualSaving(breakdown.maintenance_saving_manwon)}`
      : "유지보수 비용 절감",
    breakdown?.defect_saving_manwon
      ? `불량률 감소 효과 ${formatAnnualSaving(breakdown.defect_saving_manwon)}`
      : "불량률 감소",
  ]
}

export function makeCompletionScore(values: unknown[], weight: number) {
  const completed = values.filter(hasValue).length
  if (values.length === 0) return 0
  return Math.round((completed / values.length) * weight)
}

export function statusFromScore(
  score: number,
  weight: number,
): {
  status: "완료" | "확인 필요" | "보완 권장"
  tone: StatusTone
} {
  const ratio = weight === 0 ? 0 : score / weight

  if (ratio >= 0.9) return { status: "완료", tone: "ok" }
  if (ratio >= 0.55) return { status: "보완 권장", tone: "warn" }
  return { status: "확인 필요", tone: "need" }
}

export function buildReadinessParts(
  analysisData: AnalysisData,
  draft: DraftResult,
  policySelection: PolicySelection | null,
): ReadinessPart[] {
  const company = analysisData.company
  const equipment = analysisData.equipment
  const hasPolicy = Boolean(policySelection?.title || draft.selected_policy)

  const policyScore = hasPolicy ? 20 : 0
  const companyScore = makeCompletionScore(
    [
      company?.company_name ?? draft.company_name,
      company?.industry_name ?? company?.industry_code,
      company?.region,
      company?.company_type,
      company?.annual_revenue ?? company?.annual_revenue_manwon,
    ],
    20,
  )
  const equipmentScore = makeCompletionScore(
    [
      equipment?.name ?? draft.equipment_name,
      equipment?.category,
      equipment?.age_years,
      equipment?.energy_cost_annual,
      equipment?.maintenance_cost_annual,
    ],
    20,
  )
  const roiScore = analysisData.roi_result ? 40 : 0

  const parts: Array<Omit<ReadinessPart, "status" | "tone">> = [
    {
      key: "policy-fit",
      label: "지원사업 적합도",
      weight: 20,
      score: policyScore,
      description:
        "선택한 지원사업이 업종, 지역, 설비 투자 목적과 얼마나 맞는지 반영합니다.",
    },
    {
      key: "company-info",
      label: "기업 기본정보",
      weight: 20,
      score: companyScore,
      description:
        "기업명, 업종, 지역, 기업유형, 매출 등 신청서 기본 항목 입력률입니다.",
    },
    {
      key: "equipment-info",
      label: "설비현황 입력",
      weight: 20,
      score: equipmentScore,
      description:
        "설비명, 설비 종류, 사용연수, 에너지 비용, 투자비용 등 설비 정보 입력률입니다.",
    },
    {
      key: "roi-result",
      label: "ROI 분석 결과",
      weight: 40,
      score: roiScore,
      description:
        "투자금, 예상 지원금, 회수기간, 절감 효과 등 ROI 분석 결과 반영 여부입니다.",
    },
  ]

  return parts.map((part) => ({
    ...part,
    ...statusFromScore(part.score, part.weight),
  }))
}

export function buildChecklistItems(
  analysisData: AnalysisData,
  draft: DraftResult,
  policySelection: PolicySelection | null,
): ChecklistItem[] {
  const hasRoi = Boolean(analysisData.roi_result)
  const hasPolicies = Boolean(
    policySelection?.title || (analysisData.matched_policies ?? []).length > 0,
  )
  const hasCompany = Boolean(
    analysisData.company?.company_name || draft.company_name,
  )
  const hasEquipment = Boolean(
    analysisData.equipment?.name || draft.equipment_name,
  )

  return [
    {
      label: "ROI 분석 결과 반영",
      status: hasRoi ? "완료" : "확인 필요",
      tone: hasRoi ? "ok" : "need",
      description: "투자금, 회수기간, 절감 효과가 초안에 반영됩니다.",
    },
    {
      label: "지원사업 적합도 검토",
      status: hasPolicies ? "완료" : "확인 필요",
      tone: hasPolicies ? "ok" : "need",
      description: "선택한 정책의 업종·지역·지원한도 조건을 확인합니다.",
    },
    {
      label: "기업 기본정보 확인",
      status: hasCompany ? "완료" : "확인 필요",
      tone: hasCompany ? "ok" : "need",
      description: "기업명, 업종, 지역, 기업유형, 매출 정보를 확인합니다.",
    },
    {
      label: "설비현황 확인",
      status: hasEquipment ? "완료" : "확인 필요",
      tone: hasEquipment ? "ok" : "need",
      description: "대상 설비명, 종류, 사용연수, 비용 정보를 확인합니다.",
    },
    {
      label: "견적서 및 증빙자료 첨부",
      status: "확인 필요",
      tone: "need",
      description:
        "견적서, 설비 사진, 에너지 사용 내역은 제출 전 별도 확인이 필요합니다.",
    },
  ]
}

export function getPaybackMonths(draft: DraftResult, scenario?: RoiScenario) {
  if (draft.payback_months !== null && draft.payback_months !== undefined) {
    return draft.payback_months
  }

  if (
    scenario?.payback_years !== null &&
    scenario?.payback_years !== undefined
  ) {
    return Number(scenario.payback_years) * 12
  }

  return null
}

export function getScenarioInvestment(
  key: ScenarioKey,
  equipment: EquipmentInfo | null | undefined,
  draft: DraftResult,
  scenario?: RoiScenario,
) {
  if (
    scenario?.investment_manwon !== null &&
    scenario?.investment_manwon !== undefined
  ) {
    return scenario.investment_manwon
  }

  if (key === "B") {
    return (
      equipment?.scenario_b_investment_manwon ?? draft.investment_manwon ?? null
    )
  }

  return (
    equipment?.scenario_a_investment_manwon ?? draft.investment_manwon ?? null
  )
}

export function uniqueList(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      items
        .filter((item): item is string => Boolean(item && item.trim()))
        .map((item) => item.trim()),
    ),
  )
}
