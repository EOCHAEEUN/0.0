import { useEffect, useMemo, useRef, useState } from "react"
import {
  requestAdvisorAnswer,
  buildLocalAdvisorResponse,
  toAdvisorChatHistory,
} from "../aiAdvisor.api"
import type { AdvisorMessage, AdvisorQuickActionId } from "../aiAdvisor.contract"
import {
  ADVISOR_QUICK_ACTIONS,
  ADVISOR_STAGE_CARDS,
} from "../aiAdvisor.constants"
import botIcon from "../../../assets/advisor/factofit-ai-bot.png"

const QUICK_ACTION_PROMPT: Record<AdvisorQuickActionId, string> = {
  roi: "ROI 분석이 궁금해요. 현재 설비 투자 판단을 쉽게 설명해줘.",
  support: "우리 공장 설비 조건에 맞는 지원사업 추천 흐름을 알려줘.",
  safety: "안전점검에서 지금 먼저 봐야 할 위험 항목을 알려줘.",
  draft: "지원사업 신청서 문장을 어떻게 쓰면 좋을지 알려줘.",
}

function createInitialMessages(): AdvisorMessage[] {
  return [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "안녕하세요. FactoFit AI입니다. ROI, 지원사업, 안전점검, 신청서 작성 중 궁금한 업무를 선택해 주세요.",
    },
  ]
}

export function AdvisorAgentPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<AdvisorMessage[]>(() =>
    createInitialMessages(),
  )
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  )

  useEffect(() => {
    if (!open) return
    messageEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages, open])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    const userMessage: AdvisorMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsSending(true)

    try {
      const answer = await requestAdvisorAnswer(
        trimmed,
        toAdvisorChatHistory(messages),
      )
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: answer,
        },
      ])
    } catch (error) {
      console.warn("AI Advisor API 연결 실패, 로컬 응답으로 대체:", error)
      setMessages((prev) => [...prev, buildLocalAdvisorResponse(trimmed)])
    } finally {
      setIsSending(false)
    }
  }

  const handleQuickAction = (id: AdvisorQuickActionId) => {
    void sendMessage(QUICK_ACTION_PROMPT[id])
  }

  if (!open) return null

  return (
    <section className="ff-advisor-agent-shell" aria-label="FactoFit AI Advisor">
      <div className="ff-advisor-agent-stage">
        <header className="ff-advisor-agent-header">
          <div className="ff-advisor-brand-block">
            <div className="ff-advisor-brand-icon">
              <img src={botIcon} alt="" />
            </div>
            <div>
              <span>FACTOFIT AI AGENT</span>
              <h2>AI Advisor</h2>
            </div>
          </div>

          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <main className="ff-advisor-agent-main">
          <section className="ff-advisor-agent-hero">
            <div>
              <span className="ff-advisor-mini-pill">STEP 01</span>
              <h3>
                무엇을 도와드릴까요?
                <br />
                필요한 업무를 선택해 주세요.
              </h3>
              <p>
                저장된 기업정보, 설비정보, ROI 결과, 지원사업 매칭 결과를
                바탕으로 다음 행동을 쉽게 안내합니다.
              </p>
            </div>

            <div className="ff-advisor-bot-card">
              <img src={botIcon} alt="" />
              <strong>FactoFit AI</strong>
              <span>데이터를 이해하고 가이드를 찾아드립니다.</span>
            </div>
          </section>

          <section className="ff-advisor-stage-grid">
            {ADVISOR_STAGE_CARDS.map((card) => (
              <article key={card.id}>
                <span>{card.step}</span>
                <strong>{card.title}</strong>
                <p>{card.description}</p>
              </article>
            ))}
          </section>

          <section className="ff-advisor-action-card">
            <div className="ff-advisor-section-head">
              <div>
                <h4>빠른 질문 선택</h4>
                <p>질문을 직접 입력하지 않아도 바로 시작할 수 있어요.</p>
              </div>
            </div>

            <div className="ff-advisor-quick-grid">
              {ADVISOR_QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleQuickAction(action.id)}
                >
                  <b>{action.label}</b>
                  <span>{action.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ff-advisor-chat-card">
            <div className="ff-advisor-section-head">
              <div>
                <h4>AI 답변</h4>
                <p>선택한 질문에 대한 첫 답변이 여기에 표시됩니다.</p>
              </div>
              {isSending && <span className="ff-advisor-loading">답변 생성 중</span>}
            </div>

            <div className="ff-advisor-message-list">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`ff-advisor-message ${message.role}`}
                >
                  {message.text}
                </article>
              ))}
              <div ref={messageEndRef} />
            </div>

            <form
              className="ff-advisor-input-row"
              onSubmit={(event) => {
                event.preventDefault()
                void sendMessage(inputValue)
              }}
            >
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="질문 입력..."
              />
              <button type="submit" disabled={isSending || !inputValue.trim()}>
                전송
              </button>
            </form>
          </section>

          <footer className="ff-advisor-agent-footer">
            <b>현재 단계</b>
            <span>{latestAssistant?.text.slice(0, 84)}</span>
          </footer>
        </main>
      </div>
    </section>
  )
}
