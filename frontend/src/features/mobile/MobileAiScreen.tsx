import { Send } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useDashboardData } from "../dashboard/hooks/useDashboardData"
import { getStoredCompanyId } from "../dashboard/dashboard.api"
import {
  fetchAdvisorChatSessions,
  requestAdvisorAnswer,
  type AdvisorChatSessionItem,
} from "../aiAdvisor/aiAdvisor.api"
import { resolveMobileFlowContext } from "./mobileFlowContext"

type MobileMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

const QUICK_QUESTIONS = [
  "오늘 해야 할 일을 알려줘",
  "이 설비 투자해도 될까?",
  "신청서에 무엇이 부족해?",
  "안전 점검 증빙은 어떻게 등록해?",
] as const

export default function MobileAiScreen() {
  const [searchParams, setSearchParams] = useSearchParams()
  const preferredAnalysisId = searchParams.get("analysisId") || searchParams.get("analysis_id") || undefined
  const { dashboard } = useDashboardData({ preferredAnalysisId })
  const workspace = dashboard.workspace
  const flowContext = useMemo(
    () => resolveMobileFlowContext(searchParams, workspace),
    [searchParams, workspace],
  )
  const autoSentRef = useRef("")
  const companyId = getStoredCompanyId()

  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [messages, setMessages] = useState<MobileMessage[]>([
    { id: crypto.randomUUID(), role: "assistant", text: "AI 현장 도우미입니다. 무엇을 도와드릴까요?" },
  ])
  const messagesRef = useRef<MobileMessage[]>(messages)
  const [recentSessions, setRecentSessions] = useState<AdvisorChatSessionItem[]>([])

  const queryQuestion = searchParams.get("q") || ""

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const sendQuestion = async (question: string) => {
    const nextQuestion = question.trim()
    if (!nextQuestion || sending) return
    const userMessage: MobileMessage = { id: crypto.randomUUID(), role: "user", text: nextQuestion }
    const historyForRequest = [...messagesRef.current, userMessage]
    messagesRef.current = historyForRequest
    setMessages(historyForRequest)
    setInput("")
    setSending(true)
    setError("")
    try {
      const response = await requestAdvisorAnswer(
        nextQuestion,
        historyForRequest.map((item) => ({ role: item.role, content: item.text })),
        {
          companyId,
          selectedEquipmentId: flowContext.equipmentId,
          policyId: flowContext.policyId,
          analysisId: flowContext.analysisId || undefined,
          source: "advisor",
        },
      )
      setMessages((prev) => {
        const assistantMessage: MobileMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.text,
        }
        const nextMessages: MobileMessage[] = [...prev, assistantMessage]
        messagesRef.current = nextMessages
        return nextMessages
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "AI 응답을 불러오지 못했습니다.")
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    void fetchAdvisorChatSessions(companyId)
      .then((items) => setRecentSessions(items.slice(0, 3)))
      .catch(() => setRecentSessions([]))
  }, [companyId])

  useEffect(() => {
    const question = queryQuestion.trim()
    const autoSendKey = `${question}|${flowContext.analysisId || ""}|${flowContext.policyId || ""}|${flowContext.equipmentId || ""}`
    if (!question || autoSentRef.current === autoSendKey) return
    autoSentRef.current = autoSendKey
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("q")
      return next
    }, { replace: true })
    void sendQuestion(question)
  }, [flowContext.analysisId, flowContext.equipmentId, flowContext.policyId, queryQuestion, setSearchParams])

  const contextLabel = useMemo(() => {
    if (flowContext.policyId) {
      return `${workspace.equipmentName || "대표설비"} · 정책 ${flowContext.policyId}`
    }
    return `${workspace.equipmentName || "대표설비"} 기준`
  }, [flowContext.policyId, workspace.equipmentName])

  return (
    <section className="ff-mobile-screen">
      <header className="ff-mobile-header" style={{ background: "var(--navy)", color: "#fff" }}>
        <div>
          <h1 style={{ color: "#fff" }}>AI 현장 도우미</h1>
          <p style={{ color: "#D8E6F5" }}>{contextLabel}</p>
        </div>
      </header>

      <article className="ff-mobile-card" style={{ background: "var(--navy)", color: "#fff" }}>
        <h2 style={{ color: "#fff" }}>추천 질문</h2>
        <div className="ff-mobile-chip-row">
          {QUICK_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              className="ff-mobile-chip"
              onClick={() => void sendQuestion(question)}
            >
              {question}
            </button>
          ))}
        </div>
      </article>

      <article className="ff-mobile-card">
        <h2>최근 대화</h2>
        {recentSessions.length === 0 ? (
          <p>최근 대화 이력이 없습니다.</p>
        ) : (
          <div className="ff-mobile-list">
            {recentSessions.map((session) => (
              <div key={session.session_id || session.chat_id} className="ff-mobile-list-item">
                <h3>{session.title || "새 대화"}</h3>
                <p>{session.preview || "(미리보기 없음)"}</p>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="ff-mobile-card">
        <h2>대화</h2>
        <div className="ff-mobile-list">
          {messages.slice(-6).map((message) => (
            <div key={message.id} className="ff-mobile-list-item">
              <p className="ff-mobile-meta">{message.role === "assistant" ? "AI" : "나"}</p>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        {error ? <p>{error}</p> : null}
        <div className="ff-mobile-form-field">
          <label htmlFor="mobile-ai-input">질문 입력</label>
          <textarea
            id="mobile-ai-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="현장 질문을 입력하세요."
          />
        </div>
        <button type="button" className="ff-mobile-primary-btn" disabled={sending} onClick={() => void sendQuestion(input)}>
          {sending ? "전송 중..." : "전송"} <Send size={14} />
        </button>
      </article>
    </section>
  )
}
