import { Send } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import engiBot from "../assets/advisor/engi-bot-transparent.png"
import botIcon from "../assets/advisor/factofit-ai-bot.png"
import DashboardWorkspacePageLayout from "../components/layout/DashboardWorkspacePageLayout"
import AdvisorQuickActions from "../features/aiAdvisor/AdvisorQuickActions"
import AdvisorResponseCards from "../features/aiAdvisor/AdvisorResponseCards"
import InvestmentSimulationDialog from "../features/aiAdvisor/InvestmentSimulationDialog"
import { ANALYSIS_QUICK_ACTIONS, type AdvisorActionDefinition } from "../features/aiAdvisor/advisorActions"
import "../features/aiAdvisor/aiAdvisor.css"
import {
  createAdvisorChatSession,
  fetchAdvisorChatSessionDetail,
  fetchAdvisorChatSessions,
  requestAdvisorAnswer,
  type AdvisorChatSessionItem,
} from "../features/aiAdvisor/aiAdvisor.api"
import { fetchDashboardOnboarding } from "../features/dashboard/dashboard.api"
import type { DashboardOnboardingMeResponse } from "../features/dashboard/dashboard.contract"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  cards?: unknown[]
  sentAt?: string
}

const SUGGESTION_CHIPS = [
  "현재 분석 요약해줘",
  "추천 시나리오 근거 알려줘",
  "A안/B안 차이 쉽게 설명해줘",
  "지금 바로 해야 할 일 정리해줘",
] as const

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
  scenarioBInvestment: number | null
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

function formatMessageTime(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const period = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${period}`
}

function nowIso() {
  return new Date().toISOString()
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

function createChatMessage(
  role: "user" | "assistant",
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    sentAt: nowIso(),
    ...extra,
  }
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

function readAuthUserId() {
  try {
    const raw = window.localStorage.getItem("factofit_auth_session")
    if (!raw) return ""
    const parsed = asRecord(JSON.parse(raw))
    return readText(parsed.userId, parsed.user_id, parsed.id)
  } catch {
    return ""
  }
}

function readLoginTokenMarker() {
  try {
    const token =
      window.localStorage.getItem("factofit_access_token") ||
      window.localStorage.getItem("access_token") ||
      ""
    if (!token) return "anonymous"
    return token.slice(-12)
  } catch {
    return "anonymous"
  }
}

function buildActiveSessionStorageKey(companyId: string, userId: string, tokenMarker: string) {
  if (!companyId) return ""
  return `advisor.activeSession.${companyId}.${userId || "unknown"}.${tokenMarker}`
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
      const scenarioB = asRecord(roiData.scenario_b)
      const snapshot = asRecord(roiOutput.policy_snapshot)
      return {
        analysisId,
        companyId,
        equipmentId,
        equipmentName: readText(roiOutput.equipment_name) || "검토 설비",
        createdAt: readText(roiOutput.created_at),
        roiPct: readNumber(scenarioA.roi_pct),
        scenarioAInvestment: readNumber(scenarioA.investment_manwon),
        scenarioBInvestment: readNumber(scenarioB.investment_manwon),
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
  const messages: ChatMessage[] = []
  for (const item of items) {
    const row = asRecord(item)
    const role = readText(row.role).toLowerCase() === "assistant" ? "assistant" : "user"
    const content = readText(row.content)
    if (!content) continue
    messages.push({ id: crypto.randomUUID(), role, content })
  }
  return messages
}

export default function AiAdvisorPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const hydratedSessionRef = useRef("")

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [onboarding, setOnboarding] = useState<DashboardOnboardingMeResponse | null>(null)
  const [contexts, setContexts] = useState<AnalysisContext[]>([])
  const [selectedAnalysisId, setSelectedAnalysisId] = useState("")
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("")
  const [analysisPickerOpen, setAnalysisPickerOpen] = useState(false)
  const [analysisSearch, setAnalysisSearch] = useState("")

  const [messages, setMessages] = useState<ChatMessage[]>([
    createChatMessage(
      "assistant",
      "안녕하세요. 작업형 AI 어드바이저 Engi입니다. 어떤 점을 도와드릴까요?",
    ),
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState("")
  const [lastFailedQuestion, setLastFailedQuestion] = useState("")
  const [lastFailedAction, setLastFailedAction] = useState<AdvisorActionDefinition | null>(null)
  const [equipmentSelectionCards, setEquipmentSelectionCards] = useState<EquipmentOption[]>([])
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)
  const [simulationOpen, setSimulationOpen] = useState(false)
  const [actionError, setActionError] = useState("")

  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState("")
  const [sessions, setSessions] = useState<AdvisorChatSessionItem[]>([])
  const [activeChatId, setActiveChatId] = useState("")

  const selectedContext = useMemo(
    () => contexts.find((item) => item.analysisId === selectedAnalysisId) ?? null,
    [contexts, selectedAnalysisId],
  )

  const companyId = useMemo(
    () => readText(selectedContext?.companyId, asRecord(onboarding?.company).company_id),
    [onboarding, selectedContext?.companyId],
  )
  const userId = useMemo(() => readAuthUserId(), [])
  const tokenMarker = useMemo(() => readLoginTokenMarker(), [])
  const activeSessionStorageKey = useMemo(
    () => buildActiveSessionStorageKey(companyId, userId, tokenMarker),
    [companyId, tokenMarker, userId],
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
        if (cancelled || !response) return
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
    let cancelled = false
    setSessionsLoading(true)
    setSessionsError("")
    void fetchAdvisorChatSessions(companyId)
      .then(async (items) => {
        if (cancelled) return
        let nextItems = items
        if (nextItems.length === 0) {
          const created = await createAdvisorChatSession({
            companyId,
            analysisId: selectedContext?.analysisId,
            equipmentId: selectedContext?.equipmentId || selectedEquipmentId,
          })
          const createdSessionId = readText(created?.session_id, created?.chat_id)
          if (createdSessionId) {
            nextItems = await fetchAdvisorChatSessions(companyId)
          }
        }
        setSessions(nextItems)
        const storedSessionId = activeSessionStorageKey
          ? window.localStorage.getItem(activeSessionStorageKey) || ""
          : ""
        const preferredSession =
          nextItems.find((session) => session.session_id === storedSessionId) ||
          nextItems.find((session) => session.chat_id === storedSessionId) ||
          nextItems[0]
        if (preferredSession) {
          setActiveChatId(preferredSession.session_id || preferredSession.chat_id)
        }
      })
      .catch((error) => {
        if (cancelled) return
        setSessionsError(error instanceof Error ? error.message : "대화 내역 조회 실패")
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    activeSessionStorageKey,
    companyId,
    selectedContext?.analysisId,
    selectedContext?.equipmentId,
    selectedEquipmentId,
  ])

  useEffect(() => {
    if (!activeSessionStorageKey) return
    if (!activeChatId) {
      window.localStorage.removeItem(activeSessionStorageKey)
      return
    }
    window.localStorage.setItem(activeSessionStorageKey, activeChatId)
  }, [activeChatId, activeSessionStorageKey])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, equipmentSelectionCards])

  useEffect(() => {
    if (!companyId || !activeChatId) return
    if (hydratedSessionRef.current === activeChatId) return
    hydratedSessionRef.current = activeChatId
    void fetchAdvisorChatSessionDetail(companyId, activeChatId)
      .then((data) => {
        const historyMessages = toMessageListFromSession(data)
        if (historyMessages.length > 0) {
          setMessages(historyMessages)
        }
      })
      .catch(() => {
        // 세션 상세 로딩 실패는 대화 목록 오류 처리와 분리한다.
      })
  }, [activeChatId, companyId])

  const reloadSessions = async () => {
    if (!companyId) return
    const items = await fetchAdvisorChatSessions(companyId)
    setSessions(items)
  }

  const ensureActiveSessionId = async () => {
    if (activeChatId) return activeChatId
    if (!companyId) return ""

    const created = await createAdvisorChatSession({
      companyId,
      analysisId: selectedContext?.analysisId,
      equipmentId: selectedContext?.equipmentId || selectedEquipmentId,
    })
    const sessionId = readText(created?.session_id, created?.chat_id)
    if (!sessionId) {
      throw new Error("새 대화 세션을 생성하지 못했습니다.")
    }
    setActiveChatId(sessionId)
    await reloadSessions()
    return sessionId
  }

  const requestChat = async (
    question: string,
    historyOverride?: ChatMessage[],
    options?: {
      selectedEquipmentOverride?: string
      action?: string
      simulationInput?: Record<string, number>
    },
  ) => {
    setChatError("")
    setActionError("")
    setLastFailedQuestion("")
    setLastFailedAction(null)
    setSending(true)
    try {
      const sessionId = await ensureActiveSessionId()
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
            options?.selectedEquipmentOverride ||
            selectedContext?.equipmentId ||
            selectedEquipmentId,
          analysisId: selectedContext?.analysisId,
          action: options?.action,
          simulationInput: options?.simulationInput,
          chatId: sessionId || undefined,
          sessionId: sessionId || undefined,
          source: "advisor",
        },
      )
      setMessages((prev) => [
        ...prev,
        createChatMessage("assistant", response.text, { cards: response.cards }),
      ])
      setEquipmentSelectionCards(extractEquipmentSelection(response.cards))
      setActiveChatId((prev) => response.chatId || sessionId || prev)
      await reloadSessions()
      return response
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "AI 상담 서비스를 일시적으로 연결하지 못했습니다.",
      )
      setLastFailedQuestion(question)
      throw error
    } finally {
      setSending(false)
    }
  }

  const executeAdvisorAction = async (
    actionDef: AdvisorActionDefinition,
    simulationInput?: Record<string, number>,
  ) => {
    if (loadingActionId || sending) return
    if (actionDef.responseType === "dialog") {
      setSimulationOpen(true)
      return
    }

    setActionError("")
    setLoadingActionId(actionDef.id)
    const userMessage = createChatMessage("user", actionDef.userMessage)
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    try {
      await requestChat(actionDef.userMessage, nextMessages, {
        action: actionDef.id,
        simulationInput,
      })
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.",
      )
      setLastFailedAction(actionDef)
    } finally {
      setLoadingActionId(null)
    }
  }

  const handleSimulationSubmit = async (simulationInput: Record<string, number>) => {
    setSimulationOpen(false)
    const simulationAction = ANALYSIS_QUICK_ACTIONS.find(
      (item) => item.id === "investment_simulation",
    )
    if (!simulationAction) return
    await executeAdvisorAction(simulationAction, simulationInput)
  }

  const sendChat = async () => {
    const question = input.trim()
    if (!question || sending) return
    const userMessage = createChatMessage("user", question)
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    await requestChat(question, [...messages, userMessage])
  }

  const retryChat = async () => {
    if (!lastFailedQuestion || sending) return
    await requestChat(lastFailedQuestion)
  }

  const selectEquipmentFromCard = async (equipment: EquipmentOption) => {
    if (!equipment.equipment_id || sending || loadingActionId) return
    setSelectedEquipmentId(equipment.equipment_id)
    const userMessage = createChatMessage("user", `${equipment.name} 설비 ROI 분석`)
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setLoadingActionId("roi_analyze")
    try {
      await requestChat(userMessage.content, nextMessages, {
        selectedEquipmentOverride: equipment.equipment_id,
        action: "roi_analyze",
      })
      setEquipmentSelectionCards([])
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "설비 분석 시작 실패")
    } finally {
      setLoadingActionId(null)
    }
  }

  const openSession = async (session: AdvisorChatSessionItem) => {
    if (!companyId) return
    try {
      const targetSessionId = session.session_id || session.chat_id
      const data = await fetchAdvisorChatSessionDetail(companyId, targetSessionId)
      const historyMessages = toMessageListFromSession(data)
      if (historyMessages.length > 0) {
        setMessages(historyMessages)
      } else {
        setMessages([
          createChatMessage("assistant", "새 대화를 시작해보세요."),
        ])
      }
      hydratedSessionRef.current = targetSessionId
      setActiveChatId(targetSessionId)
      setChatError("")
      setEquipmentSelectionCards([])
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "대화 상세 조회 실패")
    }
  }

  const startNewChat = async () => {
    if (!companyId) return
    setChatError("")
    setLastFailedQuestion("")
    setEquipmentSelectionCards([])
    try {
      const created = await createAdvisorChatSession({
        companyId,
        analysisId: selectedContext?.analysisId,
        equipmentId: selectedContext?.equipmentId || selectedEquipmentId,
      })
      const nextSessionId = readText(created?.session_id, created?.chat_id)
      hydratedSessionRef.current = nextSessionId
      setActiveChatId(nextSessionId)
      setMessages([
        createChatMessage("assistant", "새 대화를 시작합니다. 궁금한 내용을 편하게 물어보세요."),
      ])
      await reloadSessions()
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "새 대화 생성 실패")
    }
  }

  const preferredAnalysisId = useMemo(
    () => selectedAnalysisId || analysisFromRoute(searchParams, location.state) || undefined,
    [location.state, searchParams, selectedAnalysisId],
  )

  const isEmbeddedAdvisor = searchParams.get("embeddedAdvisor") === "1"

  const advisorPageContent = (
    <div
      className={`ff-advisor-page-shell${isEmbeddedAdvisor ? " ff-advisor-page-shell--embedded" : ""}`}
    >
        <section className="ff-advisor-hero">
          <div className="ff-advisor-hero-copy">
            <span className="ff-advisor-hero-badge">WORKFLOW AI ADVISOR</span>
            <h1>작업형 AI 어드바이저</h1>
            <p>ROI 분석, 정책 추천, 신청서 작성을 대화로 연결합니다.</p>
            <p className="ff-advisor-hero-sub">
              {selectedContext
                ? "아래 버튼은 선택한 분석의 저장 결과를 기준으로 실행됩니다."
                : "분석이 없으면 새 투자 분석부터 시작하세요."}
            </p>
            {loading && <p className="ff-advisor-hero-status">상담 컨텍스트 로딩 중...</p>}
            {loadError && <p className="ff-advisor-hero-status is-error">{loadError}</p>}
          </div>
          <div className="ff-advisor-hero-visual" aria-hidden="true">
            <img src={engiBot} alt="" />
          </div>
        </section>

        <div className="ff-advisor-page-grid">
          <article className="ff-advisor-chat-card">
            <div className="ff-advisor-chat-head">
              <h3>현재 대화</h3>
              <span className="ff-advisor-system-status">
                <i aria-hidden="true" />
                AI 시스템 활성화됨
              </span>
            </div>

            {!loading && !loadError && (
              <>
                <AdvisorQuickActions
                  hasAnalysis={Boolean(selectedContext)}
                  loadingActionId={loadingActionId}
                  onChangeAnalysis={() => setAnalysisPickerOpen(true)}
                  onAction={(action) => void executeAdvisorAction(action)}
                />
                <div className="ff-advisor-chip-row">
                  {SUGGESTION_CHIPS.map((question) => (
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
              </>
            )}

            <div className="ff-advisor-message-list">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="ff-advisor-message-row user">
                    <div className="ff-advisor-message user">{message.content}</div>
                    {message.sentAt ? (
                      <time className="ff-advisor-message-time">{formatMessageTime(message.sentAt)}</time>
                    ) : null}
                  </div>
                ) : (
                  <div key={message.id} className="ff-advisor-message-row assistant">
                    <div className="ff-advisor-message-avatar">
                      <img src={botIcon} alt="" />
                      <span>Industrial AI</span>
                    </div>
                    <div className="ff-advisor-message-stack">
                      <div className="ff-advisor-message assistant">{message.content}</div>
                      {message.cards && message.cards.length > 0 ? (
                        <>
                          <AdvisorResponseCards
                            cards={message.cards}
                            analysisId={selectedContext?.analysisId}
                          />
                          <div className="ff-advisor-tip-box">
                            <strong>Tip:</strong> 응답 카드의 버튼을 누르면 해당 화면으로 바로
                            이동할 수 있습니다.
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
              <div ref={messageEndRef} />
            </div>

            {actionError && (
              <div className="ff-advisor-inline-alert">
                <p>{actionError}</p>
                {lastFailedAction && (
                  <button
                    type="button"
                    className="ff-advisor-text-btn"
                    onClick={() => void executeAdvisorAction(lastFailedAction)}
                  >
                    다시 시도
                  </button>
                )}
              </div>
            )}

            {chatError && (
              <div className="ff-advisor-inline-alert">
                <p>{chatError}</p>
                <button type="button" className="ff-advisor-text-btn" onClick={() => void retryChat()}>
                  재시도
                </button>
              </div>
            )}

            {equipmentSelectionCards.length > 0 && (
              <div className="ff-advisor-equipment-pick">
                <strong>설비 선택이 필요합니다.</strong>
                {equipmentSelectionCards.map((equipment) => (
                  <button
                    key={equipment.equipment_id}
                    type="button"
                    className="ff-advisor-text-btn"
                    onClick={() => void selectEquipmentFromCard(equipment)}
                  >
                    {equipment.name} · {equipment.category} · {equipment.age_years}년
                  </button>
                ))}
              </div>
            )}

            <div className="ff-advisor-composer">
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
              />
              <button
                type="button"
                className="ff-advisor-send-btn"
                onClick={() => void sendChat()}
                disabled={sending}
              >
                {sending ? "전송중" : "보내기"}
                <Send size={15} aria-hidden="true" />
              </button>
            </div>
          </article>

          <article className="ff-advisor-session-card">
            <div className="ff-advisor-session-head">
              <h3>내 대화 내역</h3>
              <button type="button" className="ff-advisor-new-chat-btn" onClick={() => void startNewChat()}>
                + 새 대화
              </button>
            </div>

            {sessionsLoading && <p className="ff-advisor-muted">대화 내역 조회 중...</p>}
            {sessionsError && (
              <div className="ff-advisor-inline-alert">
                <p>{sessionsError}</p>
                <button
                  type="button"
                  className="ff-advisor-text-btn"
                  onClick={() => {
                    setSessionsError("")
                    void reloadSessions().catch((error) =>
                      setSessionsError(error instanceof Error ? error.message : "대화 내역 조회 실패"),
                    )
                  }}
                >
                  다시 불러오기
                </button>
              </div>
            )}
            {!sessionsLoading && sessions.length === 0 && (
              <p className="ff-advisor-muted">저장된 대화가 없습니다.</p>
            )}

            <div className="ff-advisor-session-list">
              {sessions.map((session) => {
                const sessionId = session.session_id || session.chat_id
                const isActive = activeChatId === sessionId
                return (
                  <button
                    key={sessionId}
                    type="button"
                    className={`ff-advisor-session-item${isActive ? " is-active" : ""}`}
                    onClick={() => void openSession(session)}
                  >
                    <div className="ff-advisor-session-item-top">
                      <strong>{session.title}</strong>
                      <time>{formatDateTime(session.updated_at || session.created_at)}</time>
                    </div>
                    <p>{session.preview || "(미리보기 없음)"}</p>
                    <span className="ff-advisor-session-tag">
                      {session.analysis_id ? "분석 상담" : "일반 상담"}
                    </span>
                  </button>
                )
              })}
            </div>
          </article>
        </div>

        <InvestmentSimulationDialog
          open={simulationOpen}
          scenarioAInvestment={selectedContext?.scenarioAInvestment ?? null}
          scenarioBInvestment={selectedContext?.scenarioBInvestment ?? null}
          loading={loadingActionId === "investment_simulation"}
          onClose={() => setSimulationOpen(false)}
          onSubmit={(input) => void handleSimulationSubmit(input)}
        />

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
    </div>
  )

  if (isEmbeddedAdvisor) {
    return <div className="ff-advisor-embedded-page">{advisorPageContent}</div>
  }

  return (
    <DashboardWorkspacePageLayout
      analysisId={preferredAnalysisId}
      pageClassName="ff-advisor-workspace-page"
      contentClassName="ff-advisor-workspace-content"
    >
      {advisorPageContent}
    </DashboardWorkspacePageLayout>
  )
}
