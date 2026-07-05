import { Info, Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import botIcon from "../../assets/advisor/factofit-ai-bot.png"
import "../aiAdvisor/aiAdvisor.css"
import {
  formatEquipmentGuideReply,
  searchEquipmentGuide,
} from "./equipmentGuide.api"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

const QUICK_QUESTIONS = [
  { label: "설비 종류", query: "설비 종류" },
  { label: "설비명", query: "설비명" },
  { label: "사용연수", query: "설비 사용연수" },
  { label: "에너지 비용", query: "연간 에너지 비용" },
  { label: "공정", query: "공정" },
  { label: "불량률", query: "불량률" },
  { label: "유지보수", query: "유지보수 비용" },
  { label: "전체교체 투자금", query: "전체교체 투자금" },
  { label: "부분교체 투자금", query: "부분교체 투자금" },
] as const

export default function EquipmentGuideChatPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    messageEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages, open, isSending])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: trimmed },
    ])
    setInputValue("")
    setIsSending(true)

    try {
      const response = await searchEquipmentGuide(trimmed)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: formatEquipmentGuideReply(response),
        },
      ])
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "설비 가이드를 불러오지 못했습니다."
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: message },
      ])
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <section
      className="ff-advisor-popup-shell ff-equipment-guide-popup-shell"
      aria-label="설비 등록 도우미"
      role="dialog"
      aria-modal="true"
    >
      <div className="ff-advisor-popup-stage">
        <header className="ff-advisor-popup-head">
          <div className="ff-advisor-popup-brand">
            <img src={botIcon} alt="" className="ff-advisor-popup-brand-icon" />
            <strong>설비 등록 도우미</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </header>

        <div className="ff-advisor-popup-body">
          <div className="ff-advisor-embedded-page">
            <div className="ff-advisor-page-shell ff-advisor-page-shell--embedded">
              <div className="ff-advisor-page-grid">
                <article className="ff-advisor-chat-card ff-equipment-guide-chat-card">
                  <div className="ff-equipment-guide-scope-banner" role="note">
                    <span className="ff-equipment-guide-scope-icon" aria-hidden="true">
                      <Info size={16} strokeWidth={2.5} />
                    </span>
                    <div>
                      <strong>안내 범위</strong>
                      <p>
                        이 챗봇은 아래 설비 등록·수정 폼의 입력값(
                        <strong>설비 종류</strong>, <strong>설비명</strong>,{" "}
                        <strong>사용연수</strong>, <strong>에너지 비용</strong>,{" "}
                        <strong>투자금 등</strong>)만 설명합니다. ROI·지원사업·안전·신청서
                        등 다른 업무 질문은 지원하지 않습니다.
                      </p>
                    </div>
                  </div>

                  <div className="ff-advisor-message-row assistant ff-equipment-guide-intro">
                    <div className="ff-advisor-message-avatar">
                      <img src={botIcon} alt="" />
                      <span>AI Engi</span>
                    </div>
                    <div className="ff-advisor-message-stack">
                      <div className="ff-advisor-message assistant">
                        안녕하세요. 설비 등록 도우미 AI Engi입니다. 설비 등록·수정 폼에
                        입력할 항목별 작성 방법을 안내해 드립니다. 아래 버튼을 눌러 궁금한
                        항목을 선택해 주세요.
                      </div>
                    </div>
                  </div>

                  <div className="ff-equipment-guide-quick-grid" aria-label="입력 항목 빠른 질문">
                    {QUICK_QUESTIONS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        disabled={isSending}
                        onClick={() => void sendMessage(item.query)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="ff-advisor-message-list ff-equipment-guide-message-list">
                    {messages.map((message) =>
                      message.role === "user" ? (
                        <div
                          key={message.id}
                          className="ff-advisor-message-row user"
                        >
                          <div className="ff-advisor-message user">{message.text}</div>
                        </div>
                      ) : (
                        <div
                          key={message.id}
                          className="ff-advisor-message-row assistant"
                        >
                          <div className="ff-advisor-message-avatar">
                            <img src={botIcon} alt="" />
                            <span>AI Engi</span>
                          </div>
                          <div className="ff-advisor-message-stack">
                            <div className="ff-advisor-message assistant">
                              {message.text}
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                    {isSending ? (
                      <p className="ff-advisor-muted">가이드를 찾는 중...</p>
                    ) : null}
                    <div ref={messageEndRef} />
                  </div>

                  <div className="ff-advisor-composer">
                    <textarea
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          void sendMessage(inputValue)
                        }
                      }}
                      placeholder="설비 입력 항목만 질문하세요 (예: 사용연수)"
                      disabled={isSending}
                    />
                    <button
                      type="button"
                      className="ff-advisor-send-btn"
                      onClick={() => void sendMessage(inputValue)}
                      disabled={isSending || !inputValue.trim()}
                    >
                      {isSending ? "전송중" : "보내기"}
                      <Send size={15} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
