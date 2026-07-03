export type SupportProjectsMode = "analysis_snapshot" | "live_discovery"

export type SupportProjectsCounts = {
  policy_db_total: number
  matched_total: number
  priority_policy_count: number
  closing_soon_count: number
}

export type SupportProjectsConditionLink = {
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
  match_score: number | null
  match_score_label?: string | null
  fit_status: string
  match_reason: string
  support_amount_text: string
  tags: string[]
  condition_links: SupportProjectsConditionLink[]
  eligible?: boolean
  scenario_label?: string | null
  url?: string | null
  summary?: string | null
  exists?: boolean
}

export type SupportProjectsOverviewResponse = {
  mode: SupportProjectsMode
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
  candidates: SupportProjectsPolicyCard[]
  all_matched: SupportProjectsPolicyCard[]
  legacy_state?: string | null
  empty_state?: string | null
}

export type SupportProjectsViewState =
  | { kind: "loading" }
  | { kind: "error"; message: string; status?: number; isAuthError?: boolean; previous?: SupportProjectsOverviewViewModel | null }
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
  heroTitle: string
  heroSubtitle: string
  counts: SupportProjectsCounts
  priorityPolicy: SupportProjectsPolicyCard | null
  candidates: SupportProjectsPolicyCard[]
  allMatched: SupportProjectsPolicyCard[]
  priorityBadge: string
  secondaryBadge: string
  legacyState?: string | null
  emptyState?: string | null
}
