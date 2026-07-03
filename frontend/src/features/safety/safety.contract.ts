export type SafetyRuleType = "legal" | "voluntary" | string
export type SafetyRiskLevel = "critical" | "high" | "medium" | "low" | string
export type SafetyStatus = "pending" | "overdue" | string

export type PenaltyAmount = {
  label?: string | null
  amount_text?: string | null
  amount_value_manwon?: number | null
  penalty_type?: string | null
}

export type PenaltyAmountNote = {
  amounts?: PenaltyAmount[] | null
  penalty_kind?: string | null
  display_label?: string | null
  raw_text?: string | null
  tokens?: string[] | null
  notes?: string[] | null
  conditions?: string[] | null
  trigger?: string | null
}

export type SafetyRule = {
  rule_id?: string | null
  inspection_type?: string | null
  check_item?: string | null
  purpose?: string | null
  risk_level?: SafetyRiskLevel | null
  penalty_amount_note?: PenaltyAmountNote | null
  penalty_basis?: string | null
  recommended_cycle?: string | null
  cycle_text?: string | null
}

export type SafetyInspectionItem = {
  rule_type?: SafetyRuleType | null
  status?: SafetyStatus | null
  display_status?: string | null
  days_left?: number | null
  last_checked_at?: string | null
  next_due_at?: string | null
  rule?: SafetyRule | null
}

export type SafetySummaryCounts = {
  overdue_legal_count?: number | null
  overdue_count?: number | null
  due_soon_count?: number | null
  no_record_count?: number | null
  completed_count?: number | null
  total_count?: number | null
}

export type SafetyPurposeBreakdown = {
  purpose?: string | null
  incomplete_count?: number | null
  total_count?: number | null
}

export type SafetyEquipmentDashboardItem = {
  equipment_id?: string | null
  equipment_name?: string | null
  equipment_category?: string | null
  age_years?: number | null
  total_rule_count?: number | null
  summary_counts?: SafetySummaryCounts | null
  purpose_breakdown?: SafetyPurposeBreakdown[] | null
  priority_items?: SafetyInspectionItem[] | null
  all_items?: SafetyInspectionItem[] | null
}

export type SafetyDashboardSummary = {
  overdue_legal_count?: number | null
  overdue_count?: number | null
  due_soon_count?: number | null
  no_record_count?: number | null
  completed_count?: number | null
  total_count?: number | null
}

export type SafetyCalendarEvent = {
  equipment_id?: string | null
  equipment_name?: string | null
  display_status?: string | null
  days_left?: number | null
  rule_type?: SafetyRuleType | null
  rule?: SafetyRule | null
}

export type SafetyDashboardData = {
  summary?: SafetyDashboardSummary | null
  items?: SafetyEquipmentDashboardItem[] | null
  company_calendar_view?: Record<string, SafetyCalendarEvent[]> | null
  unsupported_equipment_names?: string[] | null
}

export type SafetyDashboardResponse = {
  success?: boolean
  data?: SafetyDashboardData | null
  message?: string
  detail?: unknown
}

export type PreWorkChecklistItem = {
  rule_id?: string | null
  rule_type?: SafetyRuleType | null
  inspection_type?: string | null
  check_item?: string | null
  risk_level?: SafetyRiskLevel | null
  checked_today?: boolean | null
}

export type PreWorkChecklistData = {
  items?: PreWorkChecklistItem[] | null
  total_count?: number | null
  checked_count?: number | null
}

export type PreWorkChecklistResponse = {
  success?: boolean
  data?: PreWorkChecklistData | null
  message?: string
  detail?: unknown
}

export type SafetyCheckStatusPayload = {
  equipment_id: string
  rule_type: SafetyRuleType
  rule_id: string
  last_checked_at: string
  is_pre_work_check?: boolean
  assignee?: string
  memo?: string
  evidence_file_url?: string
}
