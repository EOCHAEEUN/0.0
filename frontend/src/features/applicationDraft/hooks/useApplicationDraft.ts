import { useMemo, useState } from "react"
import { APPLICATION_DRAFT_STORAGE_KEY, fallbackDraft } from "../applicationDraft.constants"
import type {
  ApplicationDraftSavePayload,
  DraftStatus,
  PolicySelection,
  ScenarioKey,
} from "../applicationDraft.contract"
import {
  buildChecklistItems,
  buildReadinessParts,
  clamp,
  formatPercent,
  getEquipmentLabel,
  getExpectedBenefits,
  getInitialScenarioKey,
  getIndustryText,
  getPaybackMonths,
  getScenarioByKey,
  getScenarioInvestment,
  normalizePolicySelection,
  pickFirstMatchedPolicy,
  readAnalysisData,
  readStoredPolicySelection,
  safeNumber,
  uniqueList,
} from "../applicationDraft.utils"

export function useApplicationDraft(locationState: unknown) {
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle")
  const [isChecklistOpen, setIsChecklistOpen] = useState(false)

  const analysisData = useMemo(() => readAnalysisData(), [])
  const routePolicySelection = useMemo(
    () =>
      normalizePolicySelection(
        (locationState as Record<string, unknown> | null)?.selectedProject ??
          locationState,
      ),
    [locationState],
  )
  const storedPolicySelection = useMemo(() => readStoredPolicySelection(), [])
  const matchedPolicySelection = useMemo(
    () => pickFirstMatchedPolicy(analysisData.matched_policies),
    [analysisData.matched_policies],
  )

  const policySelection: PolicySelection | null =
    routePolicySelection ?? storedPolicySelection ?? matchedPolicySelection

  const draft = analysisData.draft_result ?? fallbackDraft
  const company = analysisData.company
  const equipment = analysisData.equipment
  const roiResult = analysisData.roi_result
  const initialScenarioKey = getInitialScenarioKey(roiResult, policySelection)
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>(initialScenarioKey)
  const selectedScenario = getScenarioByKey(roiResult, scenarioKey)

  const companyName =
    draft.company_name ||
    company?.company_name ||
    fallbackDraft.company_name ||
    "기업명 미입력"
  const equipmentName = getEquipmentLabel(equipment, draft)
  const selectedPolicy =
    policySelection?.title ||
    draft.selected_policy ||
    fallbackDraft.selected_policy ||
    "추천 지원사업 미선택"
  const selectedAgency = policySelection?.agency || "주관사 확인 필요"
  const scenarioLabel = scenarioKey === "A" ? "A안 전체교체" : "B안 부분교체"
  const applicationPurpose =
    draft.application_purpose ||
    fallbackDraft.application_purpose ||
    "노후 설비 교체 및 에너지 효율 개선"

  const investmentManwon = getScenarioInvestment(
    scenarioKey,
    equipment,
    draft,
    selectedScenario,
  )
  const subsidyManwon: number | null =
    selectedScenario?.subsidy_manwon ??
    draft.subsidy_manwon ??
    policySelection?.maxAmountManwon ??
    fallbackDraft.subsidy_manwon ??
    null
  const paybackMonths = getPaybackMonths(draft, selectedScenario)
  const expectedBenefits = getExpectedBenefits(draft, selectedScenario)

  const businessNecessity =
    draft.business_necessity ||
    fallbackDraft.business_necessity ||
    "설비 개선 필요성이 있습니다."
  const expectedEffects =
    draft.expected_effects ||
    fallbackDraft.expected_effects ||
    "설비 도입 후 생산성과 에너지 효율 개선이 기대됩니다."
  const draftMessage = `${businessNecessity} ${expectedEffects}`

  const readinessParts = buildReadinessParts(
    analysisData,
    draft,
    policySelection,
  )
  const computedReadinessScore = readinessParts.reduce(
    (sum, item) => sum + item.score,
    0,
  )
  const readinessScore = clamp(
    computedReadinessScore > 0
      ? computedReadinessScore
      : safeNumber(draft.readiness_score, fallbackDraft.readiness_score ?? 65),
    0,
    100,
  )

  const aiReasons = uniqueList([
    ...(draft.ai_reasons ?? []),
    policySelection?.reason,
    policySelection?.title
      ? `${selectedPolicy}의 지원 방향과 ${scenarioLabel} 투자 목적을 함께 검토했습니다.`
      : null,
    "ROI 분석 결과, 기업 기본정보, 설비현황 입력률을 초안 생성 기준으로 반영했습니다.",
  ])
  const requiredDocuments = uniqueList([
    ...(draft.required_documents ?? []),
    "사업자등록증",
    "최근 재무제표",
    "설비 견적서",
    "현 설비 사진",
    "에너지 사용 내역",
    "지원사업 공고문",
  ])
  const checklistItems = buildChecklistItems(
    analysisData,
    draft,
    policySelection,
  )
  const industryText = getIndustryText(company)
  const roiText =
    selectedScenario?.roi_pct !== undefined
      ? formatPercent(selectedScenario.roi_pct)
      : "검토 필요"
  const pdfStatusLabel =
    draftStatus === "downloadReady"
      ? "준비 완료"
      : draftStatus === "saved"
        ? "저장 완료"
        : "대기"

  const savePayload: ApplicationDraftSavePayload = {
    company_name: companyName,
    equipment_name: equipmentName,
    selected_policy: selectedPolicy,
    agency: selectedAgency,
    scenario: scenarioLabel,
    application_purpose: applicationPurpose,
    investment_manwon: investmentManwon,
    subsidy_manwon: subsidyManwon ?? null,
    payback_months: paybackMonths,
    expected_benefits: expectedBenefits,
    readiness_score: readinessScore,
    readiness_parts: readinessParts,
    business_necessity: businessNecessity,
    expected_effects: expectedEffects,
    required_documents: requiredDocuments,
    saved_at: new Date().toISOString(),
  }

  const handleSaveDraft = () => {
    window.localStorage.setItem(
      APPLICATION_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...savePayload, saved_at: new Date().toISOString() }),
    )

    setDraftStatus("saved")
  }

  const handlePrepareDownload = () => {
    setDraftStatus("downloadReady")
  }

  return {
    analysisData,
    draftStatus,
    isChecklistOpen,
    scenarioKey,
    setScenarioKey,
    setIsChecklistOpen,
    openChecklist: () => setIsChecklistOpen(true),
    closeChecklist: () => setIsChecklistOpen(false),
    company,
    companyName,
    equipmentName,
    selectedPolicy,
    selectedAgency,
    scenarioLabel,
    applicationPurpose,
    investmentManwon,
    subsidyManwon,
    paybackMonths,
    expectedBenefits,
    businessNecessity,
    expectedEffects,
    draftMessage,
    readinessParts,
    readinessScore,
    aiReasons,
    requiredDocuments,
    checklistItems,
    industryText,
    roiText,
    pdfStatusLabel,
    handleSaveDraft,
    handlePrepareDownload,
  }
}

export type ApplicationDraftModel = ReturnType<typeof useApplicationDraft>
