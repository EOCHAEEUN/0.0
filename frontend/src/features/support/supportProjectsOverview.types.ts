export type SupportProjectsMode = "analysis_snapshot" | "live_discovery"

export type SupportProjectsFilter =
  | "all"
  | "priority"
  | "documents"
  | "closing"
  | "finance"

export type SupportProjectsCounts = {
  policy_db_total: number
  matched_total: number
  priority_policy_count: number
  closing_soon_count: number
}

export type SupportProjectsPreflightCheck = {
  label: string
  value: string
}

export type SupportProjectsPolicyCard = {
  rank?: number | null
  policy_id: string
  title: string
  organization: string
  deadline?: string | null
  deadline_display?: string | null
  d_day: string
  days_remaining?: number | null
  is_past_deadline?: boolean
  application_status: string
  support_type_label: string
  support_type_detail?: string | null
  recommendation_summary: string
  match_reason: string
  why_check_now: string[]
  preflight_checks: SupportProjectsPreflightCheck[]
  support_amount_text: string
  required_documents_label: string
  action_label: string
  tags: string[]
  condition_links: { label: string; value: string }[]
  eligible?: boolean
  scenario_label?: string | null
  url?: string | null
  summary?: string | null
  required_documents_count?: number | null
  exists?: boolean
}

export type SupportProjectsLiveDiscovery = {
  source: string
  total_count: number
  items: SupportProjectsPolicyCard[]
  error?: string | null
}

export type SupportProjectsAnalysisContext = {
  analysis_id: string
  company_id: string
  equipment_id?: string
  equipment_name?: string
  snapshot_status: "available" | "legacy_missing"
}

export type SupportProjectsOverviewResponse = {
  mode: SupportProjectsMode
  policy_database_total?: number
  analysis_context?: SupportProjectsAnalysisContext | null
  company: {
    company_id: string
    company_name: string
    industry_name?: string | null
    region?: string | null
    company_type?: string | null
  }
  equipment: {
    equipment_id: string
    name: string
    category?: string | null
    process?: string | null
  } | null
  analysis: {
    analysis_id: string
    created_at?: string | null
    scenario: string
  } | null
  counts: SupportProjectsCounts
  priority_policy: SupportProjectsPolicyCard
  priority_policies: SupportProjectsPolicyCard[]
  candidates?: SupportProjectsPolicyCard[]
  all_matched: SupportProjectsPolicyCard[]
  live_discovery: SupportProjectsLiveDiscovery
  legacy_state?: string | null
  empty_state?: string | null
}

export type SupportProjectsViewState =
  | { kind: "loading" }
  | {
      kind: "error"
      message: string
      status?: number
      isAuthError?: boolean
      previous?: SupportProjectsOverviewViewModel | null
    }
  | { kind: "legacy_missing"; model: SupportProjectsOverviewViewModel }
  | { kind: "empty"; model: SupportProjectsOverviewViewModel }
  | { kind: "ready"; model: SupportProjectsOverviewViewModel }

export type SupportProjectsOverviewViewModel = {
  mode: SupportProjectsMode
  isAnalysisMode: boolean
  companyId: string
  companyName: string
  equipmentName: string
  analysisId?: string
  heroTrustLabel: string
  heroTitle: string
  heroSubtitle: string
  counts: SupportProjectsCounts
  priorityPolicy: SupportProjectsPolicyCard | null
  priorityPolicies: SupportProjectsPolicyCard[]
  allMatched: SupportProjectsPolicyCard[]
  liveDiscovery: SupportProjectsLiveDiscovery
  analysisContext?: SupportProjectsAnalysisContext | null
  legacyState?: string | null
  emptyState?: string | null
}
