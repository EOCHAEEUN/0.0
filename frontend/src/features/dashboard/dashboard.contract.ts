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
  analysisId?: string
  company_id?: string
  equipment_id?: string
  roi_data?: Record<string, unknown> | null
  policy_snapshot?: Record<string, unknown> | null
  created_at?: string
}

export type DashboardMatchedPolicyContract = {
  analysis_id?: string
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
  active_analysis_id?: string | null
  activeAnalysisId?: string | null
  latest_analysis_id?: string | null
  latestAnalysisId?: string | null
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
  policy_snapshot_missing?: boolean
}

export type DashboardOverviewDeadline = {
  policy_id?: string | null
  title: string
  deadline?: string | null
  deadline_display: string
  d_day: string
  days_remaining: number
  status_hint: string
  is_priority?: boolean
}

export type DashboardOverviewAnalysis = {
  index: number
  analysis_id: string
  equipment_id?: string | null
  title: string
  equipment_name: string
  summary: string
  detail: string
  status: string
  created_at?: string | null
  roi_pct?: number | null
  annual_savings_manwon?: number | null
  investment_manwon?: number | null
  utilization_improvement_pct?: number | null
  chips?: string[]
}

export type DashboardOverviewResponse = {
  company?: {
    company_id?: string
    company_name?: string
    industry_name?: string | null
    region?: string | null
    company_type?: string | null
    representative_equipment_id?: string | null
  }
  active_analysis?: {
    analysis_id?: string | null
    equipment_id?: string | null
    equipment_name?: string | null
    analysis_created_at?: string | null
    status?: string
    policy_snapshot_legacy_missing?: boolean
  }
  hero?: {
    priority_equipment_count: number
    priority_equipment_name: string
    summary: string
    reason: string
  }
  counts?: {
    registered_equipment: number
    closing_soon: number
    matched_policies: number
    recent_analyses: number
  }
  today_tasks?: {
    count: number
    summary: string
    items: Array<{ key: string; label: string; summary: string }>
  }
  priority_policy?: {
    exists: boolean
    policy_id?: string | null
    title?: string | null
    deadline?: string | null
    d_day?: string | null
    tags: string[]
    reason: string
    legacy_missing?: boolean
  }
  deadlines?: DashboardOverviewDeadline[]
  calendar_deadlines?: DashboardOverviewDeadline[]
  recent_analyses?: DashboardOverviewAnalysis[]
  equipments?: Array<{
    equipment_id?: string
    name?: string
    category?: string
    process?: string | null
    age_years?: number | null
    is_representative?: boolean
  }>
  empty_state?: string | null
}
