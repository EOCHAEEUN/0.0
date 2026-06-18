import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

type SupportProject = {
  id: number
  policyId: string
  title: string
  agency: string
  deadline: string
  amount: string
  supportAmountValue: number
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
  organization?: string
  content?: string
  reason?: string
  llm_score?: string
  match_score?: number
  final_score?: number
  hybrid_score?: number
  scenario_label?: string
  scenario_match?: string[]
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

const DEFAULT_EQUIPMENT_CONTEXT = {
  equipmentName: "프레스 설비",
  industryName: "자동차 부품 제조업",
  equipmentAge: 11,
  defectRate: 5.8,
  roiPaybackMonths: 14,
}

const API_BASE = "http://127.0.0.1:8000"
const COMPANY_ID_STORAGE_KEY = "factofit_company_id"
const MY_PAGE_STORAGE_KEY = "factofit_mypage_profile"
const ANALYSIS_RESULT_STORAGE_KEY = "factofit_analysis_result"
const AUTH_SESSION_STORAGE_KEY = "factofit_auth_session"
const ACCESS_TOKEN_STORAGE_KEY = "factofit_access_token"
const DRAFT_RESULT_STORAGE_KEY = "factofit_draft_result"

function getStoredCompanyId() {
  return window.localStorage.getItem(COMPANY_ID_STORAGE_KEY) || ""
}

function getAccessToken() {
  const directToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  if (directToken) return directToken

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (!raw) return ""
    const parsed = JSON.parse(raw)
    return parsed?.access_token || parsed?.session?.access_token || ""
  } catch {
    return ""
  }
}

function getStoredAnalysisMeta() {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY)
    if (!raw) return { equipmentId: "" }

    const parsed = JSON.parse(raw)
    return {
      equipmentId:
        parsed?.data?.selected_equipment_id ||
        parsed?.selected_equipment_id ||
        parsed?.data?.equipment_id ||
        parsed?.equipment_id ||
        "",
    }
  } catch {
    return { equipmentId: "" }
  }
}

function readSelectedEquipmentContext() {
  try {
    const raw = window.localStorage.getItem(MY_PAGE_STORAGE_KEY)
    if (!raw) return DEFAULT_EQUIPMENT_CONTEXT

    const parsed = JSON.parse(raw)
    const company = parsed.companyInfo ?? parsed.company ?? {}
    const equipments = parsed.equipments ?? parsed.equipmentList ?? []
    const firstEquipment = Array.isArray(equipments) ? equipments[0] : null

    return {
      ...DEFAULT_EQUIPMENT_CONTEXT,
      equipmentName:
        firstEquipment?.name ||
        firstEquipment?.equipmentName ||
        DEFAULT_EQUIPMENT_CONTEXT.equipmentName,
      industryName:
        company.industryName ||
        company.industry_name ||
        DEFAULT_EQUIPMENT_CONTEXT.industryName,
      equipmentAge:
        Number(firstEquipment?.ageYears ?? firstEquipment?.age_years) ||
        DEFAULT_EQUIPMENT_CONTEXT.equipmentAge,
      defectRate:
        Number(firstEquipment?.defectRate ?? firstEquipment?.defect_rate) ||
        DEFAULT_EQUIPMENT_CONTEXT.defectRate,
    }
  } catch {
    return DEFAULT_EQUIPMENT_CONTEXT
  }
}

function scoreToPercent(score?: string) {
  if (!score) return 70
  const filled = (score.match(/●/g) ?? []).length
  return Math.min(100, Math.max(0, filled * 20))
}

function getPolicyFitScore(policy: PolicyApiItem) {
  const numericScore = Number(
    policy.hybrid_score ?? policy.final_score ?? policy.match_score,
  )
  if (Number.isFinite(numericScore) && numericScore > 0) {
    return Math.round(numericScore <= 1 ? numericScore * 100 : numericScore)
  }

  return scoreToPercent(policy.llm_score)
}

function formatSupportAmount(value?: number | string | null) {
  if (value === null || value === undefined || value === "" || value === "None") {
    return "정보 없음"
  }

  const amount = Number(value)
  if (Number.isNaN(amount)) return String(value)
  if (amount >= 10000) {
    return `최대 ${(amount / 10000).toFixed(amount % 10000 === 0 ? 0 : 1)}억원`
  }
  return `최대 ${amount.toLocaleString()}만원`
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

function mapPolicyToProject(policy: PolicyApiItem, index: number): SupportProject {
  const metadata = policy.metadata ?? {}
  const policyId = String(policy.id ?? policy.policy_id ?? "")
  const fitScore = getPolicyFitScore(policy)
  const supportAmountValue = Number(metadata.max_amount) || 0

  return {
    id: Number(policy.id) || index + 1,
    policyId,
    title: metadata.title || `추천 지원사업 ${index + 1}`,
    agency: metadata.organization || "주관기관 정보 없음",
    deadline: normalizeDeadline(metadata.deadline_display || metadata.deadline),
    amount: formatSupportAmount(metadata.max_amount),
    supportAmountValue,
    fitScore,
    category: metadata.service_category || metadata.policy_category || "지원사업",
    description:
      policy.scenario_label ||
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

function readAnalysisPolicies(): PolicyApiItem[] {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    const policies =
      parsed?.data?.matched_policies ??
      parsed?.matched_policies ??
      parsed?.data?.policies ??
      parsed?.policies ??
      []

    return Array.isArray(policies) ? policies : []
  } catch {
    return []
  }
}

async function fetchPolicyCards(companyId: string): Promise<SupportProject[]> {
  const analysisPolicies = readAnalysisPolicies()
  if (analysisPolicies.length > 0) {
    return analysisPolicies.map((policy, index) => mapPolicyToProject(policy, index))
  }

  const response = await fetch(
    `${API_BASE}/api/policies?company_id=${encodeURIComponent(companyId)}&limit=10`,
  )

  if (!response.ok) {
    throw new Error(`Policy API failed: ${response.status}`)
  }

  const json = await response.json()
  const policies = json?.data?.policies ?? []

  return policies.map((policy: PolicyApiItem, index: number) =>
    mapPolicyToProject(policy, index),
  )
}

const readinessItems: ReadinessItem[] = [
  {
    label: "ROI 분석 결과",
    status: "완료",
    score: 100,
    tone: "green",
    description: "투자금, 예상 지원금, 실부담금, 회수기간 계산이 완료되었습니다.",
  },
  {
    label: "설비 교체 필요성",
    status: "완료",
    score: 92,
    tone: "green",
    description: "노후도와 불량률 기준으로 교체 필요성이 충분합니다.",
  },
  {
    label: "견적서 첨부",
    status: "확인 필요",
    score: 58,
    tone: "orange",
    description: "도입 예정 설비의 견적서와 사양서가 필요합니다.",
  },
  {
    label: "사업계획서 문장",
    status: "작성 필요",
    score: 42,
    tone: "red",
    description: "도입 목적과 기대효과를 신청서 문장으로 정리해야 합니다.",
  },
]

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

function getPriorityCount(projects: SupportProject[]) {
  return projects.filter((project) => project.fitScore >= 85).length
}

function getMaxSupportAmount(projects: SupportProject[]) {
  const maxAmount = Math.max(...projects.map((project) => project.supportAmountValue))
  if (!Number.isFinite(maxAmount) || maxAmount <= 0) return "-"
  return formatSupportAmount(maxAmount)
}

function EmptyPolicyState({ onBackToRoi }: { onBackToRoi: () => void }) {
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
        policy_card가 빈 배열로 내려와도 화면이 깨지지 않도록 빈 상태 UI를
        표시합니다. ROI 분석 결과, 설비명, 업종, 투자 목적, 예상 지원금 정보를
        보완하면 추천 정확도를 높일 수 있습니다.
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
            window.alert(
              "테스트 완료: policy_card 빈 배열에서도 화면이 깨지지 않습니다.",
            )
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

  const [policyState, setPolicyState] = useState<PolicyState>("loading")
  const [policyCards, setPolicyCards] = useState<SupportProject[]>([])
  const [draftingPolicyId, setDraftingPolicyId] = useState<string | null>(null)
  const selectedEquipmentContext = useMemo(() => readSelectedEquipmentContext(), [])

  useEffect(() => {
    const companyId = getStoredCompanyId()

    if (!companyId) {
      setPolicyCards([])
      setPolicyState("empty")
      return
    }

    let ignore = false

    async function loadPolicies() {
      try {
        setPolicyState("loading")
        const cards = await fetchPolicyCards(companyId)

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
  }, [])

  const topProject = policyCards[0]
  const hasPolicyCards = policyCards.length > 0

  const bestScore = getBestScore(policyCards)
  const maxSupportAmount = getMaxSupportAmount(policyCards)
  const priorityCount = getPriorityCount(policyCards)

  async function handleCreateDraft(project: SupportProject) {
    if (!project.policyId) {
      window.alert("policy_id가 없어 신청서 초안을 만들 수 없습니다.")
      return
    }

    const companyId = getStoredCompanyId()
    const { equipmentId } = getStoredAnalysisMeta()

    if (!companyId || !equipmentId) {
      window.alert("분석 결과의 company_id/equipment_id를 찾지 못했습니다.")
      return
    }

    const accessToken = getAccessToken()

    try {
      setDraftingPolicyId(project.policyId)

      const response = await fetch(`${API_BASE}/api/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          company_id: companyId,
          equipment_id: equipmentId,
          policy_id: project.policyId,
        }),
      })

      const text = await response.text()
      const json = text ? JSON.parse(text) : null

      if (!response.ok) {
        throw new Error(json?.detail || json?.message || `Draft API failed: ${response.status}`)
      }

      window.localStorage.setItem(DRAFT_RESULT_STORAGE_KEY, JSON.stringify(json))
      navigate("/application-draft")
    } catch (error) {
      console.error("Draft API failed:", error)
      window.alert(error instanceof Error ? error.message : "신청서 초안 생성에 실패했습니다.")
    } finally {
      setDraftingPolicyId(null)
    }
  }

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
            <EmptyPolicyState onBackToRoi={() => navigate("/roi")} />
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
                      {selectedEquipmentContext.equipmentName} 교체와 스마트
                      모니터링 도입 목적이 명확하고, ROI 분석 결과 투자
                      회수기간도 짧기 때문에 신청서 작성 근거를 구성하기 좋은
                      상태입니다.
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
                        disabled={draftingPolicyId === topProject.policyId}
                        onClick={() => handleCreateDraft(topProject)}
                      >
                        신청서 초안 만들기
                      </button>
                    </div>
                  </div>

                  <div className="ai-ground-card" style={{ marginTop: 0 }}>
                    <h4>AI 추천 근거</h4>

                    <ul>
                      <li>설비 노후도와 불량률 개선 필요성이 명확합니다.</li>
                      <li>스마트 모니터링 도입 목적이 지원사업 방향과 맞습니다.</li>
                      <li>
                        투자 회수기간이 약{" "}
                        {selectedEquipmentContext.roiPaybackMonths}개월로
                        사업성이 양호합니다.
                      </li>
                      <li>
                        전기요금 및 유지보수비 절감 효과를 신청서에 활용할 수
                        있습니다.
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
                      {policyCards.slice(0, 5).map((project) => (
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
                              disabled={draftingPolicyId === project.policyId}
                              onClick={() => handleCreateDraft(project)}
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
                    <span className="badge green">신청 가능</span>

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
                      73%입니다.
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
                      ROI와 설비 교체 필요성은 충분히 정리되어 있습니다. 다만
                      견적서와 사업계획서 문장을 보완하면 신청 완성도가 크게
                      높아집니다.
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
                          width: "73%",
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
                  <div className="check-card">
                    <h4>사업자등록증</h4>
                    <p>
                      기업명, 업종, 사업장 주소 등 기본정보 확인에 필요합니다.
                    </p>
                  </div>

                  <div className="check-card orange">
                    <h4>설비 견적서</h4>
                    <p>
                      도입 예정 설비의 금액, 사양, 납품 조건이 포함된 견적서를
                      준비해야 합니다.
                    </p>
                  </div>

                  <div className="check-card red">
                    <h4>현 설비 사진</h4>
                    <p>
                      노후 설비 상태를 보여주는 사진과 유지보수 이력을 함께
                      준비하면 신청 필요성이 강화됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}
