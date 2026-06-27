export type ApiStatus = "idle" | "loading" | "success" | "empty" | "error"

export type RoiFormState = {
  equipmentType: string
  industryCode: string
  industryName: string
  region: string
  equipmentName: string
  equipmentAge: string
  annualEnergyCostManwon: string
  annualRevenueManwon: string
  employees: string
  process: string
  currentCapacityValue: string
  defectRate: string
  productionQty: string
  contributionMarginWon: string
  scenarioAInvestmentManwon: string
  scenarioBInvestmentManwon: string
  annualMaintenanceCostManwon: string
}

export type RoiApiScenarioBreakdown = {
  energy_saving_manwon?: number
  energy_saving_method?: string
  maintenance_saving_manwon?: number
  defect_saving_manwon?: number
  defect_saving_method?: string
}

export type RoiApiScenarioAssumptions = {
  energy_cost_annual_used?: number | null
  energy_cost_source?: "user_input" | "industry_benchmark"
}

export type RoiApiScenario = {
  label?: string
  investment_manwon?: number
  subsidy_manwon?: number
  net_investment_manwon?: number
  annual_net_benefit_manwon?: number
  payback_years?: number
  roi_pct?: number
  breakdown?: RoiApiScenarioBreakdown | null
  assumptions?: RoiApiScenarioAssumptions | null
}

export type RoiApiData = {
  scenario_a?: RoiApiScenario
  scenario_b?: RoiApiScenario
  recommended?: string
}

export type AnalyzeApiData = {
  roi_result?: RoiApiData | null
  roi_data?: RoiApiData | null
  matched_policies?: unknown[]
  policies?: unknown[]
  raw_candidates?: unknown[]
  total_candidates?: number
  response?: string
}

export type RoiApiResponse = {
  success?: boolean
  data?: RoiApiData | AnalyzeApiData | null
  scenario_a?: RoiApiScenario
  scenario_b?: RoiApiScenario
  recommended?: string
  roi_result?: RoiApiData | null
  roi_data?: RoiApiData | null
}

export type ScenarioCardAssumptions = {
  energyCostAnnualUsed: number | null
  energyCostSource: "user_input" | "industry_benchmark" | null
}

export type ScenarioCard = {
  id: "A" | "B"
  badge: string
  title: string
  subtitle: string
  investmentManwon: number
  subsidyManwon: number
  netInvestmentManwon: number
  energySavingManwon: number
  maintenanceSavingManwon: number
  defectSavingManwon: number
  annualNetBenefitManwon: number
  paybackYears: number | null
  roiPct: number
  estimateRangeText: string
  estimateBasisText: string
  assumptions: ScenarioCardAssumptions | null
}

export type ScoreSummary = {
  supportFit: number
  savingEffect: number
  aging: number
  safetyRisk: number
  total: number
}
