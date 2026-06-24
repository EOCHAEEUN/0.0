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
  totalPolicyCount: 291,
  industryMatchedCount: 30,
  aiRecommendedCount: 5,
  priorityCount: 1,
  otherMatchedCount: 25,
}


export const DEMO_POLICY_COUNTERS: PolicyCounters = {
  totalPolicyCount: 291,
  industryMatchedCount: 30,
  aiRecommendedCount: 5,
  priorityCount: 1,
  otherMatchedCount: 33,
}

function makeDemoProject({
  id,
  title,
  agency,
  deadlineRaw,
  postedDate,
  amountValueManwon,
  fitScore,
  scenario,
  policyCategory,
  supportContent,
  reasons,
  sourceUrl = "",
}: {
  id: number
  title: string
  agency: string
  deadlineRaw: string
  postedDate: string
  amountValueManwon: number | null
  fitScore: number
  scenario: ScenarioKey
  policyCategory: string
  supportContent: string
  reasons: string[]
  sourceUrl?: string
}): SupportProject {
  const reasonText = reasons[0] || "RAG 유사도 기반 매칭"

  return {
    id,
    rawId: `demo-${id}`,
    title,
    agency,
    deadline: normalizeDeadline(deadlineRaw),
    deadlineRaw,
    postedDate: normalizeDate(postedDate) || "공고 등록일 미확인",
    amount: formatSupportAmount(amountValueManwon),
    amountValueManwon,
    fitScore,
    category: policyCategory,
    policyCategory,
    description: reasonText,
    supportContent,
    reasonText,
    reasons,
    tags: [policyCategory, agency],
    tone: getProjectTone(fitScore),
    scenario,
    scenarioLabel: scenario === "B" ? "부분교체" : "전체교체",
    sourceUrl,
  }
}

export function buildDemoSupportProjects(): SupportProject[] {
  const finalRecommended = [
    makeDemoProject({
      id: 1,
      title: "스마트공장 구축 및 고도화 지원사업",
      agency: "중소벤처기업부",
      deadlineRaw: "2026-06-20",
      postedDate: "2026-05-20",
      amountValueManwon: 10000,
      fitScore: 92,
      scenario: "A",
      policyCategory: "스마트공장 / 설비고도화",
      supportContent: `프레스 설비 교체와 스마트 모니터링 도입 목적이 명확한 중소·중견기업을 대상으로 스마트공장 구축, 공정 자동화, 데이터 기반 품질관리 시스템 도입을 지원합니다.
- 스마트 모니터링 구축
- 공정 자동화 장비 도입
- 데이터 기반 품질관리
- 시스템 연동 및 현장 컨설팅`,
      reasons: [
        "업종 C24/C25 지원 대상 조건과 일치합니다.",
        "설비 교체와 스마트 모니터링 도입 목적이 사업 방향과 부합합니다.",
        "ROI 분석 결과 투자 회수기간이 짧아 우선 검토 대상으로 판단됩니다.",
        "유사 정책 비교 시 지원 조건 및 효과가 가장 적합합니다.",
      ],
    }),
    makeDemoProject({
      id: 2,
      title: "고효율 설비 교체 지원사업",
      agency: "한국에너지공단",
      deadlineRaw: "2026-06-28",
      postedDate: "2026-05-28",
      amountValueManwon: 8400,
      fitScore: 88,
      scenario: "B",
      policyCategory: "에너지효율 / 설비개선",
      supportContent: `노후 설비의 고효율 부품 교체와 에너지 절감 개선을 추진하는 기업을 대상으로 설비 교체 비용과 에너지 진단을 지원합니다.
- 고효율 부품 교체
- 에너지 사용량 절감
- 설비 진단 및 개선 컨설팅`,
      reasons: [
        "전기요금과 유지보수비 절감 효과가 신청 근거로 활용 가능합니다.",
        "부분교체 시나리오와 지원 목적의 유사도가 높습니다.",
        "에너지 비용 절감 가능성이 정책 조건과 잘 맞습니다.",
      ],
    }),
    makeDemoProject({
      id: 3,
      title: "중소기업 혁신바우처",
      agency: "중소벤처기업진흥공단",
      deadlineRaw: "2026-07-05",
      postedDate: "2026-06-01",
      amountValueManwon: 5000,
      fitScore: 74,
      scenario: "A",
      policyCategory: "기술지원 / 컨설팅",
      supportContent: `제조기업의 공정 개선, 기술 컨설팅, 인증, 마케팅 등 혁신 활동을 바우처 형태로 지원합니다.
- 공정 개선 컨설팅
- 기술지도
- 인증 및 성능평가
- 경영·기술 혁신 지원`,
      reasons: [
        "업종 조건은 부합하지만 설비 직접 지원보다는 컨설팅 성격이 강합니다.",
        "신청서 작성 시 ROI 근거를 보완하면 검토 가능성이 있습니다.",
      ],
    }),
    makeDemoProject({
      id: 4,
      title: "제조 안전환경 개선 지원사업",
      agency: "지자체/산업안전기관",
      deadlineRaw: "2026-07-12",
      postedDate: "2026-06-03",
      amountValueManwon: 3000,
      fitScore: 69,
      scenario: "A",
      policyCategory: "안전환경 / 설비개선",
      supportContent: `노후 설비의 안전 위험 개선과 작업환경 개선을 위한 안전장치, 방호설비, 환경 개선 비용을 일부 지원합니다.
- 안전장치 보강
- 작업환경 개선
- 노후 위험설비 개선`,
      reasons: [
        "설비 노후도 측면에서는 관련성이 있으나 ROI 투자 목적과는 일부 차이가 있습니다.",
        "안전 리스크 근거를 보완하면 후보 사업으로 검토할 수 있습니다.",
      ],
    }),
    makeDemoProject({
      id: 5,
      title: "스마트 에너지 관리 시스템 보급사업",
      agency: "한국에너지공단",
      deadlineRaw: "2026-07-18",
      postedDate: "2026-06-08",
      amountValueManwon: 2500,
      fitScore: 63,
      scenario: "B",
      policyCategory: "에너지관리 / 모니터링",
      supportContent: `제조 현장의 에너지 사용량을 계측하고 절감하는 시스템 도입을 지원합니다.
- 에너지 계측기 도입
- 모니터링 시스템 구축
- 절감량 분석`,
      reasons: [
        "에너지 절감 목적과 일부 부합하지만 설비 교체 지원 범위는 제한적입니다.",
        "부분교체 또는 모니터링 중심 계획일 때 보조 후보로 적합합니다.",
      ],
    }),
  ]

  const otherSeeds = [
    ["2026년 소재·부품·장비 양산성능평가 지원사업", "국가뿌리산업진흥센터"],
    ["2026년도 서울시 뿌리기업 자동화 지원사업", "서울특별시"],
    ["2026년 뿌리산업 DX 기술지원사업", "산업통상부"],
    ["2026년 2차 첨단제조로봇 실증사업지원", "한국로봇산업진흥원"],
    ["2026년 중소기업 기술혁신 개발사업", "중소벤처기업부"],
    ["2026년 에너지 효율 개선 지원사업", "한국에너지공단"],
    ["2026년 스마트제조혁신 기술보급사업", "중소벤처기업부"],
    ["2026년 지역산업맞춤형 기술개발지원사업", "대한상공회의소"],
    ["2026년 제조데이터 활용 기반구축 사업", "한국산업기술진흥원"],
    ["2026년 뿌리기업 공정혁신 지원사업", "국가뿌리산업진흥센터"],
    ["2026년 탄소중립형 스마트공장 보급사업", "중소벤처기업부"],
    ["2026년 고효율 전동기 교체 지원사업", "한국에너지공단"],
    ["2026년 중소기업 제조공정 자동화 지원사업", "지자체/산업진흥원"],
    ["2026년 산업단지 디지털 전환 지원사업", "한국산업단지공단"],
    ["2026년 품질혁신 기반구축 지원사업", "한국생산기술연구원"],
    ["2026년 중견기업 디지털 혁신 지원사업", "한국산업기술진흥원"],
    ["2026년 공정품질 기술개발사업", "중소벤처기업부"],
    ["2026년 생산설비 안전개선 지원사업", "한국산업안전보건공단"],
    ["2026년 지역특화 제조혁신 지원사업", "지역테크노파크"],
    ["2026년 소재부품 기술자립 지원사업", "산업통상부"],
    ["2026년 제조기업 컨설팅 지원사업", "중소벤처기업진흥공단"],
    ["2026년 공장 에너지 진단 지원사업", "한국에너지공단"],
    ["2026년 중소기업 데이터 기반 공정개선 사업", "중소벤처기업부"],
    ["2026년 로봇활용 제조혁신 지원사업", "한국로봇산업진흥원"],
    ["2026년 스마트센서 보급 지원사업", "한국산업기술평가관리원"],
    ["2026년 산업기계 고도화 기술지원사업", "한국기계산업진흥회"],
    ["2026년 중소기업 시험·인증 지원사업", "한국산업기술시험원"],
    ["2026년 제조현장 안전보건 개선사업", "한국산업안전보건공단"],
    ["2026년 지역기업 성장사다리 지원사업", "중소벤처기업부"],
    ["2026년 제조 AI 솔루션 실증지원사업", "정보통신산업진흥원"],
    ["2026년 에너지 절감형 설비투자 지원사업", "한국에너지공단"],
    ["2026년 뿌리기술 전문기업 지원사업", "국가뿌리산업진흥센터"],
    ["2026년 제조업 디지털전환 바우처", "산업통상부"],
  ]

  const otherProjects = otherSeeds.map(([title, agency], index) => {
    const score = Math.max(52, 61 - Math.floor(index / 3))
    const scenario: ScenarioKey = index % 3 === 1 ? "B" : "A"

    return makeDemoProject({
      id: index + 6,
      title,
      agency,
      deadlineRaw: `2026-${String(7 + Math.floor(index / 12)).padStart(2, "0")}-${String(3 + (index % 24)).padStart(2, "0")}`,
      postedDate: "2026-06-01",
      amountValueManwon: [3000, 4000, 5000, 8000, 10000][index % 5],
      fitScore: score,
      scenario,
      policyCategory: index % 2 === 0 ? "기술지원 / 설비개선" : "공정혁신 / 자동화",
      supportContent: `업종과 설비투자 조건에 일부 부합하는 후보 정책입니다. 최종 5개 추천에는 포함되지 않았지만 세부 조건을 확인해볼 수 있습니다.
- 공정 개선
- 설비 개선
- 기술지도 및 컨설팅`,
      reasons: [
        "RAG 유사도 기반 매칭",
        "업종 또는 설비 조건과 일부 유사성이 있어 후보 정책으로 분류되었습니다.",
      ],
    })
  })

  return [...finalRecommended, ...otherProjects]
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

export function toNumberOrNull(value?: unknown) {
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
  return getFirstText(
    policy.source_url,
    policy.policy_url,
    policy.url,
    policy.notice_url,
    policy.homepage_url,
    metadata.source_url,
    metadata.policy_url,
    metadata.url,
    metadata.notice_url,
    metadata.homepage_url,
  )
}

export function mapPolicyToProject(policy: PolicyApiItem, index: number): SupportProject {
  const metadata = getMetadataRecord(policy)
  const policyRecord = policy as unknown as Record<string, unknown>
  const fitScore = scoreToPercent(policy)
  const amountValueManwon = toNumberOrNull(
    getFieldValue(
      policyRecord,
      "max_amount_manwon",
      "max_amount",
      "support_amount",
      "subsidy_amount",
      "support_limit",
      "limit_amount",
    ) ??
      getFieldValue(
        metadata,
        "max_amount_manwon",
        "max_amount",
        "support_amount",
        "subsidy_amount",
        "support_limit",
        "limit_amount",
      ),
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
    getFieldText(policyRecord, "ministry", "department", "host", "sponsor"),
    getFieldText(metadata, "agency", "organization", "provider", "ministry", "department", "host", "sponsor"),
    "주관사 미확인",
  )
  const rawDeadline = getFirstText(
    policy.deadline,
    policy.deadline_display,
    policy.end_date,
    policy.application_end_date,
    policy.reception_end_date,
    getFieldText(
      metadata,
      "deadline",
      "deadline_display",
      "end_date",
      "application_end_date",
      "reception_end_date",
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
      metadata,
      "posted_date",
      "start_date",
      "created_at",
      "posted_at",
      "registered_at",
      "notice_date",
      "application_start_date",
      "reception_start_date",
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
      metadata,
      "support_content",
      "supportContent",
      "support_summary",
      "summary",
      "content",
      "description",
    ),
    "지원내용 준비 중",
  )
  const reasonText = getFirstText(
    policy.reason,
    getFieldText(metadata, "reason"),
    supportContent,
    "RAG 유사도 기반 매칭",
  )
  const reasons = normalizeReasonList(policy.ai_reasons)
    .concat(normalizeReasonList(policy.reasons))
    .concat(normalizeReasonList(policy.reason))
    .concat(normalizeReasonList(getFieldValue(metadata, "reason")))
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
    totalPolicyCount:
      apiCounters?.totalPolicyCount ?? DEFAULT_POLICY_COUNTERS.totalPolicyCount,
    industryMatchedCount:
      apiCounters?.industryMatchedCount ?? projects.length,
    aiRecommendedCount:
      apiCounters?.aiRecommendedCount ?? rankedCount,
    priorityCount:
      apiCounters?.priorityCount ?? (rankedCount > 0 ? 1 : 0),
    otherMatchedCount:
      apiCounters?.otherMatchedCount ?? otherCount,
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
  const firstReason = project.reasons[0] || project.reasonText || "RAG 유사도 기반 매칭"
  const secondReason = project.reasons[1]

  return [
    firstReason,
    secondReason || `${equipmentName} 투자 목적과 정책 지원 방향의 유사도가 높습니다.`,
    `현재 추천 적합도는 ${project.fitScore}%이며, 최종 추천 5개 중 우선 검토 대상으로 판단됩니다.`,
  ]
}
