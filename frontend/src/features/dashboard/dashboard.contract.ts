export type DashboardCompanyContract = {
  company_id?: string
  company_name?: string
  industry_name?: string | null
  industry_code?: string[] | string | null
  industry_codes?: string[] | string | null
  region?: string | null
  company_type?: string | null
  employee_count?: number | null
  annual_revenue?: number | null
  primary_purpose?: string[] | string | null
}

export type DashboardEquipmentContract = {
  equipment_id?: string
  id?: string
  name?: string
  category?: string
  process?: string | null
  age_years?: number | null
  energy_cost_annual?: number | null
  defect_rate?: number | null
  maintenance_cost_annual?: number | null
  current_capacity_value?: number | null
  production_qty?: number | null
  contribution_margin_won?: number | null
  scenario_a_investment_manwon?: number | null
  scenario_b_investment_manwon?: number | null
}

export type DashboardRoiOutputContract = {
  id?: string
  analysis_id?: string
  company_id?: string
  equipment_id?: string
  roi_data?: Record<string, unknown> | null
  created_at?: string
}

export type DashboardMatchedPolicyContract = {
  company_id?: string
  equipment_id?: string
  policy_id?: string | number | null
  id?: string | number | null
  title?: string | null
  organization?: string | null
  agency?: string | null
  provider?: string | null
  match_score?: number | null
  llm_score?: number | null
  hybrid_score?: number | null
  final_score?: number | null
  eligible?: boolean | null
  reason?: string | null
  scenario_match?: string[] | string | null
  scenario_label?: string | null
  deadline?: string | null
  deadline_display?: string | null
  end_date?: string | null
  application_end_date?: string | null
  reception_end_date?: string | null
  max_amount?: number | string | null
  max_amount_manwon?: number | string | null
  support_amount?: number | string | null
  subsidy_amount?: number | string | null
  support_limit?: number | string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
}

export type DashboardDraftResultContract = {
  company_id?: string
  equipment_id?: string
  policy_id?: string | number | null
  company_name?: string | null
  equipment_name?: string | null
  application_purpose?: string | null
  investment_manwon?: number | null
  subsidy_manwon?: number | null
  payback_months?: number | null
  expected_benefits?: string | null
  readiness_score?: number | null
  ai_reasons?: string[] | null
  business_necessity?: string | null
  expected_effects?: string | null
  required_documents?: string[] | null
  created_at?: string
}

export type DashboardOnboardingMeResponse = {
  user_profile?: {
    name?: string | null
    phone?: string | null
    email?: string | null
  } | null
  company?: DashboardCompanyContract | null
  equipments?: DashboardEquipmentContract[] | null
  latest_roi_output?: DashboardRoiOutputContract | null
  roi_outputs?: DashboardRoiOutputContract[] | null
  matched_policies?: DashboardMatchedPolicyContract[] | null
}

export type DashboardAnalysisStorage = {
  id?: string
  analysis_id?: string
  createdAt?: string
  company_id?: string
  equipment_id?: string
  company?: DashboardCompanyContract | null
  equipment?: DashboardEquipmentContract | null
  equipments?: DashboardEquipmentContract[] | null
  roi_output?: DashboardRoiOutputContract | null
  roi_data?: Record<string, unknown> | null
  roi_result?: Record<string, unknown> | null
  matched_policies?: DashboardMatchedPolicyContract[] | null
  policies?: DashboardMatchedPolicyContract[] | null
  raw_candidates?: DashboardMatchedPolicyContract[] | null
  draft_result?: DashboardDraftResultContract | null
  total_policy_count?: number | string | null
  active_policy_count?: number | string | null
  policy_summary?: Record<string, unknown> | null
}
