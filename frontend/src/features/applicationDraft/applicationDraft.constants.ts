import type { DraftResult } from "./applicationDraft.contract"

export const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"
export const APPLICATION_DRAFT_STORAGE_KEY = "factofit_application_draft"
export const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
export const EQUIPMENT_ID_STORAGE_KEY = "factofit_equipment_id"
export const AUTH_TOKEN_STORAGE_KEY = "factofit_access_token"

export const POLICY_SELECTION_STORAGE_KEYS = [
  "factofit_application_policy",
  "factofit_selected_support_project",
  "factofit_support_selected_project",
  "factofit_selected_policy",
  "factofit_policy_selection",
]

export const fallbackDraft: DraftResult = {
  company_name: "기업명 미입력",
  equipment_name: "설비명 미입력",
  selected_policy: "추천 지원사업 미선택",
  application_purpose: "노후 설비 교체 및 에너지 효율 개선",
  investment_manwon: null,
  subsidy_manwon: null,
  payback_months: null,
  expected_benefits: ["에너지 비용 절감", "유지보수 비용 절감", "불량률 감소"],
  readiness_score: 65,
  ai_reasons: [
    "ROI 분석 결과를 기반으로 설비투자 타당성을 검토했습니다.",
    "설비 노후도와 비용 개선 필요성을 신청 근거로 활용할 수 있습니다.",
  ],
  business_necessity:
    "현재 설비의 노후화로 인해 에너지 비용, 유지보수 부담, 품질 손실 문제가 발생하고 있어 설비 개선이 필요합니다.",
  expected_effects:
    "고효율 설비 도입을 통해 에너지 사용량을 줄이고 생산 안정성을 높이며, 불량률과 유지보수 비용을 낮출 수 있습니다.",
  required_documents: ["사업자등록증", "설비 견적서", "현 설비 사진"],
}
