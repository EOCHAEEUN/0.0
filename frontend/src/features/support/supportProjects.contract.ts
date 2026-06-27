export type ProjectTone = "green" | "blue" | "orange" | "red"

export type ScenarioKey = "A" | "B"

export type SupportProject = {
  id: number
  rawId: string
  title: string
  agency: string
  deadline: string
  deadlineRaw: string
  postedDate: string
  amount: string
  amountValueManwon: number | null
  fitScore: number
  category: string
  policyCategory: string
  description: string
  supportContent: string
  reasonText: string
  reasons: string[]
  tags: string[]
  tone: ProjectTone
  scenario: ScenarioKey
  scenarioLabel: "전체교체" | "부분교체"
  sourceUrl: string
}

export type ReadinessItem = {
  label: string
  status: string
  score: number
  tone: "green" | "orange" | "red"
  description: string
}

export type PolicyState = "loading" | "error" | "empty" | "success"

export type PolicyCounters = {
  totalPolicyCount: number
  industryMatchedCount: number
  aiRecommendedCount: number
  priorityCount: number
  otherMatchedCount: number
}

export type PolicySummary = {
  totalPolicyCount: number
  activePolicyCount: number
  matchedPolicyCount: number
  priorityPolicyCount: number
  updatedAt: string
}

export type PolicyApiItem = {
  id?: string | number
  policy_id?: string | number
  title?: string
  content?: string
  description?: string
  support_content?: string
  supportContent?: string
  reason?: string
  reasons?: string[] | string
  ai_reasons?: string[] | string
  llm_score?: string | number
  match_score?: number | string
  final_score?: number | string
  hybrid_score?: number | string
  score?: number | string
  eligible?: boolean
  scenario_match?: string[] | string | null
  scenario_label?: string | null
  url?: string | null
  source_url?: string | null
  policy_url?: string | null
  organization?: string | null
  agency?: string | null
  provider?: string | null
  deadline?: string | null
  deadline_display?: string | null
  end_date?: string | null
  posted_date?: string | null
  start_date?: string | null
  created_at?: string | null
  category?: string | null
  policy_category?: string | null
  service_category?: string | null
  max_amount?: number | string | null
  max_amount_manwon?: number | string | null
  matched_policy_id?: string | number
  import_row_id?: string | number | null
  summary?: string | null
  support_summary?: string | null
  policy_subcategory?: string | null
  subcategory?: string | null
  support_amount?: number | string | null
  subsidy_amount?: number | string | null
  support_limit?: number | string | null
  application_start_date?: string | null
  application_end_date?: string | null
  reception_start_date?: string | null
  reception_end_date?: string | null
  posted_at?: string | null
  registered_at?: string | null
  notice_date?: string | null
  notice_url?: string | null
  homepage_url?: string | null
  metadata?: {
    title?: string
    organization?: string
    agency?: string
    provider?: string
    deadline?: string | null
    deadline_display?: string | null
    end_date?: string | null
    posted_date?: string | null
    start_date?: string | null
    created_at?: string | null
    max_amount?: number | string | null
    max_amount_manwon?: number | string | null
    support_amount?: number | string | null
    subsidy_amount?: number | string | null
    support_limit?: number | string | null
    policy_category?: string
    policy_subcategory?: string | null
    service_category?: string
    category?: string | null
    subcategory?: string | null
    urgency_label?: string
    url?: string | null
    source_url?: string | null
    policy_url?: string | null
    notice_url?: string | null
    homepage_url?: string | null
    scenario_match?: string[] | string | null
    scenario_label?: string | null
    reason?: string
    content?: string
    description?: string
    summary?: string | null
    support_summary?: string | null
    support_content?: string
    posted_at?: string | null
    registered_at?: string | null
    notice_date?: string | null
    application_start_date?: string | null
    application_end_date?: string | null
    reception_start_date?: string | null
    reception_end_date?: string | null
  }
}

export type PolicyApiResponse = {
  success?: boolean
  data?: {
    policies?: PolicyApiItem[]
    matched_policies?: PolicyApiItem[]
    raw_candidates?: PolicyApiItem[]
    total?: number
    total_policy_count?: number
    policy_total?: number
    database_total?: number
    industry_matched_count?: number
    candidate_count?: number
    raw_candidate_count?: number
    ai_recommended_count?: number
    final_recommended_count?: number
    other_matched_count?: number
    source?: string
    message?: string
  }
  policies?: PolicyApiItem[]
  matched_policies?: PolicyApiItem[]
  raw_candidates?: PolicyApiItem[]
  total?: number
  message?: string
  error?: string
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
}

export type CompanyInfo = {
  company_id?: string
  company_name?: string | null
  industry_name?: string | null
  industry_code?: string[] | string | null
  employee_count?: number | null
  region?: string | null
  annual_revenue?: number | null
  company_type?: string | null
  primary_purpose?: string[] | null
  updated_at?: string | null
}

export type EquipmentInfo = {
  equipment_id?: string
  company_id?: string
  name?: string | null
  category?: string | null
  process?: string | null
  age_years?: number | null
  energy_cost_annual?: number | null
  defect_rate?: number | null
  maintenance_cost_annual?: number | null
  current_capacity_value?: number | null
  production_qty?: number | null
  contribution_margin_won?: number | null
  created_at?: string | null
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
    energy_saving_method?: string
    maintenance_saving_manwon?: number
    defect_saving_manwon?: number
    defect_saving_method?: string
  }
}

export type RoiResult = {
  scenario_a?: RoiScenario
  scenario_b?: RoiScenario
  recommended?: "A" | "B" | string
  ai_recommendation?: {
    decision?: string
    confidence_score?: number
    summary?: string
    top_reasons?: {
      factor?: string
      impact?: string
      message?: string
      source?: string
    }[]
    risks?: {
      type?: string
      level?: string
      message?: string
    }[]
    next_questions?: string[]
  }
  data_quality?: {
    score?: number
    level?: string
    missing_fields?: string[]
    message?: string
  }
  benchmark?: {
    avg_energy_cost_manwon?: number
    avg_defect_rate_pct?: number
    avg_replacement_cycle_yr?: number
    energy_vs_avg?: number
  }
  equipment_status?: {
    age_vs_cycle?: number
    is_overdue?: boolean
  }
}

export type AnalysisData = {
  company?: CompanyInfo | null
  equipment?: EquipmentInfo | null
  equipment_id?: string | null
  roi_result?: RoiResult | null
  matched_policies?: PolicyApiItem[]
  raw_candidates?: PolicyApiItem[]
  draft_result?: DraftResult | null
  response?: string
}

export type EquipmentContext = {
  equipmentName: string
  industryName: string
  equipmentAge: number | null
  defectRate: number | null
  roiPaybackMonths: number | null
  investmentManwon: number | null
  subsidyManwon: number | null
  recommendedScenario: string
}
