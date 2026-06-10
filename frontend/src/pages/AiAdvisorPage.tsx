import { useState } from "react"

type Message = {
  role: "ai" | "user"
  text: string
}

export default function AiAdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "안녕하세요. FactoFit AI 어드바이저입니다. 안산금속(주)의 설비투자, 지원사업, 안전점검 일정을 함께 확인해드릴게요.",
    },
    {
      role: "ai",
      text: "현재 유압 프레스 라인 A는 교체 권고 상태입니다. 예상 지원금은 1.24억원, 회수기간은 약 1.4년으로 분석됩니다.",
    },
  ])

  const [input, setInput] = useState("")

  const quickQuestions = [
    "ROI 분석 결과 알려줘",
    "추천 지원사업 알려줘",
    "신청서 초안 만들어줘",
    "안전점검 일정 확인해줘",
  ]

  const getAiReply = (text: string) => {
    if (text.includes("ROI") || text.includes("roi")) {
      return "유압 프레스 라인 A의 예상 투자금은 1.5억원, 예상 지원금은 1.24억원입니다. 연간 에너지 절감과 불량 감소 효과를 반영하면 회수기간은 약 1.4년으로 분석됩니다."
    }

    if (text.includes("지원사업") || text.includes("보조금")) {
      return "현재 가장 적합한 지원사업은 스마트공장 구축 및 고도화 지원사업입니다. 예상 지원금은 최대 1억원 이상이며, 적합도는 92%로 가장 높습니다."
    }

    if (text.includes("신청서")) {
      return "신청서 초안에는 기업명, 대상 설비, 신청 목적, 기대 효과, AI 작성 문장을 포함하는 것이 좋습니다. 현재 데이터 기준으로 초안 생성이 가능합니다."
    }

    if (text.includes("안전점검") || text.includes("점검")) {
      return "현재 KTL 전기안전 정기검사가 D-67로 예정되어 있습니다. KOSHA 화학물질 취급 안전점검은 미완료 상태라 우선 확인이 필요합니다."
    }

    return "좋아요. 해당 내용을 기준으로 설비 상태, ROI, 지원사업, 안전점검 관점에서 다시 분석해드릴게요."
  }

  const sendMessage = (text?: string) => {
    const value = (text ?? input).trim()
    if (!value) return

    const userMessage: Message = {
      role: "user",
      text: value,
    }

    const aiMessage: Message = {
      role: "ai",
      text: getAiReply(value),
    }

    setMessages((prev) => [...prev, userMessage, aiMessage])
    setInput("")
  }

  return (
    <div className="ai-chat-page">
      <div className="ai-chat-shell">
        <header className="ai-chat-header">
          <div className="ai-chat-profile">
            <div className="ai-chat-avatar">AI</div>
            <div>
              <h1>FactoFit AI 어드바이저</h1>
              <p>설비투자 · 지원사업 · 안전점검 통합 상담</p>
            </div>
          </div>

          <span className="ai-chat-status">online</span>
        </header>

        <main className="ai-chat-body">
          <div className="ai-chat-date">오늘</div>

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`ai-chat-message ${message.role}`}
            >
              <div className="ai-chat-bubble">{message.text}</div>
            </div>
          ))}
        </main>

        <section className="ai-chat-quick">
          {quickQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => sendMessage(question)}
            >
              {question}
            </button>
          ))}
        </section>

        <footer className="ai-chat-input-area">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                sendMessage()
              }
            }}
            placeholder="질문을 입력하세요..."
          />

          <button type="button" onClick={() => sendMessage()}>
            전송
          </button>
        </footer>
      </div>
    </div>
  )
}