export type InspectionPurpose = "safety_device" | "maintenance" | "safety_training"

export type SafetyCheckItem = {
  id: string
  company_id: string
  user_id: string
  equipment_id: string
  equipment_name?: string | null
  inspection_purpose: InspectionPurpose | string
  inspection_purpose_label?: string | null
  inspection_rule_id?: string | null
  check_item?: string | null
  check_content?: string | null
  inspection_pdf_file?: string | null
  pdf_file_url?: string | null
  current_safety_measures?: string | null
  pdf_uploaded_at?: string | null
  improvement_plan?: string | null
  additional_info?: string | null
  improvement_saved_at?: string | null
  status: string
  created_at: string
  updated_at: string
}

export type SafetyCheckListResponse = {
  items: SafetyCheckItem[]
  total_count: number
}

export type SafetyCheckCreatePayload = {
  company_id: string
  user_id?: string
  equipment_id: string
  equipment_name?: string
  inspection_purpose: InspectionPurpose
  inspection_purpose_label?: string
  current_safety_measures: string
  inspection_pdf_file: string
  pdf_file_url: string
}

export type SafetyCheckImprovementPayload = {
  improvement_plan: string
  additional_info: string
}
