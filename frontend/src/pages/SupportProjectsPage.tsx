import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

type SupportProject = {
  id: number
  title: string
  agency: string
  deadline: string
  amount: string
  amountValueManwon: number | null
  fitScore: number
  category: string
  description: string
  tags: string[]
  tone: "green" | "blue" | "orange" | "red"
}

type ReadinessItem = {
  label: string
  status: string
  score: number
  tone: "green" | "orange" | "red"
  description: string
}

type PolicyState = "loading" | "error" | "empty" | "success"

type PolicyApiItem = {
  id?: string | number
  policy_id?: string | number
  title?: string
  content?: string
  reason?: string
  llm_score?: string
  match_score?: number | string
  metadata?: {
    title?: string
    organization?: string
    deadline?: string | null
    deadline_display?: string | null
    max_amount?: number | string | null
    policy_category?: string
    service_category?: string
    urgency_label?: string
  }
}

type PolicyApiResponse = {
  success?: boolean
  data?: {
    policies?: PolicyApiItem[]
    total?: number
    source?: string
    message?: string
  }
  message?: string
  error?: string
}

type DraftResult = {
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

type CompanyInfo = {
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

type EquipmentInfo = {
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

type RoiScenario = {
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

type RoiResult = {
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

type AnalysisData = {
  company?: CompanyInfo | null
  equipment?: EquipmentInfo | null
  equipment_id?: string | null
  roi_result?: RoiResult | null
  matched_policies?: any[]
  draft_result?: DraftResult | null
  response?: string
}

type EquipmentContext = {
  equipmentName: string
  industryName: string
  equipmentAge: number | null
  defectRate: number | null
  roiPaybackMonths: number | null
  investmentManwon: number | null
  subsidyManwon: number | null
  recommendedScenario: string
}

const API_BASE = "http://127.0.0.1:8000"
const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const AUTH_TOKEN_STORAGE_KEY = "factofit_access_token"
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"

const policyCardsMemoryCache = new Map<string, SupportProject[]>()
const policyCardsInFlightCache = new Map<string, Promise<SupportProject[]>>()

function getStoredCompanyId() {
  return window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || ""
}

function getStoredAccessToken() {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || ""
}

function parseResponseDraft(response?: string): DraftResult | null {
  if (!response) return null

  try {
    const parsed = JSON.parse(response)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function readAnalysisData(): AnalysisData {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    const data = parsed?.data ?? {}
    const responseDraft = parseResponseDraft(data?.response)

    return {
      ...data,
      draft_result: data?.draft_result ?? responseDraft ?? null,
    }
  } catch {
    return {}
  }
}

function getAnalysisFingerprint(analysisData: AnalysisData) {
  return [
    analysisData.company?.updated_at,
    analysisData.equipment?.equipment_id,
    analysisData.equipment?.created_at,
    analysisData.draft_result?.readiness_score,
  ]
    .filter(Boolean)
    .join(":")
}

function toNumberOrNull(value?: number | string | null) {
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

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function formatSupportAmount(value?: number | string | null) {
  const amount = toNumberOrNull(value)

  if (amount === null) return "정보 없음"

  if (amount >= 10000) {
    return `최대 ${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 1)}억원`
  }

  return `최대 ${amount.toLocaleString()}만원`
}

function formatManwon(value?: number | null) {
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

function normalizeDeadline(value?: string | null) {
  if (!value || value === "None" || value === "마감일 미정") return "마감일 미정"
  return value.slice(0, 10).replace(/-/g, ".")
}

function getProjectTone(score: number): SupportProject["tone"] {
  if (score >= 85) return "green"
  if (score >= 75) return "blue"
  if (score >= 65) return "orange"
  return "red"
}

function scoreToPercent(score?: string, matchScore?: number | string) {
  const numericMatchScore = toNumberOrNull(matchScore)

  if (numericMatchScore !== null) {
    if (numericMatchScore <= 1) return clampScore(numericMatchScore * 100)
    return clampScore(numericMatchScore)
  }

  if (!score) return 70

  const filled = (score.match(/●/g) ?? []).length
  return clampScore(filled * 20)
}

function mapPolicyToProject(policy: PolicyApiItem, index: number): SupportProject {
  const metadata = policy.metadata ?? {}
  const fitScore = scoreToPercent(policy.llm_score, policy.match_score)
  const amountValueManwon = toNumberOrNull(metadata.max_amount)

  return {
    id: Number(policy.id ?? policy.policy_id) || index + 1,
    title: policy.title || metadata.title || `추천 지원사업 ${index + 1}`,
    agency: metadata.organization || "주관기관 정보 없음",
    deadline: normalizeDeadline(metadata.deadline_display || metadata.deadline),
    amount: formatSupportAmount(metadata.max_amount),
    amountValueManwon,
    fitScore,
    category: metadata.service_category || metadata.policy_category || "지원사업",
    description:
      policy.reason ||
      policy.content ||
      "기업 조건과 설비 정보를 기준으로 추천된 지원사업입니다.",
    tags: [
      metadata.urgency_label,
      metadata.service_category || metadata.policy_category,
      metadata.organization,
    ].filter(Boolean) as string[],
    tone: getProjectTone(fitScore),
  }
}

async function fetchPolicyCards(
  companyId: string,
  analysisFingerprint: string,
): Promise<SupportProject[]> {
  const cacheKey = `policies:${companyId}:${analysisFingerprint || "latest"}:10`

  const cached = policyCardsMemoryCache.get(cacheKey)
  if (cached) return cached

  const inFlight = policyCardsInFlightCache.get(cacheKey)
  if (inFlight) return inFlight

  const token = getStoredAccessToken()

  const requestPromise = fetch(
    `${API_BASE}/api/policies?company_id=${encodeURIComponent(companyId)}&limit=10`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  )
    .then(async (response) => {
      const json = (await response.json().catch(() => ({}))) as PolicyApiResponse

      if (!response.ok) {
        if (response.status === 504) {
          console.warn("정책 추천 timeout fallback:", json)
          return []
        }

        throw new Error(
          json?.message ||
            json?.error ||
            `Policy API failed: ${response.status}`,
        )
      }

      const policies = Array.isArray(json?.data?.policies)
        ? json.data.policies
        : []

      console.log("지원사업 API 응답:", {
        source: json?.data?.source,
        total: json?.data?.total,
        count: policies.length,
        message: json?.data?.message,
      })

      return policies.map((policy: PolicyApiItem, index: number) =>
        mapPolicyToProject(policy, index),
      )
    })
    .then((cards) => {
      policyCardsMemoryCache.set(cacheKey, cards)
      return cards
    })
    .finally(() => {
      policyCardsInFlightCache.delete(cacheKey)
    })

  policyCardsInFlightCache.set(cacheKey, requestPromise)

  return requestPromise
}

function getSelectedScenario(roiResult?: RoiResult | null): RoiScenario | undefined {
  if (!roiResult) return undefined

  if (roiResult.recommended === "B") {
    return roiResult.scenario_b ?? roiResult.scenario_a
  }

  return roiResult.scenario_a ?? roiResult.scenario_b
}

function getIndustryText(company?: CompanyInfo | null) {
  if (!company) return "업종 정보 없음"

  if (company.industry_name) return company.industry_name

  if (Array.isArray(company.industry_code)) {
    return company.industry_code.join(", ")
  }

  return company.industry_code || "업종 정보 없음"
}

function getEquipmentContext(analysisData: AnalysisData): EquipmentContext {
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

function getFitLabel(score: number) {
  if (score >= 85) return "매우 적합"
  if (score >= 75) return "적합"
  if (score >= 65) return "검토 가능"
  return "낮음"
}

function getFitClass(score: number) {
  if (score >= 85) return "ok"
  if (score >= 70) return "mid"
  return "no"
}

function getToneColor(tone: ReadinessItem["tone"]) {
  if (tone === "green") return "#0B7A53"
  if (tone === "orange") return "#E65F00"
  return "#CD2E3A"
}

function getProjectScoreColor(score: number) {
  if (score >= 85) return "#0B7A53"
  if (score >= 70) return "#E65F00"
  return "#CD2E3A"
}

function formatDeadline(deadline: string) {
  if (deadline === "마감일 미정") return "-"
  return deadline.slice(5).replace(".", "/")
}

function getBestScore(projects: SupportProject[]) {
  if (projects.length === 0) return "-"
  return `${Math.max(...projects.map((project) => project.fitScore))}%`
}

function getMaxSupportAmount(projects: SupportProject[]) {
  const amounts = projects
    .map((project) => project.amountValueManwon)
    .filter((amount): amount is number => typeof amount === "number")

  if (amounts.length === 0) return "-"

  return formatSupportAmount(Math.max(...amounts))
}

function getPriorityCount(projects: SupportProject[]) {
  return projects.filter((project) => project.fitScore >= 85).length
}

function getReadinessScore(analysisData: AnalysisData, policyCards: SupportProject[]) {
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

function getReadinessComment(
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

function buildReadinessItems(
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

function getRequiredDocuments(analysisData: AnalysisData) {
  const docs = analysisData.draft_result?.required_documents?.filter(Boolean)

  if (docs && docs.length > 0) {
    return docs
  }

  return ["사업자등록증", "설비 견적서", "현 설비 사진"]
}

function EmptyPolicyState({
  onBackToRoi,
  equipmentName,
}: {
  onBackToRoi: () => void
  equipmentName: string
}) {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #FDBA74",
        background: "#FFF7ED",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge orange">추천 결과 없음</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#061B34",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        현재 조건에 맞는 지원사업이 없습니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#667085",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
          maxWidth: "760px",
        }}
      >
        {equipmentName} 기준 정책 추천 결과가 비어 있습니다. ROI 분석 결과,
        설비명, 업종, 투자 목적, 예상 지원금 정보를 보완하면 추천 정확도를
        높일 수 있습니다.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button className="btn blue" type="button" onClick={onBackToRoi}>
          ROI 입력값 보완하기
        </button>

        <button
          className="btn dark"
          type="button"
          onClick={() =>
            window.alert("지원사업 결과가 없어도 화면이 정상 표시됩니다.")
          }
        >
          빈 상태 테스트 확인
        </button>
      </div>
    </div>
  )
}

function LoadingPolicyState() {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #BFDBFE",
        background: "#EFF6FF",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge blue">LOADING</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#061B34",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        지원사업 추천 결과를 불러오는 중입니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#667085",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
        }}
      >
        ROI 분석 결과와 설비 정보를 기준으로 신청 가능성이 높은 지원사업을
        정리하고 있습니다.
      </p>
    </div>
  )
}

function ErrorPolicyState({ onBackToRoi }: { onBackToRoi: () => void }) {
  return (
    <div
      style={{
        marginTop: "28px",
        marginBottom: "28px",
        padding: "44px",
        borderRadius: "30px",
        border: "1px solid #FCA5A5",
        background: "#FEF2F2",
        boxShadow: "0 18px 44px rgba(6,27,52,.06)",
      }}
    >
      <span className="badge red">ERROR</span>

      <h3
        style={{
          marginTop: "18px",
          color: "#991B1B",
          fontSize: "30px",
          lineHeight: 1.35,
          fontWeight: 900,
          letterSpacing: "-0.7px",
        }}
      >
        지원사업 추천 결과를 불러오지 못했습니다.
      </h3>

      <p
        style={{
          marginTop: "14px",
          color: "#7F1D1D",
          fontSize: "15px",
          lineHeight: 1.8,
          fontWeight: 800,
          maxWidth: "760px",
        }}
      >
        정책 추천 API 오류가 발생해도 화면은 깨지지 않습니다. 잠시 후 다시
        시도하거나 ROI 입력값을 확인해주세요.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button className="btn blue" type="button" onClick={onBackToRoi}>
          ROI 분석으로 돌아가기
        </button>
      </div>
    </div>
  )
}

export default function SupportProjectsPage() {
  const navigate = useNavigate()
  const hasStartedFetchRef = useRef(false)

  const [policyState, setPolicyState] = useState<PolicyState>("loading")
  const [policyCards, setPolicyCards] = useState<SupportProject[]>([])

  const analysisData = useMemo(() => readAnalysisData(), [])
  const analysisFingerprint = useMemo(
    () => getAnalysisFingerprint(analysisData),
    [analysisData],
  )
  const selectedEquipmentContext = useMemo(
    () => getEquipmentContext(analysisData),
    [analysisData],
  )

  useEffect(() => {
    if (hasStartedFetchRef.current) return
    hasStartedFetchRef.current = true

    const companyId =
      analysisData.company?.company_id ||
      analysisData.equipment?.company_id ||
      getStoredCompanyId()

    if (!companyId) {
      setPolicyCards([])
      setPolicyState("empty")
      return
    }

    let ignore = false

    async function loadPolicies() {
      try {
        setPolicyState("loading")
        const cards = await fetchPolicyCards(companyId, analysisFingerprint)

        if (ignore) return

        setPolicyCards(cards)
        setPolicyState(cards.length > 0 ? "success" : "empty")
      } catch (error) {
        console.error("정책 추천 API 호출 실패:", error)

        if (!ignore) {
          setPolicyCards([])
          setPolicyState("error")
        }
      }
    }

    loadPolicies()

    return () => {
      ignore = true
    }
  }, [analysisData, analysisFingerprint])

  const topProject = policyCards[0]
  const hasPolicyCards = policyCards.length > 0

  const bestScore = getBestScore(policyCards)
  const maxSupportAmount = getMaxSupportAmount(policyCards)
  const priorityCount = getPriorityCount(policyCards)

  const readinessScore = getReadinessScore(analysisData, policyCards)
  const readinessItems = buildReadinessItems(analysisData, policyCards)
  const readinessComment = getReadinessComment(analysisData, policyCards)
  const requiredDocuments = getRequiredDocuments(analysisData)

  return (
    <main className="page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              marginBottom: "28px",
              height: "44px",
              padding: "0 18px",
              borderRadius: "999px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#061B34",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(6,27,52,.06)",
            }}
          >
            ← 대시보드로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT SUPPORT PROJECTS</div>
              <div className="label">POLICY MATCHING</div>
              <h2>
                설비투자 조건에 맞는 <br />
                지원사업을 추천합니다.
              </h2>
            </div>

            <p className="section-desc">
              선택된 {selectedEquipmentContext.equipmentName}, ROI 분석 결과,
              설비 유형, 투자 목적, 예상 지원금 규모를 바탕으로 신청 가능성이
              높은 지원사업을 우선순위로 정리합니다.
            </p>
          </div>

          <div className="policy-summary">
            <div className="mini-stat">
              <span>추천 지원사업</span>
              <b>{policyCards.length}</b>
            </div>

            <div className="mini-stat">
              <span>최고 적합도</span>
              <b>{bestScore}</b>
            </div>

            <div className="mini-stat">
              <span>예상 최대 지원금</span>
              <b>{maxSupportAmount}</b>
            </div>

            <div className="mini-stat">
              <span>우선 신청</span>
              <b>{priorityCount}</b>
            </div>
          </div>

          {policyState === "loading" && <LoadingPolicyState />}

          {policyState === "error" && (
            <ErrorPolicyState onBackToRoi={() => navigate("/roi")} />
          )}

          {policyState === "empty" && (
            <EmptyPolicyState
              equipmentName={selectedEquipmentContext.equipmentName}
              onBackToRoi={() => navigate("/roi")}
            />
          )}

          {policyState === "success" && hasPolicyCards && topProject && (
            <>
              <div
                className="summary-hero-card"
                style={{
                  marginTop: "28px",
                  marginBottom: "28px",
                  borderLeftColor: "#0B7A53",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.05fr 0.95fr",
                    gap: "28px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span className="badge green">추천 완료</span>

                    <h3 style={{ marginTop: "18px" }}>
                      1순위 추천은 <br />
                      {topProject.title}입니다.
                    </h3>

                    <p>
                      {selectedEquipmentContext.equipmentName} 설비 투자 조건과
                      ROI 분석 결과를 기준으로 우선 검토할 수 있는 지원사업입니다.
                      신청서 작성 시 투자금, 기대효과, 회수기간을 함께 제시하면
                      근거를 더 명확히 구성할 수 있습니다.
                    </p>

                    <div
                      className="hero-actions"
                      style={{
                        justifyContent: "flex-start",
                        marginTop: "28px",
                      }}
                    >
                      <button
                        className="btn blue"
                        type="button"
                        onClick={() => navigate("/support-detail")}
                      >
                        1순위 사업 상세 보기
                      </button>

                      <button
                        className="btn dark"
                        type="button"
                        onClick={() => navigate("/application-draft")}
                      >
                        신청서 초안 만들기
                      </button>
                    </div>
                  </div>

                  <div className="ai-ground-card" style={{ marginTop: 0 }}>
                    <h4>AI 추천 근거</h4>

                    <ul>
                      <li>{topProject.description}</li>
                      <li>
                        추천 적합도는 {topProject.fitScore}%이며, 현재 설비투자
                        조건과의 유사도를 기준으로 산정되었습니다.
                      </li>
                      <li>
                        투자금 {formatManwon(selectedEquipmentContext.investmentManwon)}
                        , 예상 지원금{" "}
                        {formatManwon(selectedEquipmentContext.subsidyManwon)}을
                        신청서 근거로 활용할 수 있습니다.
                      </li>
                      <li>
                        회수기간은{" "}
                        {selectedEquipmentContext.roiPaybackMonths
                          ? `약 ${selectedEquipmentContext.roiPaybackMonths.toFixed(1)}개월`
                          : "추가 확인 필요"}
                        입니다.
                      </li>
                    </ul>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "34px",
                    paddingTop: "28px",
                    borderTop: "1px solid #E2E8F0",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "0.95fr 1.05fr",
                      gap: "24px",
                      alignItems: "stretch",
                    }}
                  >
                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "28px",
                        padding: "28px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              color: "#061B34",
                              fontSize: "22px",
                              fontWeight: 900,
                              letterSpacing: "-0.4px",
                              marginBottom: "8px",
                            }}
                          >
                            추천 적합도
                          </h4>

                          <p
                            style={{
                              color: "#667085",
                              fontSize: "14px",
                              lineHeight: 1.7,
                              fontWeight: 800,
                            }}
                          >
                            1순위 사업이 현재 설비투자 조건과 얼마나 맞는지 종합
                            점수로 보여줍니다.
                          </p>
                        </div>

                        <span className="badge green">
                          {getFitLabel(topProject.fitScore)}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "210px 1fr",
                          gap: "28px",
                          alignItems: "center",
                          marginTop: "28px",
                        }}
                      >
                        <div
                          style={{
                            width: "190px",
                            height: "190px",
                            borderRadius: "50%",
                            background: `conic-gradient(#344BA0 0deg ${
                              topProject.fitScore * 3.6
                            }deg, #E8EEF5 ${
                              topProject.fitScore * 3.6
                            }deg 360deg)`,
                            display: "grid",
                            placeItems: "center",
                            boxShadow: "0 18px 38px rgba(52,75,160,.12)",
                          }}
                        >
                          <div
                            style={{
                              width: "142px",
                              height: "142px",
                              borderRadius: "50%",
                              background: "#FFFFFF",
                              display: "grid",
                              placeItems: "center",
                              border: "1px solid #E2E8F0",
                            }}
                          >
                            <div style={{ textAlign: "center" }}>
                              <b
                                style={{
                                  display: "block",
                                  color: "#344BA0",
                                  fontFamily: "DM Mono, monospace",
                                  fontSize: "56px",
                                  lineHeight: 1,
                                  fontWeight: 500,
                                  letterSpacing: "-3px",
                                }}
                              >
                                {topProject.fitScore}
                              </b>

                              <span
                                style={{
                                  display: "block",
                                  color: "#667085",
                                  fontSize: "18px",
                                  fontWeight: 900,
                                  marginTop: "4px",
                                }}
                              >
                                /100
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4
                            style={{
                              color: "#061B34",
                              fontSize: "22px",
                              lineHeight: 1.35,
                              fontWeight: 900,
                              letterSpacing: "-0.4px",
                              marginBottom: "14px",
                            }}
                          >
                            {topProject.title}
                          </h4>

                          <p
                            style={{
                              color: "#667085",
                              fontSize: "14px",
                              lineHeight: 1.8,
                              fontWeight: 800,
                            }}
                          >
                            {topProject.description}
                          </p>

                          <div
                            style={{
                              marginTop: "22px",
                              height: "12px",
                              background: "#E8EEF5",
                              borderRadius: "999px",
                              overflow: "hidden",
                            }}
                          >
                            <i
                              style={{
                                display: "block",
                                width: `${topProject.fitScore}%`,
                                height: "100%",
                                background:
                                  "linear-gradient(90deg, #0B7A53, #A8DDB5)",
                                borderRadius: "999px",
                              }}
                            />
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: "10px",
                              color: "#667085",
                              fontSize: "12px",
                              fontWeight: 900,
                            }}
                          >
                            <span>낮음</span>
                            <span>보통</span>
                            <span>매우 적합</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "28px",
                        padding: "28px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "16px",
                          alignItems: "center",
                          marginBottom: "18px",
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              color: "#061B34",
                              fontSize: "22px",
                              fontWeight: 900,
                              letterSpacing: "-0.4px",
                              marginBottom: "8px",
                            }}
                          >
                            추천 지원사업 한눈에 보기
                          </h4>

                          <p
                            style={{
                              color: "#667085",
                              fontSize: "14px",
                              lineHeight: 1.7,
                              fontWeight: 800,
                            }}
                          >
                            적합도 점수는 추천 목록의 우선순위를 뒷받침하는 핵심
                            지표입니다.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate("/support-detail")}
                          style={{
                            height: "42px",
                            padding: "0 16px",
                            borderRadius: "999px",
                            border: "1px solid #E2E8F0",
                            background: "#F8FAFC",
                            color: "#061B34",
                            fontSize: "13px",
                            fontWeight: 900,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          1순위 상세 보기
                        </button>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: "12px",
                        }}
                      >
                        {policyCards.map((project) => (
                          <article
                            key={project.id}
                            onClick={() => navigate("/support-detail")}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "82px 1fr 72px",
                              gap: "16px",
                              alignItems: "center",
                              padding: "14px 16px",
                              borderRadius: "22px",
                              border: "1px solid #E2E8F0",
                              borderTop: "4px solid #344BA0",
                              background: "#FFFFFF",
                              boxShadow: "0 8px 18px rgba(0,0,0,0.035)",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                height: "54px",
                                borderRadius: "17px",
                                background: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                display: "grid",
                                placeItems: "center",
                                color: "#475569",
                                fontFamily: "DM Mono, monospace",
                                fontSize: "16px",
                                fontWeight: 500,
                              }}
                            >
                              {formatDeadline(project.deadline)}
                            </div>

                            <div>
                              <strong
                                style={{
                                  display: "block",
                                  color: "#061B34",
                                  fontSize: "16px",
                                  fontWeight: 900,
                                  letterSpacing: "-0.3px",
                                  marginBottom: "5px",
                                }}
                              >
                                {project.title}
                              </strong>

                              <p
                                style={{
                                  color: "#667085",
                                  fontSize: "12px",
                                  fontWeight: 900,
                                }}
                              >
                                {project.agency} · {project.amount}
                              </p>
                            </div>

                            <b
                              style={{
                                color: getProjectScoreColor(project.fitScore),
                                fontFamily: "DM Mono, monospace",
                                fontSize: "22px",
                                fontWeight: 500,
                                textAlign: "right",
                              }}
                            >
                              {project.fitScore}%
                            </b>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="details-wrap">
                <details>
                  <summary>
                    <span>지원사업 추천 목록</span>
                    <span
                      style={{
                        marginLeft: "auto",
                        marginRight: "10px",
                        height: "44px",
                        padding: "0 16px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "999px",
                        background: "#EEF6FF",
                        color: "#0047A0",
                        fontSize: "15px",
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      더보기
                    </span>
                  </summary>

                  <div className="detail-body">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "20px",
                      }}
                    >
                      {policyCards.map((project) => (
                        <article
                          className={`scenario ${
                            project.fitScore >= 85 ? "best" : ""
                          }`}
                          key={project.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: "430px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "14px",
                                alignItems: "flex-start",
                                marginBottom: "14px",
                              }}
                            >
                              <div>
                                <span className={`badge ${project.tone}`}>
                                  {project.category}
                                </span>

                                <h4 style={{ marginTop: "14px" }}>
                                  {project.title}
                                </h4>
                              </div>

                              <span
                                className={`fit-label ${getFitClass(
                                  project.fitScore,
                                )}`}
                                data-score={`${getFitLabel(project.fitScore)}`}
                              >
                                {project.fitScore}%
                              </span>
                            </div>

                            <p>{project.description}</p>

                            <div className="kv-grid">
                              <div className="kv">
                                <span>주관기관</span>
                                <b
                                  style={{
                                    fontSize: "17px",
                                    fontFamily: "Noto Sans KR, sans-serif",
                                    fontWeight: 900,
                                  }}
                                >
                                  {project.agency}
                                </b>
                              </div>

                              <div className="kv">
                                <span>마감일</span>
                                <b
                                  style={{
                                    fontSize: "17px",
                                  }}
                                >
                                  {project.deadline}
                                </b>
                              </div>

                              <div className="kv wide">
                                <span>예상 지원규모</span>
                                <b>{project.amount}</b>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                marginTop: "18px",
                              }}
                            >
                              {project.tags.map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: "999px",
                                    padding: "7px 10px",
                                    background: "#F8FAFC",
                                    border: "1px solid #E2E8F0",
                                    color: "#475569",
                                    fontSize: "12px",
                                    fontWeight: 900,
                                  }}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div
                            className="hero-actions"
                            style={{
                              justifyContent: "flex-start",
                              marginTop: "22px",
                            }}
                          >
                            <button
                              className="btn blue"
                              type="button"
                              onClick={() => navigate("/support-detail")}
                            >
                              상세 보기
                            </button>

                            <button
                              className="btn dark"
                              type="button"
                              onClick={() => navigate("/application-draft")}
                            >
                              신청서 초안
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            </>
          )}

          <div className="details-wrap">
            <details open>
              <summary>지원사업 신청 준비도</summary>

              <div className="detail-body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "0.8fr 1.2fr",
                    gap: "24px",
                    alignItems: "stretch",
                  }}
                >
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "28px",
                      padding: "30px",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                    }}
                  >
                    <span className="badge green">
                      {readinessScore >= 60 ? "신청 가능" : "보완 필요"}
                    </span>

                    <h3
                      style={{
                        marginTop: "18px",
                        color: "#061B34",
                        fontSize: "26px",
                        lineHeight: 1.35,
                        fontWeight: 900,
                        letterSpacing: "-0.5px",
                      }}
                    >
                      현재 신청 준비도는 <br />
                      {readinessScore}%입니다.
                    </h3>

                    <p
                      style={{
                        marginTop: "14px",
                        color: "#667085",
                        fontSize: "14px",
                        lineHeight: 1.8,
                        fontWeight: 800,
                      }}
                    >
                      {readinessComment}
                    </p>

                    <div
                      style={{
                        marginTop: "28px",
                        height: "14px",
                        background: "#E8EEF5",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <i
                        style={{
                          display: "block",
                          width: `${readinessScore}%`,
                          height: "100%",
                          background: "#0B7A53",
                          borderRadius: "999px",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "10px",
                        color: "#667085",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "14px",
                    }}
                  >
                    {readinessItems.map((item) => (
                      <div
                        key={item.label}
                        title={item.description}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "170px 1fr 70px",
                          gap: "16px",
                          alignItems: "center",
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: "22px",
                          padding: "18px",
                          borderLeft: `6px solid ${getToneColor(item.tone)}`,
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: "block",
                              color: "#061B34",
                              fontSize: "15px",
                              fontWeight: 900,
                              marginBottom: "6px",
                            }}
                          >
                            {item.label}
                          </strong>

                          <span
                            style={{
                              color: getToneColor(item.tone),
                              fontSize: "12px",
                              fontWeight: 900,
                            }}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div
                          style={{
                            height: "12px",
                            background: "#E8EEF5",
                            borderRadius: "999px",
                            overflow: "hidden",
                          }}
                        >
                          <i
                            style={{
                              display: "block",
                              height: "100%",
                              width: `${item.score}%`,
                              background: getToneColor(item.tone),
                              borderRadius: "999px",
                            }}
                          />
                        </div>

                        <b
                          style={{
                            color: getToneColor(item.tone),
                            fontFamily: "DM Mono, monospace",
                            fontSize: "22px",
                            fontWeight: 500,
                            textAlign: "right",
                          }}
                        >
                          {item.score}%
                        </b>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            <details>
              <summary>신청 전 확인할 공통 서류</summary>

              <div className="detail-body">
                <div className="check-grid">
                  {requiredDocuments.map((documentName, index) => {
                    const toneClass =
                      index === 0 ? "" : index === 1 ? "orange" : "red"

                    return (
                      <div
                        className={`check-card ${toneClass}`}
                        key={`${documentName}-${index}`}
                      >
                        <h4>{documentName}</h4>
                        <p>
                          제출 전 최신 상태로 준비하고, 신청사업 요구 양식에
                          맞는지 확인해주세요.
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}