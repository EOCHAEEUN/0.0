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
  roi_period_months?: number
  roi_basis?: string
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
  policy_support_summary?: PolicySupportSummary | null
  matched_policies?: unknown[]
  policies?: unknown[]
  raw_candidates?: unknown[]
  total_candidates?: number
  response?: string
}

export type PolicySupportItem = {
  id?: string
  policy_id?: string
  component_key?: string
  component_name?: string
  support_type?: string
  effect_layer?: string
  calculation_method?: string
  review_status?: string
  roi_apply_method?: string
  fixed_amount_manwon?: number | null
  cap_amount_manwon?: number | null
  support_ratio?: number | null
  eligible_cost_ratio?: number | null
  evidence_text?: string | null
  applied_amount_manwon?: number
  roi_effect_applied?: boolean
}

export type PolicySupportLayer = {
  items?: PolicySupportItem[]
  pending_count?: number
  approved_count?: number
  roi_effect_applied?: boolean
}

export type PolicySupportSummary = {
  business_roi_support?: PolicySupportLayer
  financing_support?: PolicySupportLayer
  execution_support?: PolicySupportLayer
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
