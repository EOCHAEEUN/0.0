import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import engiBot from "../assets/advisor/engi-bot-transparent.png"
import {
  fetchAdvisorChatSessionDetail,
  fetchAdvisorChatSessions,
  requestAdvisorAnswer,
  type AdvisorChatSessionItem,
} from "../features/aiAdvisor/aiAdvisor.api"
import { fetchDashboardOnboarding } from "../features/dashboard/dashboard.api"
import type { DashboardOnboardingMeResponse } from "../features/dashboard/dashboard.contract"
import {
  fetchPolicyCards,
  PolicyCardsApiError,
} from "../features/support/supportProjects.api"
import type { SupportProject } from "../features/support/supportProjects.contract"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type EquipmentOption = {
  equipment_id: string | null
  name: string
  category: string
  age_years: number
}

type AnalysisContext = {
  analysisId: string
  companyId: string
  equipmentId: string
  equipmentName: string
  createdAt: string
  roiPct: number | null
  scenarioAInvestment: number | null
  snapshotMissing: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return "-"
  const date = new Date(parsed)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`
}

function analysisFromRoute(searchParams: URLSearchParams, state: unknown) {
  const queryId = readText(searchParams.get("analysisId"), searchParams.get("analysis_id"))
  if (queryId) return queryId
  const routeState = asRecord(state)
  return readText(routeState.analysisId, routeState.analysis_id)
}

function readStoredAnalysisId() {
  try {
    return (
      window.localStorage.getItem("factofit_analysis_id") ||
      window.localStorage.getItem("analysis_id") ||
      ""
    )
  } catch {
    return ""
  }
}

function mapContexts(onboarding: DashboardOnboardingMeResponse | null) {
  const company = asRecord(onboarding?.company)
  const companyId = readText(company.company_id)
  return (onboarding?.roi_outputs ?? [])
    .map((row) => {
      const roiOutput = asRecord(row)
      const analysisId = readText(roiOutput.analysis_id, roiOutput.analysisId, roiOutput.id)
      const equipmentId = readText(roiOutput.equipment_id)
      const roiData = asRecord(roiOutput.roi_data)
      const scenarioA = asRecord(roiData.scenario_a)
      const snapshot = asRecord(roiOutput.policy_snapshot)
      return {
        analysisId,
        companyId,
        equipmentId,
        equipmentName: readText(roiOutput.equipment_name) || "검토 설비",
        createdAt: readText(roiOutput.created_at),
        roiPct: readNumber(scenarioA.roi_pct),
        scenarioAInvestment: readNumber(scenarioA.investment_manwon),
        snapshotMissing:
          Boolean(analysisId) &&
          (!snapshot.snapshot_version || !Array.isArray(snapshot.policies)),
      } satisfies AnalysisContext
    })
    .filter((item) => Boolean(item.analysisId))
    .sort(
      (left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
    )
}

function extractEquipmentSelection(cards: unknown[]) {
  const card = cards.find((item) => asRecord(item).type === "equipment_selection")
  const data = Array.isArray(asRecord(card).data) ? (asRecord(card).data as unknown[]) : []
  return data
    .map((item) => {
      const row = asRecord(item)
      return {
        equipment_id: readText(row.equipment_id) || null,
        name: readText(row.name) || "설비",
        category: readText(row.category) || "분류 없음",
        age_years: readNumber(row.age_years) ?? 0,
      } satisfies EquipmentOption
    })
    .filter((item) => Boolean(item.equipment_id))
}

function toMessageListFromSession(data: unknown): ChatMessage[] {
  const record = asRecord(data)
  const items = Array.isArray(record.messages) ? (record.messages as unknown[]) : []
  return items
    .map((item) => {
      const row = asRecord(item)
      const role = readText(row.role).toLowerCase() === "assistant" ? "assistant" : "user"
      const content = readText(row.content)
      if (!content) return null
      return { id: crypto.randomUUID(), role, content } satisfies ChatMessage
    })
    .filter((item): item is ChatMessage => Boolean(item))
}

export default function AiAdvisorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [onboarding, setOnboarding] = useState<DashboardOnboardingMeResponse | null>(null)
  const [contexts, setContexts] = useState<AnalysisContext[]>([])
  const [selectedAnalysisId, setSelectedAnalysisId] = useState("")
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("")
  const [analysisPickerOpen, setAnalysisPickerOpen] = useState(false)
  const [analysisSearch, setAnalysisSearch] = useState("")

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "안녕하세요. 작업형 AI 어드바이저 Engi입니다. 어떤 점을 도와드릴까요?",
    },
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState("")
  const [lastFailedQuestion, setLastFailedQuestion] = useState("")
  const [equipmentSelectionCards, setEquipmentSelectionCards] = useState<EquipmentOption[]>([])

  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState("")
  const [sessions, setSessions] = useState<AdvisorChatSessionItem[]>([])
  const [activeChatId, setActiveChatId] = useState("")

  const [snapshotPolicies, setSnapshotPolicies] = useState<SupportProject[]>([])
  const [snapshotLegacy, setSnapshotLegacy] = useState(false)

  const selectedContext = useMemo(
    () => contexts.find((item) => item.analysisId === selectedAnalysisId) ?? null,
    [contexts, selectedAnalysisId],
  )

  const companyId = useMemo(
    () => readText(selectedContext?.companyId, asRecord(onboarding?.company).company_id),
    [onboarding, selectedContext?.companyId],
  )

  const filteredContexts = useMemo(() => {
    const keyword = analysisSearch.trim().toLowerCase()
    if (!keyword) return contexts
    return contexts.filter((item) => {
      const haystack = `${item.equipmentName} ${item.analysisId}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [analysisSearch, contexts])

  useEffect(() => {
    let cancelled = false
    void fetchDashboardOnboarding()
      .then((response) => {
        if (cancelled) return
        setOnboarding(response)
        const mapped = mapContexts(response)
        setContexts(mapped)
        const routeId = analysisFromRoute(searchParams, location.state)
        const storedId = readStoredAnalysisId()
        const preferredId = readText(
          response.active_analysis_id,
          response.activeAnalysisId,
          response.latest_analysis_id,
          response.latestAnalysisId,
        )
        const selected =
          mapped.find((item) => item.analysisId === routeId) ||
          mapped.find((item) => item.analysisId === storedId) ||
          mapped.find((item) => item.analysisId === preferredId) ||
          mapped[0] ||
          null
        setSelectedAnalysisId(selected?.analysisId || "")
        setSelectedEquipmentId(selected?.equipmentId || "")
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : "컨텍스트 조회 실패")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [location.state, searchParams])

  useEffect(() => {
    if (!companyId) return
    setSessionsLoading(true)
    setSessionsError("")
    void fetchAdvisorChatSessions(companyId)
      .then((items) => setSessions(items))
      .catch((error) => {
        setSessionsError(error instanceof Error ? error.message : "대화 내역 조회 실패")
      })
      .finally(() => setSessionsLoading(false))
  }, [companyId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, equipmentSelectionCards])

  const requestChat = async (
    question: string,
    historyOverride?: ChatMessage[],
    selectedEquipmentOverride?: string,
  ) => {
    setChatError("")
    setLastFailedQuestion("")
    setSending(true)
    try {
      const history = historyOverride ?? messages
      const response = await requestAdvisorAnswer(
        question,
        history.map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        })),
        {
          companyId,
          selectedEquipmentId:
            selectedEquipmentOverride ||
            selectedContext?.equipmentId ||
            selectedEquipmentId,
          analysisId: selectedContext?.analysisId,
          chatId: activeChatId || undefined,
        },
      )
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: response.text },
      ])
      setEquipmentSelectionCards(extractEquipmentSelection(response.cards))
      setActiveChatId(response.chatId || "")
      if (companyId) {
        const nextSessions = await fetchAdvisorChatSessions(companyId)
        setSessions(nextSessions)
      }
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "AI 상담 서비스를 일시적으로 연결하지 못했습니다.",
      )
      setLastFailedQuestion(question)
    } finally {
      setSending(false)
    }
  }

  const sendChat = async () => {
    const question = input.trim()
    if (!question || sending) return
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    await requestChat(question, [...messages, userMessage])
  }

  const retryChat = async () => {
    if (!lastFailedQuestion || sending) return
    await requestChat(lastFailedQuestion)
  }

  const selectEquipmentFromCard = async (equipment: EquipmentOption) => {
    if (!equipment.equipment_id || sending) return
    setSelectedEquipmentId(equipment.equipment_id)
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `${equipment.name} 설비로 이어서 진행해줘`,
    }
    setMessages((prev) => [...prev, userMessage])
    await requestChat(
      "선택한 설비 기준으로 이어서 답변해줘.",
      [...messages, userMessage],
      equipment.equipment_id,
    )
    setEquipmentSelectionCards([])
  }

  const openSession = async (session: AdvisorChatSessionItem) => {
    if (!companyId) return
    try {
      const data = await fetchAdvisorChatSessionDetail(companyId, session.chat_id)
      const historyMessages = toMessageListFromSession(data)
      if (historyMessages.length > 0) {
        setMessages(historyMessages)
      }
      setActiveChatId(session.chat_id)
      setChatError("")
      setEquipmentSelectionCards([])
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "대화 상세 조회 실패")
    }
  }

  const startNewChat = () => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "새 대화를 시작합니다. 궁금한 내용을 편하게 물어보세요.",
      },
    ])
    setActiveChatId("")
    setChatError("")
    setLastFailedQuestion("")
    setEquipmentSelectionCards([])
    setSnapshotPolicies([])
    setSnapshotLegacy(false)
  }

  const loadSnapshotPolicies = async () => {
    const target = selectedContext
    if (!target?.analysisId || !target.equipmentId || !target.companyId) return
    if (target.snapshotMissing) {
      setSnapshotLegacy(true)
      setSnapshotPolicies([])
      return
    }
    try {
      const response = await fetchPolicyCards(
        target.companyId,
        target.equipmentId,
        target.analysisId,
        target.analysisId,
      )
      setSnapshotPolicies(response.cards.slice(0, 5))
      setSnapshotLegacy(false)
    } catch (error) {
      if (error instanceof PolicyCardsApiError && error.errorCode === "POLICY_SNAPSHOT_MISSING") {
        setSnapshotLegacy(true)
      } else {
        setChatError(error instanceof Error ? error.message : "정책 조회 실패")
      }
    }
  }

  return (
    <main className="page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            className="ff-all-analysis-link"
            onClick={() => navigate("/dashboard")}
          >
            ← 대시보드로 돌아가기
          </button>

          <div className="summary-hero-card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div className="screen-tag">WORKFLOW AI ADVISOR</div>
                <h2 style={{ marginBottom: 8 }}>작업형 AI 어드바이저</h2>
                <p className="section-desc">
                  ROI 분석, 정책 추천, 신청서 작성을 대화로 연결합니다.
                </p>
              </div>
              <img src={engiBot} alt="" style={{ width: 88, height: 88, objectFit: "contain" }} />
            </div>

            {!loading && !loadError && (
              <>
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #d0d5dd",
                    borderRadius: 12,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    {selectedContext ? (
                      <strong style={{ color: "#1d2939", fontSize: 13 }}>
                        [현재 분석] {selectedContext.equipmentName} · ROI{" "}
                        {formatPercent(selectedContext.roiPct)} · A안{" "}
                        {selectedContext.scenarioAInvestment ?? "-"}만원
                      </strong>
                    ) : (
                      <strong style={{ color: "#1d2939", fontSize: 13 }}>
                        [분석 선택] 현재 분석 없이 일반 상담 중입니다.
                      </strong>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ff-support-btn ghost"
                    onClick={() => setAnalysisPickerOpen(true)}
                  >
                    분석 변경
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ff-ai-advisor-chip"
                    disabled={!selectedContext}
                    onClick={() =>
                      selectedContext &&
                      navigate(`/roi?analysisId=${encodeURIComponent(selectedContext.analysisId)}`)
                    }
                  >
                    ROI 상세
                  </button>
                  <button
                    type="button"
                    className="ff-ai-advisor-chip"
                    disabled={!selectedContext}
                    onClick={() =>
                      selectedContext &&
                      navigate(`/roi?analysisId=${encodeURIComponent(selectedContext.analysisId)}`)
                    }
                  >
                    A/B 비교
                  </button>
                  <button
                    type="button"
                    className="ff-ai-advisor-chip"
                    disabled={!selectedContext}
                    onClick={() => void loadSnapshotPolicies()}
                  >
                    정책 보기
                  </button>
                  <button
                    type="button"
                    className="ff-ai-advisor-chip"
                    disabled={!selectedContext}
                    onClick={() =>
                      selectedContext &&
                      navigate(
                        `/support-projects?analysisId=${encodeURIComponent(selectedContext.analysisId)}`,
                      )
                    }
                  >
                    지원사업 열기
                  </button>
                  <button
                    type="button"
                    className="ff-ai-advisor-chip"
                    disabled={!selectedContext || snapshotPolicies.length === 0}
                    onClick={() => {
                      const first = snapshotPolicies[0]
                      if (!selectedContext || !first) return
                      navigate(
                        `/application-draft?policyId=${encodeURIComponent(first.rawId)}&analysisId=${encodeURIComponent(selectedContext.analysisId)}`,
                      )
                    }}
                  >
                    신청서 작성
                  </button>
                </div>
              </>
            )}

            {loading && <p style={{ marginTop: 10 }}>상담 컨텍스트 로딩 중...</p>}
            {loadError && <p style={{ marginTop: 10, color: "#b42318" }}>{loadError}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 16 }}>
            <article className="card" style={{ padding: 18 }}>
              <h3 style={{ marginBottom: 8 }}>현재 대화</h3>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {[
                  "안녕",
                  "지금은 어떤 걸 먼저 해야 해?",
                  "검토 설비 ROI를 쉽게 설명해줘",
                  "안 알아보고 싶은데",
                ].map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="ff-ai-advisor-chip"
                    onClick={() => setInput(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>

              <div className="ff-advisor-message-list">
                {messages.map((message) => (
                  <div key={message.id} className={`ff-advisor-message ${message.role}`}>
                    {message.content}
                  </div>
                ))}
                <div ref={messageEndRef} />
              </div>

              {chatError && (
                <div
                  style={{
                    marginTop: 8,
                    border: "1px solid #fecdca",
                    background: "#fef3f2",
                    borderRadius: 10,
                    padding: "8px 10px",
                  }}
                >
                  <p style={{ margin: 0, color: "#b42318", fontWeight: 800 }}>{chatError}</p>
                  <button
                    type="button"
                    className="ff-support-btn ghost"
                    style={{ marginTop: 6 }}
                    onClick={() => void retryChat()}
                  >
                    재시도
                  </button>
                </div>
              )}

              {equipmentSelectionCards.length > 0 && (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  <strong style={{ fontSize: 13 }}>설비 선택이 필요합니다.</strong>
                  {equipmentSelectionCards.map((equipment) => (
                    <button
                      key={equipment.equipment_id}
                      type="button"
                      className="ff-support-btn ghost"
                      onClick={() => void selectEquipmentFromCard(equipment)}
                    >
                      {equipment.name} · {equipment.category} · {equipment.age_years}년
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 112px", gap: 8, marginTop: 10 }}>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void sendChat()
                    }
                  }}
                  placeholder="질문 입력 (Enter 전송 / Shift+Enter 줄바꿈)"
                  style={{
                    minHeight: 56,
                    borderRadius: 12,
                    border: "1px solid #d0d5dd",
                    padding: "10px 12px",
                  }}
                />
                <button
                  className="btn blue"
                  type="button"
                  onClick={() => void sendChat()}
                  disabled={sending}
                >
                  {sending ? "전송중" : "보내기"}
                </button>
              </div>
            </article>

            <article className="card" style={{ padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <h3 style={{ margin: 0 }}>내 대화 내역</h3>
                <button type="button" className="ff-support-btn ghost" onClick={startNewChat}>
                  새 대화
                </button>
              </div>
              {sessionsLoading && <p>대화 내역 조회 중...</p>}
              {sessionsError && <p style={{ color: "#b42318" }}>{sessionsError}</p>}
              {!sessionsLoading && sessions.length === 0 && <p>저장된 대화가 없습니다.</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {sessions.map((session) => (
                  <button
                    key={session.chat_id}
                    type="button"
                    className="ff-support-btn ghost"
                    style={{
                      textAlign: "left",
                      borderColor: activeChatId === session.chat_id ? "#344ba0" : undefined,
                    }}
                    onClick={() => void openSession(session)}
                  >
                    <div style={{ width: "100%" }}>
                      <strong style={{ display: "block", marginBottom: 4 }}>{session.title}</strong>
                      <span style={{ display: "block", color: "#475467", fontSize: 12 }}>
                        {session.preview || "(미리보기 없음)"}
                      </span>
                      <span style={{ display: "block", color: "#667085", fontSize: 11, marginTop: 4 }}>
                        {formatDateTime(session.created_at)} ·{" "}
                        {session.analysis_id ? "분석 상담" : "일반 상담"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          </div>

          {snapshotLegacy && (
            <article className="card" style={{ marginTop: 14, padding: 18 }}>
              <strong>이 분석은 정책 이력 저장 전 생성되었습니다.</strong>
              <p>
                당시 매칭 정책 정보를 복원할 수 없습니다. 재분석 또는 최신 지원사업 보기를
                이용해 주세요.
              </p>
              <div className="ff-support-legacy-actions">
                <button type="button" className="btn dark" onClick={() => navigate("/analysis/new")}>
                  재분석
                </button>
                <button type="button" className="btn blue" onClick={() => navigate("/support-projects")}>
                  최신 지원사업 보기
                </button>
              </div>
            </article>
          )}
        </div>
      </section>

      {analysisPickerOpen && (
        <section className="ff-advisor-agent-shell" aria-label="분석 선택">
          <div className="ff-advisor-agent-stage" style={{ maxWidth: 720 }}>
            <header className="ff-advisor-agent-header">
              <div className="ff-advisor-brand-block">
                <div>
                  <span>ANALYSIS PICKER</span>
                  <h2>분석 변경</h2>
                </div>
              </div>
              <button type="button" onClick={() => setAnalysisPickerOpen(false)} aria-label="닫기">
                ×
              </button>
            </header>
            <main className="ff-advisor-agent-main">
              <input
                value={analysisSearch}
                onChange={(event) => setAnalysisSearch(event.target.value)}
                placeholder="설비명/analysis_id 검색"
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 10,
                  border: "1px solid #d0d5dd",
                  padding: "0 12px",
                  marginBottom: 10,
                }}
              />
              <div style={{ display: "grid", gap: 8, maxHeight: "55vh", overflow: "auto" }}>
                {filteredContexts.map((analysis) => (
                  <button
                    key={analysis.analysisId}
                    type="button"
                    className="ff-support-btn ghost"
                    style={{ justifyContent: "space-between" }}
                    onClick={() => {
                      setSelectedAnalysisId(analysis.analysisId)
                      setSelectedEquipmentId(analysis.equipmentId)
                      setAnalysisPickerOpen(false)
                    }}
                  >
                    <span>
                      {analysis.equipmentName} · ROI {formatPercent(analysis.roiPct)}
                    </span>
                    <span>{formatDateTime(analysis.createdAt)}</span>
                  </button>
                ))}
                {!filteredContexts.length && <p>검색 결과가 없습니다.</p>}
              </div>
            </main>
          </div>
        </section>
      )}
    </main>
  )
}
