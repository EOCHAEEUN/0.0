import { Info, MessageCircle, Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import guideBotIcon from "../../assets/advisor/engi-bot-transparent.png"
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
  { label: "사용연수", query: "설비 사용연수" },
  { label: "에너지 비용", query: "연간 에너지 비용" },
  { label: "불량률", query: "불량률" },
  { label: "유지보수", query: "유지보수 비용" },
  { label: "A안 투자금", query: "전체교체" },
  { label: "B안 투자금", query: "부분교체" },
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

  if (!open || typeof document === "undefined") return null

  const hasConversation = messages.length > 0

  return createPortal(
    <>
      <button
        type="button"
        className="ff-equipment-guide-chat__backdrop"
        aria-label="챗봇 닫기"
        onClick={onClose}
      />
      <section
        className="ff-equipment-guide-chat"
        aria-label="설비 등록 가이드 챗봇"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ff-equipment-guide-chat__header">
          <div className="ff-equipment-guide-chat__brand">
            <span className="ff-equipment-guide-chat__brand-icon" aria-hidden="true">
              <img src={guideBotIcon} alt="" />
            </span>
            <div className="ff-equipment-guide-chat__brand-copy">
              <span className="ff-equipment-guide-chat__brand-kicker">EQUIPMENT GUIDE</span>
              <strong className="ff-equipment-guide-chat__brand-title">설비 등록 도우미</strong>
            </div>
          </div>
          <button
            type="button"
            className="ff-equipment-guide-chat__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="ff-equipment-guide-chat__scope-banner" role="note">
          <span className="ff-equipment-guide-chat__scope-icon" aria-hidden="true">
            <Info size={18} strokeWidth={2.5} />
          </span>
          <div>
            <strong>안내 범위</strong>
            <p>
              이 챗봇은 아래 설비 등록·수정 폼의 입력값(
              <strong>설비 종류</strong>, <strong>설비명</strong>,{" "}
              <strong>사용연수</strong>, <strong>에너지 비용</strong>,{" "}
              <strong>투자금 등</strong>)만 설명합니다. ROI·지원사업·안전·신청서 등
              다른 업무 질문은 지원하지 않습니다.
            </p>
          </div>
        </div>

        <div className="ff-equipment-guide-chat__quick">
          <p className="ff-equipment-guide-chat__quick-label">⚡ 입력 항목 빠른 질문</p>
          <div className="ff-equipment-guide-chat__quick-grid">
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
        </div>

        <div className="ff-equipment-guide-chat__messages">
          {!hasConversation ? (
            <div className="ff-equipment-guide-chat__welcome">
              <MessageCircle
                className="ff-equipment-guide-chat__welcome-icon"
                size={34}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <p>
                아래 버튼을 누르거나 항목명을 입력하면
                <br />
                입력 방법을 안내해 드립니다.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`ff-equipment-guide-chat__message ${message.role}`}
                >
                  {message.text}
                </article>
              ))}
              {isSending ? (
                <p className="ff-equipment-guide-chat__loading">가이드를 찾는 중...</p>
              ) : null}
              <div ref={messageEndRef} />
            </>
          )}
        </div>

        <form
          className="ff-equipment-guide-chat__composer"
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage(inputValue)
          }}
        >
          <div className="ff-equipment-guide-chat__input-row">
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="설비 입력 항목만 질문하세요 (예: 사용연수)"
              disabled={isSending}
            />
            <button type="submit" disabled={isSending || !inputValue.trim()}>
              전송
              <Send size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="ff-equipment-guide-chat__powered">
            POWERED BY FACTOFIT INDUSTRIAL INTELLIGENCE
          </p>
        </form>
      </section>
    </>,
    document.body,
  )
}
