export type DraftStatus = "idle" | "saved" | "downloadReady"
export type ScenarioKey = "A" | "B"
export type StatusTone = "ok" | "need" | "warn"

export type ChecklistItem = {
  label: string
  status: "완료" | "확인 필요" | "보완 권장"
  tone: StatusTone
  description: string
}

export type DraftResult = {
  company_name?: string | null
  equipment_name?: string | null
  selected_policy?: string | null
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
  safety_improvement?: SafetyImprovement | null
}

export type SafetyImprovementItem = {
  no?: number | null
  viewpoint_key?: string | null
  viewpoint_title?: string | null
  current_judgement?: string | null
  required_evidence_count?: number | null
  required_evidences?: RequiredEvidence[] | null
  matched_safety_rule_ids?: string[] | null
  matched_rule_titles?: string[] | null
  description?: string | null
}

export type RequiredEvidence =
  | string
  | {
      label?: string | null
      base_label?: string | null
      context?: string | null
      safety_rule_id?: string | null
      safety_rule_title?: string | null
      evidence_type?: string | null
    }

export type SafetyImprovement = {
  source?: string | null
  safety_viewer_policy_id?: string | null
  equipment_name?: string | null
  equipment_type?: string | null
  generation_source?: string | null
  usage_status?: string | null
  items?: SafetyImprovementItem[] | null
}

export type CompanyInfo = {
  company_id?: string | null
  user_id?: string | null
  company_name?: string | null
  industry_name?: string | null
  industry_code?: string[] | string | null
  region?: string | null
  company_type?: string | null
  business_registration_no?: string | null
  established_year?: number | string | null
  annual_revenue?: number | null
  annual_revenue_manwon?: number | null
  employee_count?: number | null
}

export type EquipmentInfo = {
  equipment_id?: string | null
  company_id?: string | null
  name?: string | null
  category?: string | null
  process?: string | null
  age_years?: number | null
  defect_rate?: number | null
  energy_cost_annual?: number | null
  maintenance_cost_annual?: number | null
  production_qty?: number | null
  scenario_a_investment_manwon?: number | null
  scenario_b_investment_manwon?: number | null
}

export type RoiScenario = {
  label?: string
  investment_manwon?: number
  subsidy_manwon?: number
  net_investment_manwon?: number
  annual_net_benefit_manwon?: number
  payback_years?: number
  roi_pct?: number
  breakdown?: {
    energy_saving_manwon?: number
    maintenance_saving_manwon?: number
    defect_saving_manwon?: number
  }
}

export type RoiResult = {
  scenario_a?: RoiScenario
  scenario_b?: RoiScenario
  recommended?: "A" | "B" | string
  data_quality?: {
    score?: number
    level?: string
    missing_fields?: string[]
    message?: string
  }
}

export type MatchedPolicy = {
  id?: string | number | null
  policy_id?: string | null
  title?: string | null
  policy_title?: string | null
  agency?: string | null
  organization?: string | null
  provider?: string | null
  match_score?: number | null
  final_score?: number | null
  hybrid_score?: number | null
  llm_score?: number | string | null
  scenario_label?: string | null
  scenario_match?: string[] | string | null
  max_amount?: number | null
  max_amount_manwon?: number | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
}

export type AnalysisData = {
  company?: CompanyInfo | null
  equipment?: EquipmentInfo | null
  equipment_id?: string | null
  roi_result?: RoiResult | null
  draft_result?: DraftResult | null
  matched_policies?: MatchedPolicy[]
  raw_candidates?: MatchedPolicy[]
  response?: string
}

export type PolicySelection = {
  title?: string | null
  agency?: string | null
  scenarioKey?: ScenarioKey | null
  scenarioLabel?: string | null
  score?: number | null
  maxAmountManwon?: number | null
  reason?: string | null
}

export type ReadinessPart = {
  key: string
  label: string
  weight: number
  score: number
  status: "완료" | "확인 필요" | "보완 권장"
  tone: StatusTone
  description: string
}

export type ApplicationDraftSavePayload = {
  company_name: string
  equipment_name: string
  selected_policy: string
  agency: string
  scenario: string
  application_purpose: string
  investment_manwon: number | null
  subsidy_manwon: number | null
  payback_months: number | null
  expected_benefits: string[]
  readiness_score: number
  readiness_parts: ReadinessPart[]
  business_necessity: string
  expected_effects: string
  required_documents: string[]
  saved_at: string
}
