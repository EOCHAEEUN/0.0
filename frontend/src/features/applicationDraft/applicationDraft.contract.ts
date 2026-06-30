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

export type ReadinessItemStatus =
  | "complete"
  | "needs_revision"
  | "needs_evidence"
  | "legacy_missing"

export type WorkspaceReadinessItem = {
  status: ReadinessItemStatus
  summary: string
  missing_fields?: string[]
}

export type WorkspaceScenario = {
  label?: string | null
  investment_manwon?: number | null
  subsidy_manwon?: number | null
  net_investment_manwon?: number | null
  payback_years?: number | null
  payback_months?: number | null
  roi_pct?: number | null
  annual_net_benefit_manwon?: number | null
}

export type WorkspaceSafetyRow = {
  no: number
  viewpoint_key: string
  viewpoint_label: string
  current_status: string
  evidence_status: "보유" | "일부 보유" | "미보유"
  description: string
}

export type ApplicationDraftWorkspaceData = {
  state: "ready" | "analysis_required"
  message?: string
  analysis_id: string | null
  company_id?: string
  equipment_id?: string
  policy_id?: string | null
  company: {
    company_name?: string | null
    industry_name?: string | null
    region?: string | null
    company_type?: string | null
  }
  equipment: {
    equipment_id?: string | null
    name?: string | null
    category?: string | null
    age_years?: number | null
    energy_cost_annual?: number | null
  }
  readiness: {
    company: WorkspaceReadinessItem
    equipment: WorkspaceReadinessItem
    roi: WorkspaceReadinessItem
    policy: WorkspaceReadinessItem
  }
  scenarios: {
    selected: "a" | "b"
    a: WorkspaceScenario
    b: WorkspaceScenario
  }
  policy: {
    policy_id?: string | null
    title?: string | null
    deadline?: string | null
    source: "policy_snapshot" | "legacy_missing"
    legacy_missing?: boolean
  }
  draft: {
    exists: boolean
    draft_result_id?: string | null
    content: DraftResult & Record<string, unknown>
    summary_paragraphs: string[]
  }
  safety: {
    rows: WorkspaceSafetyRow[]
    has_viewer_policy: boolean
  }
}

export type ApplicationDraftReportParams = {
  companyId: string
  equipmentId: string
  policyId: string
  analysisId?: string
  draftResultId?: string
}
