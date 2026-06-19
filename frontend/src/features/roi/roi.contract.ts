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

export type RoiApiScenario = {
  label?: string
  investment_manwon?: number
  subsidy_manwon?: number
  net_investment_manwon?: number
  annual_net_benefit_manwon?: number
  payback_years?: number
  roi_pct?: number
}

export type RoiApiData = {
  scenario_a?: RoiApiScenario
  scenario_b?: RoiApiScenario
  recommended?: string
}

export type RoiApiResponse = {
  success?: boolean
  data?: RoiApiData | null
  scenario_a?: RoiApiScenario
  scenario_b?: RoiApiScenario
  recommended?: string
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
}

export type ScoreSummary = {
  supportFit: number
  savingEffect: number
  aging: number
  safetyRisk: number
  total: number
}
