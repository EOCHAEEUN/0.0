import type {
  AnalysisData,
  EquipmentContext,
  PolicyApiItem,
  PolicyCounters,
  ProjectTone,
  ReadinessItem,
  RoiResult,
  RoiScenario,
  ScenarioKey,
  SupportProject,
} from "./supportProjects.contract"

export const DEFAULT_POLICY_COUNTERS: PolicyCounters = {
  totalPolicyCount: 0,
  industryMatchedCount: 0,
  aiRecommendedCount: 0,
  priorityCount: 0,
  otherMatchedCount: 0,
}

const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"

export function parseResponseDraft(response?: string) {
  if (!response) return null

  try {
    const parsed = JSON.parse(response)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export function readAnalysisData(): AnalysisData {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    const parsedRecord =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    const dataRecord =
      parsedRecord.data && typeof parsedRecord.data === "object" && !Array.isArray(parsedRecord.data)
        ? (parsedRecord.data as Record<string, unknown>)
        : parsedRecord
    const responseDraft = parseResponseDraft(
      typeof dataRecord.response === "string" ? dataRecord.response : undefined,
    )

    return {
      ...dataRecord,
      draft_result: dataRecord.draft_result ?? responseDraft ?? null,
    } as AnalysisData
  } catch {
    return {}
  }
}

export function getAnalysisFingerprint(analysisData: AnalysisData) {
  return [
    analysisData.company?.updated_at,
    analysisData.equipment?.equipment_id,
    analysisData.equipment?.created_at,
    analysisData.draft_result?.readiness_score,
  ]
    .filter(Boolean)
    .join(":")
}

export function toNumberOrNull(value?: number | string | null) {
  if (value === null || value === undefined || value === "" || value === "None") {
    return null
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  const cleaned = String(value).replace(/[^\d.-]/g, "")
  if (!cleaned) return null

  const amount = Number(cleaned)
  return Number.isNaN(amount) ? null : amount
}

export function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function formatSupportAmount(value?: number | string | null) {
  const amount = toNumberOrNull(value)

  if (amount === null) return "정보 없음"

  if (amount >= 10000) {
    return `최대 ${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 1)}억원`
  }

  return `최대 ${amount.toLocaleString()}만원`
}

export function formatManwon(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-"
  }

  const amount = Number(value)

  if (amount >= 10000) {
    const eok = amount / 10000
    return `${eok.toFixed(amount % 10000 === 0 ? 0 : 1)}억원`
  }

  return `${Math.round(amount).toLocaleString()}만원`
}

export function normalizeDate(value?: string | null) {
  if (!value || value === "None" || value === "마감일 미정") return ""
  return value.slice(0, 10).replace(/-/g, ".")
}

export function normalizeDeadline(value?: string | null) {
  return normalizeDate(value) || "마감일 미정"
}

export function formatDeadline(deadline: string) {
  if (deadline === "마감일 미정") return "-"
  return deadline.slice(5).replace(".", "/")
}

export function getDday(deadlineRaw?: string | null) {
  if (!deadlineRaw || deadlineRaw === "None" || deadlineRaw === "마감일 미정") {
    return "마감일 미정"
  }

  const normalized = deadlineRaw.slice(0, 10)
  const deadlineDate = new Date(`${normalized}T23:59:59`)

  if (Number.isNaN(deadlineDate.getTime())) return "마감일 미정"

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diff = Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000)

  if (diff < 0) return "마감"
  if (diff === 0) return "D-DAY"
  return `D-${diff}`
}

export function getProjectTone(score: number): ProjectTone {
  if (score >= 85) return "green"
  if (score >= 75) return "blue"
  if (score >= 65) return "orange"
  return "red"
}

export function getProjectScoreColor(score: number) {
  if (score >= 85) return "#0B7A53"
  if (score >= 70) return "#E65F00"
  return "#CD2E3A"
}

export function getFitLabel(score: number) {
  if (score >= 85) return "매우 적합"
  if (score >= 75) return "적합"
  if (score >= 65) return "검토 가능"
  return "낮음"
}

export function getFitClass(score: number) {
  if (score >= 85) return "ok"
  if (score >= 70) return "mid"
  return "no"
}

export function getToneColor(tone: ReadinessItem["tone"]) {
  if (tone === "green") return "#0B7A53"
  if (tone === "orange") return "#E65F00"
  return "#CD2E3A"
}

function scoreToPercent(policy: PolicyApiItem) {
  const scoredValues = [
    policy.hybrid_score,
    policy.final_score,
    policy.match_score,
    policy.score,
  ]

  for (const value of scoredValues) {
    const numericScore = toNumberOrNull(value)

    if (numericScore !== null) {
      if (numericScore <= 1) return clampScore(numericScore * 100)
      return clampScore(numericScore)
    }
  }

  const llmScore = String(policy.llm_score ?? "")
  const numericLlmScore = toNumberOrNull(policy.llm_score)

  if (numericLlmScore !== null) {
    if (numericLlmScore <= 1) return clampScore(numericLlmScore * 100)
    return clampScore(numericLlmScore)
  }

  const filled = (llmScore.match(/●/g) ?? []).length
  if (filled > 0) return clampScore(filled * 20)

  return 70
}

function getFirstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return ""
}

function getMetadataRecord(policy: PolicyApiItem) {
  return policy.metadata && typeof policy.metadata === "object"
    ? (policy.metadata as Record<string, unknown>)
    : {}
}

function getFieldText(source: Record<string, unknown>, ...keys: string[]) {
  return getFirstText(...keys.map((key) => source[key]))
}

function getFieldValue(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (value !== null && value !== undefined && value !== "") return value
  }

  return null
}

function toBooleanOrUndefined(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "y"].includes(normalized)) return true
    if (["false", "0", "no", "n"].includes(normalized)) return false
  }
  return undefined
}

export function resolveCanRunSafetyLogic(status?: unknown): boolean {
  if (typeof status === "boolean") return status
  if (status === null || status === undefined) return false

  const normalized = String(status).trim().toLowerCase()
  return ["사용 가능", "조건부 사용 가능", "available", "conditional"].includes(normalized)
}

function resolvePolicySafetyLogic(policy: PolicyApiItem, metadata: Record<string, unknown>) {
  const explicitValue = toBooleanOrUndefined(
    policy.can_run_safety_logic ?? getFieldValue(metadata, "can_run_safety_logic"),
  )
  if (explicitValue !== undefined) return explicitValue

  return resolveCanRunSafetyLogic(
    getFieldValue(
      policy as unknown as Record<string, unknown>,
      "safety_justification_usable",
      "usage_status",
      "availability",
      "display_status",
      "policy_status",
      "classification",
    ) ??
      getFieldValue(
        metadata,
        "safety_justification_usable",
        "usage_status",
        "availability",
        "display_status",
        "policy_status",
        "classification",
      ),
  )
}

function normalizeReasonList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|•|- /)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeScenario(policy: PolicyApiItem, index: number): ScenarioKey {
  const metadata = policy.metadata ?? {}
  const rawScenario = policy.scenario_match ?? metadata.scenario_match ?? metadata.scenario_label ?? policy.scenario_label
  const scenarioText = Array.isArray(rawScenario)
    ? rawScenario.join(",").toLowerCase()
    : String(rawScenario ?? "").toLowerCase()

  if (scenarioText.includes("b") || scenarioText.includes("부분")) return "B"
  if (scenarioText.includes("a") || scenarioText.includes("전체")) return "A"

  return index % 2 === 1 ? "B" : "A"
}

function getPolicySourceUrl(policy: PolicyApiItem) {
  const metadata = getMetadataRecord(policy)
  const policyRecord = policy as unknown as Record<string, unknown>

  return getFirstText(
    policy.source_url,
    policy.policy_url,
    policy.url,
    policy.notice_url,
    policy.homepage_url,
    getFieldText(
      policyRecord,
      "detail_url",
      "apply_url",
      "link",
      "homepage",
      "source_link",
      "notice_link",
      "pblanc_url",
      "pblancUrl",
      "pblanc_url_addr",
      "biz_url",
      "business_url",
    ),
    metadata.source_url,
    metadata.policy_url,
    metadata.url,
    metadata.notice_url,
    metadata.homepage_url,
    getFieldText(
      metadata,
      "detail_url",
      "apply_url",
      "link",
      "homepage",
      "source_link",
      "notice_link",
      "pblanc_url",
      "pblancUrl",
      "pblanc_url_addr",
      "biz_url",
      "business_url",
    ),
  )
}

export function mapPolicyToProject(policy: PolicyApiItem, index: number): SupportProject {
  const metadata = getMetadataRecord(policy)
  const policyRecord = policy as unknown as Record<string, unknown>
  const fitScore = scoreToPercent(policy)
  const rawAmountValue =
    getFieldValue(
      policyRecord,
      "max_amount_manwon",
      "max_amount",
      "support_amount",
      "subsidy_amount",
      "support_limit",
      "limit_amount",
      "max_support_amount",
      "support_amount_manwon",
      "subsidy_amount_manwon",
      "budget_amount",
      "budget_manwon",
      "amount",
    ) ??
    getFieldValue(
      metadata,
      "max_amount_manwon",
      "max_amount",
      "support_amount",
      "subsidy_amount",
      "support_limit",
      "limit_amount",
      "max_support_amount",
      "support_amount_manwon",
      "subsidy_amount_manwon",
      "budget_amount",
      "budget_manwon",
      "amount",
    )
  const amountValueManwon = toNumberOrNull(
    typeof rawAmountValue === "number" || typeof rawAmountValue === "string"
      ? rawAmountValue
      : null,
  )
  const scenario = normalizeScenario(policy, index)
  const policyCategory = getFirstText(
    policy.policy_category,
    policy.category,
    policy.service_category,
    getFieldText(metadata, "policy_category", "category", "service_category"),
    "지원사업",
  )
  const policySubcategory = getFirstText(
    policy.policy_subcategory,
    policy.subcategory,
    getFieldText(metadata, "policy_subcategory", "subcategory"),
  )
  const title = getFirstText(
    policy.title,
    getFieldText(metadata, "title", "policy_title", "name"),
    `추천 지원사업 ${index + 1}`,
  )
  const agency = getFirstText(
    policy.agency,
    policy.organization,
    policy.provider,
    getFieldText(
      policyRecord,
      "ministry",
      "department",
      "host",
      "sponsor",
      "agency_name",
      "organization_name",
      "provider_name",
      "supervising_agency",
      "operating_agency",
      "institution",
      "institution_name",
      "organizer",
      "department_name",
      "managing_agency",
      "support_agency",
      "jurisdiction",
    ),
    getFieldText(
      metadata,
      "agency",
      "organization",
      "provider",
      "ministry",
      "department",
      "host",
      "sponsor",
      "agency_name",
      "organization_name",
      "provider_name",
      "supervising_agency",
      "operating_agency",
      "institution",
      "institution_name",
      "organizer",
      "department_name",
      "managing_agency",
      "support_agency",
      "jurisdiction",
    ),
    "주관사 미확인",
  )
  const rawDeadline = getFirstText(
    policy.deadline,
    policy.deadline_display,
    policy.end_date,
    policy.application_end_date,
    policy.reception_end_date,
    getFieldText(
      policyRecord,
      "close_date",
      "deadline_date",
      "apply_end_date",
      "reception_deadline",
      "receipt_end_date",
      "pblanc_end_date",
      "end_dt",
      "biz_end_date",
    ),
    getFieldText(
      metadata,
      "deadline",
      "deadline_display",
      "end_date",
      "application_end_date",
      "reception_end_date",
      "close_date",
      "deadline_date",
      "apply_end_date",
      "reception_deadline",
      "receipt_end_date",
      "pblanc_end_date",
      "end_dt",
      "biz_end_date",
    ),
  )
  const rawPostedDate = getFirstText(
    policy.posted_date,
    policy.start_date,
    policy.created_at,
    policy.posted_at,
    policy.registered_at,
    policy.notice_date,
    policy.application_start_date,
    policy.reception_start_date,
    getFieldText(
      policyRecord,
      "open_date",
      "announcement_date",
      "announce_date",
      "created_date",
      "reg_date",
      "pblanc_begin_date",
      "start_dt",
      "biz_start_date",
    ),
    getFieldText(
      metadata,
      "posted_date",
      "start_date",
      "created_at",
      "posted_at",
      "registered_at",
      "notice_date",
      "application_start_date",
      "reception_start_date",
      "open_date",
      "announcement_date",
      "announce_date",
      "created_date",
      "reg_date",
      "pblanc_begin_date",
      "start_dt",
      "biz_start_date",
    ),
  )
  const supportContent = getFirstText(
    policy.support_content,
    policy.supportContent,
    policy.support_summary,
    policy.summary,
    policy.content,
    policy.description,
    getFieldText(
      policyRecord,
      "raw_text",
      "rawText",
      "detail_content",
      "detailContent",
      "business_content",
      "support_detail",
      "supportDetail",
      "notice_content",
      "pblanc_content",
      "body",
    ),
    getFieldText(
      metadata,
      "support_content",
      "supportContent",
      "support_summary",
      "summary",
      "raw_text",
      "rawText",
      "content",
      "description",
      "detail_content",
      "detailContent",
      "business_content",
      "support_detail",
      "supportDetail",
      "notice_content",
      "pblanc_content",
      "body",
    ),
    "지원내용 준비 중",
  )
  const reasonText = getFirstText(
    policy.reason,
    getFieldText(metadata, "reason"),
    policy.scenario_label,
    getFieldText(metadata, "scenario_label"),
    "업종·지역·설비 정보와 정책 조건을 기준으로 추천되었습니다.",
  )
  const reasons = normalizeReasonList(policy.reason)
    .concat(normalizeReasonList(getFieldValue(metadata, "reason")))
    .concat(normalizeReasonList(policy.ai_reasons))
    .concat(normalizeReasonList(policy.reasons))
    .slice(0, 5)
  const rawId = String(
    policy.policy_id ??
      policy.matched_policy_id ??
      policy.id ??
      policy.import_row_id ??
      getFieldValue(metadata, "policy_id", "matched_policy_id", "id", "import_row_id") ??
      index + 1,
  )

  return {
    id: Number(policy.id ?? policy.policy_id) || index + 1,
    rawId,
    title,
    agency,
    deadline: normalizeDeadline(rawDeadline),
    deadlineRaw: rawDeadline,
    postedDate: normalizeDate(rawPostedDate) || "공고 등록일 미확인",
    amount: formatSupportAmount(amountValueManwon),
    amountValueManwon,
    fitScore,
    category: policySubcategory ? `${policyCategory} · ${policySubcategory}` : policyCategory,
    policyCategory,
    description:
      reasonText || "기업 조건과 설비 정보를 기준으로 추천된 지원사업입니다.",
    supportContent,
    reasonText,
    reasons:
      reasons.length > 0
        ? reasons
        : [
            reasonText || "RAG 유사도 기반 매칭",
            "업종·지역·설비 정보와 정책 조건의 유사도를 함께 반영했습니다.",
          ],
    tags: [
      getFieldText(metadata, "urgency_label"),
      policySubcategory,
      policyCategory,
      agency,
    ].filter(Boolean) as string[],
    tone: getProjectTone(fitScore),
    scenario,
    scenarioLabel: scenario === "B" ? "부분교체" : "전체교체",
    sourceUrl: getPolicySourceUrl(policy),
    can_run_safety_logic: resolvePolicySafetyLogic(policy, metadata),
  }
}

export function rankProjects(projects: SupportProject[]) {
  return [...projects].sort((a, b) => b.fitScore - a.fitScore || a.id - b.id)
}

export function getSelectedScenario(roiResult?: RoiResult | null): RoiScenario | undefined {
  if (!roiResult) return undefined

  if (roiResult.recommended === "B") {
    return roiResult.scenario_b ?? roiResult.scenario_a
  }

  return roiResult.scenario_a ?? roiResult.scenario_b
}

export function getIndustryText(company?: AnalysisData["company"]) {
  if (!company) return "업종 정보 없음"

  if (company.industry_name) return company.industry_name

  if (Array.isArray(company.industry_code)) {
    return company.industry_code.join(", ")
  }

  return company.industry_code || "업종 정보 없음"
}

export function getEquipmentContext(analysisData: AnalysisData): EquipmentContext {
  const company = analysisData.company
  const equipment = analysisData.equipment
  const draft = analysisData.draft_result
  const roiResult = analysisData.roi_result
  const selectedScenario = getSelectedScenario(roiResult)

  const paybackMonths =
    draft?.payback_months ??
    (selectedScenario?.payback_years
      ? Number(selectedScenario.payback_years) * 12
      : null)

  return {
    equipmentName:
      draft?.equipment_name ||
      equipment?.name ||
      equipment?.process ||
      "설비 정보 없음",
    industryName: getIndustryText(company),
    equipmentAge:
      typeof equipment?.age_years === "number" ? equipment.age_years : null,
    defectRate:
      typeof equipment?.defect_rate === "number" ? equipment.defect_rate : null,
    roiPaybackMonths:
      typeof paybackMonths === "number" ? paybackMonths : null,
    investmentManwon:
      draft?.investment_manwon ??
      selectedScenario?.investment_manwon ??
      null,
    subsidyManwon:
      draft?.subsidy_manwon ??
      selectedScenario?.subsidy_manwon ??
      null,
    recommendedScenario: roiResult?.recommended || "A",
  }
}

export function getBestScore(projects: SupportProject[]) {
  if (projects.length === 0) return "-"
  return `${Math.max(...projects.map((project) => project.fitScore))}%`
}

export function getMaxSupportAmount(projects: SupportProject[]) {
  const amounts = projects
    .map((project) => project.amountValueManwon)
    .filter((amount): amount is number => typeof amount === "number")

  if (amounts.length === 0) return "-"

  return formatSupportAmount(Math.max(...amounts))
}

export function getPriorityCount(projects: SupportProject[]) {
  return projects.filter((project) => project.fitScore >= 85).length
}

export function getReadinessScore(analysisData: AnalysisData, policyCards: SupportProject[]) {
  const draftScore = analysisData.draft_result?.readiness_score

  if (typeof draftScore === "number") {
    const policyBonus = policyCards.length > 0 ? 8 : 0
    return clampScore(draftScore + policyBonus)
  }

  let score = 0

  if (analysisData.roi_result) score += 35
  if (analysisData.equipment) score += 20
  if (analysisData.company) score += 15
  if (analysisData.draft_result) score += 20
  if (policyCards.length > 0) score += 10

  return clampScore(score)
}

export function getReadinessComment(
  analysisData: AnalysisData,
  policyCards: SupportProject[],
) {
  const draft = analysisData.draft_result
  const roi = analysisData.roi_result
  const equipment = analysisData.equipment

  if (!roi && !draft) {
    return "아직 ROI 분석 결과가 없어 신청 준비도를 계산할 수 없습니다. 먼저 마이페이지에서 설비 정보를 저장한 뒤 분석을 진행해주세요."
  }

  if (policyCards.length === 0) {
    return `${equipment?.name || draft?.equipment_name || "선택 설비"} 기준 ROI와 신청서 초안은 생성되었습니다. 다만 현재 조건에 맞는 지원사업 결과가 없어 지원사업 적합도 검토가 추가로 필요합니다.`
  }

  return `${equipment?.name || draft?.equipment_name || "선택 설비"} 기준 ROI 분석과 지원사업 추천 결과가 반영되었습니다. 견적서와 증빙자료를 보완하면 신청 완성도를 더 높일 수 있습니다.`
}

function getEquipmentNeedScore(analysisData: AnalysisData) {
  const equipment = analysisData.equipment
  const roi = analysisData.roi_result
  const benchmarkCycle = roi?.benchmark?.avg_replacement_cycle_yr ?? 10
  const avgDefectRate = roi?.benchmark?.avg_defect_rate_pct ?? 2

  const age = equipment?.age_years ?? 0
  const defectRate = equipment?.defect_rate ?? 0

  let score = 45

  if (age >= benchmarkCycle) score += 25
  else if (age >= benchmarkCycle * 0.7) score += 15

  if (defectRate >= avgDefectRate * 2) score += 25
  else if (defectRate > avgDefectRate) score += 15

  if (roi?.equipment_status?.is_overdue) score += 5

  return clampScore(score)
}

export function buildReadinessItems(
  analysisData: AnalysisData,
  policyCards: SupportProject[],
): ReadinessItem[] {
  const hasRoi = Boolean(analysisData.roi_result)
  const hasPolicies = policyCards.length > 0
  const hasDraft = Boolean(analysisData.draft_result)
  const requiredDocs = analysisData.draft_result?.required_documents ?? []

  const equipmentNeedScore = getEquipmentNeedScore(analysisData)
  const documentScore = requiredDocs.length > 0 ? 58 : 35
  const draftScore = hasDraft
    ? clampScore(analysisData.draft_result?.readiness_score ?? 65)
    : 30

  return [
    {
      label: "ROI 분석 결과",
      status: hasRoi ? "완료" : "확인 필요",
      score: hasRoi ? 100 : 0,
      tone: hasRoi ? "green" : "red",
      description: hasRoi
        ? "투자금, 예상 지원금, 실부담금, 회수기간 계산이 완료되었습니다."
        : "ROI 분석 결과가 아직 없습니다.",
    },
    {
      label: "설비 교체 필요성",
      status: equipmentNeedScore >= 70 ? "완료" : "확인 필요",
      score: equipmentNeedScore,
      tone: equipmentNeedScore >= 70 ? "green" : "orange",
      description:
        "설비 노후도, 불량률, 업종 벤치마크를 기준으로 교체 필요성을 계산했습니다.",
    },
    {
      label: "지원사업 적합도",
      status: hasPolicies ? "완료" : "확인 필요",
      score: hasPolicies ? Math.max(...policyCards.map((card) => card.fitScore)) : 0,
      tone: hasPolicies ? "green" : "orange",
      description: hasPolicies
        ? "현재 조건에 맞는 지원사업 추천 결과가 반영되었습니다."
        : "현재 조건에 맞는 지원사업 결과가 없어 추가 검토가 필요합니다.",
    },
    {
      label: "견적서 및 증빙자료",
      status: "확인 필요",
      score: documentScore,
      tone: "orange",
      description:
        requiredDocs.length > 0
          ? `${requiredDocs.join(", ")} 제출 전 확인이 필요합니다.`
          : "견적서, 사업자등록증, 설비 사진 등 증빙자료 확인이 필요합니다.",
    },
    {
      label: "사업계획서 문장",
      status: hasDraft ? "완료" : "확인 필요",
      score: draftScore,
      tone: hasDraft ? "green" : "red",
      description: hasDraft
        ? "AI 신청서 초안 문장이 생성되었습니다."
        : "신청서 초안 문장 생성이 필요합니다.",
    },
  ]
}

export function getRequiredDocuments(analysisData: AnalysisData) {
  const docs = analysisData.draft_result?.required_documents?.filter(Boolean)

  if (docs && docs.length > 0) return docs

  return ["사업자등록증", "설비 견적서", "현 설비 사진"]
}

export function buildPolicyCounters(
  projects: SupportProject[],
  apiCounters?: Partial<PolicyCounters>,
): PolicyCounters {
  const rankedCount = Math.min(projects.length, 5)
  const otherCount = Math.max(projects.length - rankedCount, 0)

  return {
    totalPolicyCount: apiCounters?.totalPolicyCount ?? projects.length,
    industryMatchedCount: apiCounters?.industryMatchedCount ?? projects.length,
    aiRecommendedCount: apiCounters?.aiRecommendedCount ?? rankedCount,
    priorityCount: apiCounters?.priorityCount ?? (rankedCount > 0 ? 1 : 0),
    otherMatchedCount: apiCounters?.otherMatchedCount ?? otherCount,
  }
}

export function getDotCount(score: number) {
  if (score >= 85) return 5
  if (score >= 75) return 4
  if (score >= 65) return 3
  if (score >= 55) return 2
  return 1
}

export function getDotFillRatio(score: number, dotIndex: number) {
  const safeScore = clampScore(score)
  const safeIndex = Math.min(4, Math.max(0, dotIndex))
  const filledThirds = Math.round((safeScore / 100) * 15)
  const dotStartStep = safeIndex * 3
  const dotFilledSteps = Math.min(3, Math.max(0, filledThirds - dotStartStep))

  return dotFilledSteps / 3
}

export function getPolicyReasonSummary(project: SupportProject, equipmentName: string) {
  const firstReason = project.reasonText || project.reasons[0]

  return [
    firstReason || `${equipmentName} 기준 업종·지역·설비 정보와 정책 조건을 바탕으로 추천되었습니다.`,
  ]
}
