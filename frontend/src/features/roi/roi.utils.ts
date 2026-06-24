import type {
  RoiApiData,
  RoiApiResponse,
  RoiApiScenario,
  RoiFormState,
  ScenarioCard,
  ScoreSummary,
} from "./roi.contract"
import {
  EQUIPMENT_TYPE_OPTIONS,
  INDUSTRY_CODE_TO_NAME,
  MY_PAGE_STORAGE_KEY,
  initialForm,
} from "./roi.constants"

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function roundTo(value: number, digits = 1) {
  const unit = 10 ** digits
  return Math.round(value * unit) / unit
}

export function normalizeNumberString(value: string | number | undefined | null) {
  return String(value ?? "").replace(/,/g, "").trim()
}

export function toNumber(value: string | number | undefined | null, fallback = 0) {
  const num = Number(normalizeNumberString(value))
  return Number.isFinite(num) ? num : fallback
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "")
}

export function formatCommaNumber(value: string | number | undefined | null) {
  const normalized = onlyDigits(String(value ?? ""))

  if (!normalized) return ""

  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value))
}

export function formatMoneyFromManwon(value: number) {
  const normalized = Number.isFinite(value) ? value : 0

  if (Math.abs(normalized) >= 10000) {
    const eok = normalized / 10000
    return `${roundTo(eok, 1)}억`
  }

  return `${formatNumber(normalized)}만원`
}

export function formatAnnualMoneyFromManwon(value: number) {
  return `${formatMoneyFromManwon(value)}/년`
}

export function formatPaybackYears(value: number | null) {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return "-"
  }

  if (value < 1) {
    return `${Math.max(Math.round(value * 12), 1)}개월`
  }

  const rounded = roundTo(value, 1)

  if (Number.isInteger(rounded)) {
    return `${rounded}년`
  }

  return `${rounded}년`
}

export function getEquipmentTypeOptionByKey(key: string) {
  return (
    EQUIPMENT_TYPE_OPTIONS.find((item) => item.key === key) ??
    EQUIPMENT_TYPE_OPTIONS[0]
  )
}

export function normalizeEquipmentTypeValue(value: string | undefined | null) {
  const normalized = String(value ?? "").toLowerCase()

  if (normalized.includes("cnc")) return getEquipmentTypeOptionByKey("cnc").value
  if (normalized.includes("injection") || normalized.includes("사출")) {
    return getEquipmentTypeOptionByKey("injection").value
  }
  if (normalized.includes("press") || normalized.includes("프레스")) {
    return getEquipmentTypeOptionByKey("press").value
  }

  return getEquipmentTypeOptionByKey("press").value
}

export function getDefaultEquipmentName(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)
  return getEquipmentTypeOptionByKey(key).defaultName
}

export function detectEquipmentTypeFromName(name: string) {
  const normalized = name.toLowerCase()

  return EQUIPMENT_TYPE_OPTIONS.find((option) =>
    option.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  )?.value
}

export function hasConflictingEquipmentName(name: string, equipmentType: string) {
  const detectedType = detectEquipmentTypeFromName(name)

  if (!detectedType) return false

  return getEquipmentCategoryKey(detectedType) !== getEquipmentCategoryKey(equipmentType)
}

export function isDefaultEquipmentName(name: string) {
  return EQUIPMENT_TYPE_OPTIONS.some((option) => option.defaultName === name)
}

export function getFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

export function getFirstNumberString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue

    const normalized = normalizeNumberString(String(value))

    if (normalized) return normalized
  }

  return ""
}

export function getPrimaryIndustryCode(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim()
  }

  return String(value ?? "").split(",")[0]?.trim() ?? ""
}

export function getInitialFormFromMyPage(): RoiFormState {
  if (typeof window === "undefined") {
    return initialForm
  }

  try {
    const raw = window.localStorage.getItem(MY_PAGE_STORAGE_KEY)
    if (!raw) return initialForm

    const saved = JSON.parse(raw)
    const companyInfo = saved?.companyInfo ?? {}
    const equipment = Array.isArray(saved?.equipmentList)
      ? saved.equipmentList[0] ?? {}
      : {}

    const equipmentType = normalizeEquipmentTypeValue(
      getFirstString(equipment.category, equipment.equipmentType, equipment.name),
    )
    const equipmentName = getFirstString(equipment.name) || getDefaultEquipmentName(equipmentType)
    const industryCode = getPrimaryIndustryCode(
      companyInfo.industryCode ?? companyInfo.industry_code,
    )

    return {
      equipmentType,
      industryCode,
      industryName:
        getFirstString(companyInfo.industry, companyInfo.industryName) ||
        findIndustryNameByCode(industryCode) ||
        initialForm.industryName,
      region: getFirstString(companyInfo.region) || initialForm.region,
      equipmentName,
      equipmentAge: getFirstNumberString(equipment.years, equipment.age_years),
      annualEnergyCostManwon: formatCommaNumber(
        getFirstNumberString(equipment.annualEnergyCost, equipment.energy_cost_annual),
      ),
      annualRevenueManwon: formatCommaNumber(
        getFirstNumberString(companyInfo.annualRevenue, companyInfo.annual_revenue),
      ),
      employees: formatCommaNumber(
        getFirstNumberString(companyInfo.employees, companyInfo.employee_count),
      ),
      process: getFirstString(equipment.process),
      currentCapacityValue: getFirstNumberString(
        equipment.currentCapacityValue,
        equipment.current_capacity_value,
      ),
      defectRate: getFirstNumberString(equipment.defectRate, equipment.defect_rate),
      productionQty: formatCommaNumber(
        getFirstNumberString(equipment.productionQty, equipment.production_qty),
      ),
      contributionMarginWon: formatCommaNumber(
        getFirstNumberString(
          equipment.contributionMarginWon,
          equipment.contribution_margin_won,
        ),
      ),
      scenarioAInvestmentManwon: formatCommaNumber(
        getFirstNumberString(
          equipment.scenarioAInvestment,
          equipment.scenario_a_investment_manwon,
        ),
      ),
      scenarioBInvestmentManwon: formatCommaNumber(
        getFirstNumberString(
          equipment.scenarioBInvestment,
          equipment.scenario_b_investment_manwon,
        ),
      ),
      annualMaintenanceCostManwon: formatCommaNumber(
        getFirstNumberString(
          equipment.maintenanceCostAnnual,
          equipment.maintenance_cost_annual,
        ),
      ),
    }  } catch (error) {
    console.warn("마이페이지 저장 정보를 ROI 입력값으로 불러오지 못했습니다.", error)
    return initialForm
  }
}

export function normalizeIndustryCode(code: string) {
  return code.trim().toUpperCase()
}

export function findIndustryNameByCode(code: string) {
  const primaryCode =
    normalizeIndustryCode(code)
      .split(/[,.\s/]+/)
      .map((item) => item.trim())
      .filter(Boolean)[0] ?? ""

  return INDUSTRY_CODE_TO_NAME[primaryCode] ?? ""
}

export function findIndustryCodeByName(name: string) {
  const normalized = name.trim()

  if (!normalized) return ""

  const exact = Object.entries(INDUSTRY_CODE_TO_NAME).find(
    ([, industryName]) => industryName === normalized,
  )

  if (exact) return exact[0]

  const partial = Object.entries(INDUSTRY_CODE_TO_NAME).find(
    ([, industryName]) =>
      industryName.includes(normalized) || normalized.includes(industryName),
  )

  if (partial) return partial[0]

  if (normalized.includes("1차") || normalized.includes("금속 제조")) return "C24"
  if (normalized.includes("금속가공") || normalized.includes("금속 가공")) return "C25"
  if (normalized.includes("전자") || normalized.includes("반도체")) return "C26"
  if (normalized.includes("전기")) return "C27"
  if (normalized.includes("기계") || normalized.includes("장비")) return "C28"
  if (normalized.includes("자동차")) return "C29"
  if (normalized.includes("운송")) return "C30"

  return ""
}

export function getEquipmentCategoryKey(equipmentType: string) {
  const normalized = equipmentType.toLowerCase()

  if (normalized.includes("press") || normalized.includes("프레스")) return "press"
  if (normalized.includes("cnc")) return "cnc"
  if (normalized.includes("injection") || normalized.includes("사출")) return "injection"

  return "press"
}

export function getDefaultInvestmentManwon(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)

  if (key === "cnc") return 18000
  if (key === "injection") return 15000

  return 22000
}

export function getDefaultEstimateRangeTextA(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)

  if (key === "cnc") return "1.5억 ~ 2.0억"
  if (key === "injection") return "1.2억 ~ 1.8억"

  return "1.8억 ~ 2.5억"
}

export function getDefaultEstimateRangeTextB(equipmentType: string) {
  const key = getEquipmentCategoryKey(equipmentType)

  if (key === "cnc") return "3,000만원 ~ 5,000만원"
  if (key === "injection") return "3,000만원 ~ 4,500만원"

  return "4,000만원 ~ 6,000만원"
}

export function buildLocalScenarios(form: RoiFormState): ScenarioCard[] {
  const annualEnergyCost = toNumber(form.annualEnergyCostManwon, 4500)
  const annualMaintenanceCost = toNumber(form.annualMaintenanceCostManwon, 1200)
  const annualRevenue = toNumber(form.annualRevenueManwon, 320000)
  const defectRate = toNumber(form.defectRate, 5.8)

  const defaultScenarioAInvestment = getDefaultInvestmentManwon(form.equipmentType)
  const scenarioAInvestment =
    toNumber(form.scenarioAInvestmentManwon, 0) || defaultScenarioAInvestment
  const scenarioBInvestment =
    toNumber(form.scenarioBInvestmentManwon, 0) ||
    Math.round(defaultScenarioAInvestment * 0.227)

  const scenarioASubsidy = Math.min(Math.round(scenarioAInvestment * 0.545), 12000)
  const scenarioANetInvestment = Math.max(scenarioAInvestment - scenarioASubsidy, 0)

  const scenarioBSubsidy = Math.round(scenarioBInvestment * 0.3)
  const scenarioBNetInvestment = Math.max(scenarioBInvestment - scenarioBSubsidy, 0)

  const scenarioAEnergySaving = Math.round(annualEnergyCost * 0.3)
  const scenarioBEnergySaving = Math.round(annualEnergyCost * 0.1)

  const scenarioAMaintenanceSaving = Math.round(annualMaintenanceCost * 0.55)
  const scenarioBMaintenanceSaving = Math.round(annualMaintenanceCost * 0.25)

  const scenarioADefectSaving = Math.round(annualRevenue * (defectRate / 100) * 0.071)
  const scenarioBDefectSaving = Math.round(annualRevenue * (defectRate / 100) * 0.032)

  const scenarioABenefit =
    scenarioAEnergySaving + scenarioAMaintenanceSaving + scenarioADefectSaving

  const scenarioBBenefit =
    scenarioBEnergySaving + scenarioBMaintenanceSaving + scenarioBDefectSaving

  const scenarioAPayback =
    scenarioABenefit > 0 ? roundTo(scenarioANetInvestment / scenarioABenefit, 1) : null

  const scenarioBPayback =
    scenarioBBenefit > 0 ? roundTo(scenarioBNetInvestment / scenarioBBenefit, 1) : null

  const scenarioARoi =
    scenarioANetInvestment > 0
      ? roundTo((scenarioABenefit / scenarioANetInvestment) * 100, 1)
      : 0

  const scenarioBRoi =
    scenarioBNetInvestment > 0
      ? roundTo((scenarioBBenefit / scenarioBNetInvestment) * 100, 1)
      : 0

  return [
    {
      id: "A",
      badge: "시나리오 A",
      title:
        getEquipmentCategoryKey(form.equipmentType) === "injection"
          ? "고효율 사출 전체 교체"
          : getEquipmentCategoryKey(form.equipmentType) === "cnc"
            ? "고효율 CNC 전체 교체"
            : "고효율 프레스 전체 교체",
      subtitle: "노후 설비를 고효율 신규 설비로 전면 교체",
      investmentManwon: scenarioAInvestment,
      subsidyManwon: scenarioASubsidy,
      netInvestmentManwon: scenarioANetInvestment,
      energySavingManwon: scenarioAEnergySaving,
      maintenanceSavingManwon: scenarioAMaintenanceSaving,
      defectSavingManwon: scenarioADefectSaving,
      annualNetBenefitManwon: scenarioABenefit,
      paybackYears: scenarioAPayback,
      roiPct: scenarioARoi,
      estimateRangeText: getDefaultEstimateRangeTextA(form.equipmentType),
      estimateBasisText: "설비 용량 기준",
    },
    {
      id: "B",
      badge: "시나리오 B",
      title: "핵심 부품 교체 + 스마트 모니터링",
      subtitle: "필수 부품 교체와 모니터링 중심의 점진 투자",
      investmentManwon: scenarioBInvestment,
      subsidyManwon: scenarioBSubsidy,
      netInvestmentManwon: scenarioBNetInvestment,
      energySavingManwon: scenarioBEnergySaving,
      maintenanceSavingManwon: scenarioBMaintenanceSaving,
      defectSavingManwon: scenarioBDefectSaving,
      annualNetBenefitManwon: scenarioBBenefit,
      paybackYears: scenarioBPayback,
      roiPct: scenarioBRoi,
      estimateRangeText: getDefaultEstimateRangeTextB(form.equipmentType),
      estimateBasisText: "핵심 부품 기준",
    },
  ]
}

export function normalizeApiData(response: unknown): RoiApiData | null {
  if (!response || typeof response !== "object") return null

  const target = response as RoiApiResponse
  const data = target.data

  if (target.roi_result && typeof target.roi_result === "object") {
    return target.roi_result
  }

  if (target.roi_data && typeof target.roi_data === "object") {
    return target.roi_data
  }

  if (data && typeof data === "object") {
    if ("roi_result" in data) {
      const analyzeRoiResult = (data as { roi_result?: RoiApiData | null }).roi_result

      if (analyzeRoiResult && typeof analyzeRoiResult === "object") {
        return analyzeRoiResult
      }
    }

    if ("roi_data" in data) {
      const analyzeRoiData = (data as { roi_data?: RoiApiData | null }).roi_data

      if (analyzeRoiData && typeof analyzeRoiData === "object") {
        return analyzeRoiData
      }
    }

    if ("scenario_a" in data || "scenario_b" in data) {
      return data as RoiApiData
    }
  }

  if (target.scenario_a || target.scenario_b) {
    return {
      scenario_a: target.scenario_a,
      scenario_b: target.scenario_b,
      recommended: target.recommended,
    }
  }

  return null
}

export function mergeApiScenarios(localScenarios: ScenarioCard[], apiData: RoiApiData | null) {
  if (!apiData) {
    return {
      scenarios: localScenarios,
      apiRecommended: "",
    }
  }

  const mapApiScenario = (local: ScenarioCard, api?: RoiApiScenario) => {
    if (!api) return local

    const investment = toNumber(api.investment_manwon, local.investmentManwon)
    const subsidy = toNumber(api.subsidy_manwon, local.subsidyManwon)
    const netInvestment = toNumber(api.net_investment_manwon, investment - subsidy)
    const annualNetBenefit = toNumber(
      api.annual_net_benefit_manwon,
      local.annualNetBenefitManwon,
    )
    const paybackYears = toNumber(api.payback_years, 0)
    const roiPct = toNumber(api.roi_pct, local.roiPct)
    const breakdown = api.breakdown ?? null
    const energySaving = toNumber(
      breakdown?.energy_saving_manwon,
      local.energySavingManwon,
    )
    const maintenanceSaving = toNumber(
      breakdown?.maintenance_saving_manwon,
      local.maintenanceSavingManwon,
    )
    const defectSaving = toNumber(
      breakdown?.defect_saving_manwon,
      local.defectSavingManwon,
    )

    return {
      ...local,
      title: typeof api.label === "string" && api.label.trim() ? api.label.trim() : local.title,
      investmentManwon: investment,
      subsidyManwon: subsidy,
      netInvestmentManwon: Math.max(netInvestment, 0),
      energySavingManwon: Math.max(energySaving, 0),
      maintenanceSavingManwon: Math.max(maintenanceSaving, 0),
      defectSavingManwon: Math.max(defectSaving, 0),
      annualNetBenefitManwon: annualNetBenefit,
      paybackYears: paybackYears > 0 ? roundTo(paybackYears, 1) : local.paybackYears,
      roiPct: roiPct > 0 && roiPct < 10000 ? roundTo(roiPct, 1) : local.roiPct,
    }
  }

  const merged = localScenarios.map((scenario) => {
    if (scenario.id === "A") {
      return mapApiScenario(scenario, apiData.scenario_a)
    }

    return mapApiScenario(scenario, apiData.scenario_b)
  })

  return {
    scenarios: merged,
    apiRecommended: String(apiData.recommended || "").toUpperCase(),
  }
}

export function buildPayload(form: RoiFormState) {
  const localScenarios = buildLocalScenarios(form)
  const scenarioA = localScenarios.find((item) => item.id === "A")!
  const scenarioB = localScenarios.find((item) => item.id === "B")!

  return {
    equipment: {
      name: form.equipmentName,
      category: getEquipmentCategoryKey(form.equipmentType),
      age_years: toNumber(form.equipmentAge, 0),
      energy_cost_annual: Math.round(toNumber(form.annualEnergyCostManwon, 4500) * 10000),
      maintenance_cost_annual: Math.round(
        toNumber(form.annualMaintenanceCostManwon, 1200) * 10000,
      ),
      defect_rate: toNumber(form.defectRate, 0),
      employee_count: toNumber(form.employees, 0),
      annual_revenue_manwon: toNumber(form.annualRevenueManwon, 0),
      process: form.process.trim(),
      current_capacity_value: toNumber(form.currentCapacityValue, 0),
      production_qty: toNumber(form.productionQty, 0),
      contribution_margin_won: toNumber(form.contributionMarginWon, 0),
      scenario_a_investment_manwon: scenarioA.investmentManwon,
      scenario_b_investment_manwon: scenarioB.investmentManwon,
    },
    company_context: {
      industry_code: form.industryCode,
      industry_name: form.industryName,
      region: form.region,
    },
    scenario_a_investment_manwon: scenarioA.investmentManwon,
    scenario_a_subsidy_manwon: scenarioA.subsidyManwon,
    scenario_b_investment_manwon: scenarioB.investmentManwon,
    scenario_b_subsidy_manwon: scenarioB.subsidyManwon,
  }
}

export function getMissingRequiredInputLabels(form: RoiFormState) {
  const requiredChecks: Array<[string, boolean]> = [
    ["설비 종류", Boolean(form.equipmentType.trim())],
    ["설비명", Boolean(form.equipmentName.trim())],
    ["업종명", Boolean(form.industryName.trim())],
    ["업종코드", Boolean(form.industryCode.trim())],
    ["설비 사용연수", Boolean(form.equipmentAge.trim())],
    ["연간 에너지 비용", Boolean(form.annualEnergyCostManwon.trim())],
    ["연 매출액", Boolean(form.annualRevenueManwon.trim())],
    ["지역", Boolean(form.region.trim())],
  ]

  return requiredChecks
    .filter(([, passed]) => !passed)
    .map(([label]) => label)
}

export function buildScores(form: RoiFormState, scenario: ScenarioCard): ScoreSummary {
  const age = toNumber(form.equipmentAge, 15)

  const supportFit = clamp(
    Math.round((scenario.subsidyManwon / Math.max(scenario.investmentManwon, 1)) * 150),
    35,
    96,
  )

  const savingEffect = clamp(
    Math.round((scenario.annualNetBenefitManwon / Math.max(scenario.netInvestmentManwon, 1)) * 190),
    25,
    96,
  )

  const aging = clamp(Math.round((age / 16) * 100), 45, 96)

  const safetyRisk = clamp(
    Math.round(age * 4.8 + toNumber(form.defectRate, 5.8) * 3.5),
    35,
    96,
  )

  const total = Math.round(
    supportFit * 0.35 + savingEffect * 0.25 + aging * 0.2 + safetyRisk * 0.2,
  )

  return {
    supportFit,
    savingEffect,
    aging,
    safetyRisk,
    total,
  }
}

export function getRecommendedScenarioId(
  form: RoiFormState,
  scenarios: ScenarioCard[],
  apiRecommended: string,
): "A" | "B" {
  if (apiRecommended === "A" || apiRecommended === "B") {
    return apiRecommended
  }

  const scenarioA = scenarios.find((item) => item.id === "A")!
  const scenarioB = scenarios.find((item) => item.id === "B")!

  const scoreA = buildScores(form, scenarioA).total
  const scoreB = buildScores(form, scenarioB).total

  return scoreA >= scoreB ? "A" : "B"
}

export function getStatusLabel(scores: ScoreSummary) {
  if (scores.total >= 80) return "투자 적합"
  if (scores.total >= 65) return "조건부 적합"
  return "재검토 필요"
}

export function getDescription(form: RoiFormState, scenario: ScenarioCard, scores: ScoreSummary) {
  const equipmentName = form.equipmentName || "현재 설비"

  if (scenario.id === "A") {
    return `${equipmentName} 기준 전체 교체 시나리오는 지원금과 절감 효과를 함께 고려할 때 중장기 투자안으로 검토할 수 있습니다. 현재 추정 회수기간은 약 ${formatPaybackYears(
      scenario.paybackYears,
    )}입니다.`
  }

  if (scores.total >= 75) {
    return `${equipmentName} 기준 부분 교체 시나리오는 초기 실부담금을 낮추는 장점이 있습니다. 다만 전체 교체 대비 절감 효과 규모는 작을 수 있으며, 현재 추정 회수기간은 약 ${formatPaybackYears(
      scenario.paybackYears,
    )}입니다.`
  }

  return `${equipmentName} 기준 부분 교체 시나리오는 예산 부담은 낮지만 절감 효과와 지원금 규모를 함께 확인하면서 신중하게 검토하는 것이 좋습니다.`
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "백엔드 서버에 연결할 수 없습니다. FastAPI 서버가 켜져 있는지 확인해주세요."
    }

    if (error.message.includes("400")) {
      return "입력값을 확인해주세요. 현재 설비 카테고리 또는 투자금 형식이 백엔드 조건과 다를 수 있습니다."
    }

    if (error.message.includes("500")) {
      return "백엔드 내부 오류가 발생했습니다. 서버 로그를 확인해주세요."
    }

    return error.message
  }

  return "알 수 없는 오류가 발생했습니다."
}

