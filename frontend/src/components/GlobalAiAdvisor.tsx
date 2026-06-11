import { useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

type ChatMessage = {
  role: "ai" | "user"
  text: string
}

type ResizeDirection =
  | "right"
  | "left"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"

type WidgetSize = {
  width: number
  height: number
}

type WidgetPosition = {
  right: number
  bottom: number
}

const quickQuestions = ["ROI 설명", "지원사업 추천", "안전 리스크", "신청서 문장"]

const MIN_WIDTH = 360
const MIN_HEIGHT = 480
const MAX_WIDTH = 760
const MAX_HEIGHT = 780

function createWidgetAnswer(question: string) {
  const normalized = question.trim()

  if (!normalized) {
    return "질문을 입력해주시면 FactoFit AI가 ROI, 지원사업, 안전점검, 신청서 작성 흐름을 기준으로 답변드릴게요."
  }

  if (normalized.includes("ROI")) {
    return "ROI는 설비 투자금, 예상 절감액, 지원금 적용 후 실부담금, 회수기간을 함께 보는 지표입니다. FactoFit에서는 투자 판단 전에 먼저 회수 가능성과 부담 금액을 확인하는 흐름이 좋습니다."
  }

  if (normalized.includes("지원사업") || normalized.includes("지원금")) {
    return "지원사업은 업종, 지역, 설비 종류, 투자 목적, 기업 규모에 따라 달라집니다. 먼저 기업·설비 정보를 입력한 뒤 적합도와 마감일 기준으로 우선순위를 정리하는 방식이 좋습니다."
  }

  if (normalized.includes("안전")) {
    return "안전 리스크는 설비 노후도, 고장 이력, 점검 주기, 인증 필요 여부를 함께 봐야 합니다. 노후 설비 교체와 안전점검 일정을 지원사업 신청 흐름과 연결하면 실행력이 높아집니다."
  }

  if (normalized.includes("신청서") || normalized.includes("문장")) {
    return "신청서 문장은 ‘현재 설비 문제 → 교체 필요성 → 기대 효과 → 지원사업 활용 계획’ 순서로 쓰면 설득력이 좋아집니다. ROI 결과와 안전 리스크를 근거로 넣으면 더 탄탄해집니다."
  }

  return "좋은 질문이에요. FactoFit 기준으로는 먼저 현재 설비 상태와 투자 목적을 정리한 뒤, ROI 분석 → 지원사업 매칭 → 신청서 초안 → 안전점검 순서로 연결하는 것이 가장 자연스럽습니다."
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function GlobalAiAdvisor() {
  const navigate = useNavigate()
  const location = useLocation()

  const isPublicPage =
    location.pathname === "/main" || location.pathname === "/login"

  const widgetTitle = useMemo(() => {
    if (isPublicPage) return "Mini Advisor Chat"
    return "FactoFit AI"
  }, [isPublicPage])

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [size, setSize] = useState<WidgetSize>({
    width: 440,
    height: 560,
  })
  const [position, setPosition] = useState<WidgetPosition>({
    right: 28,
    bottom: 28,
  })

  const resizeStateRef = useRef<{
    direction: ResizeDirection
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    startRight: number
    startBottom: number
  } | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "안녕하세요. FactoFit AI입니다. ROI, 지원사업, 안전점검, 신청서 작성에 대해 질문해보세요.",
    },
  ])

  const handleSend = (value?: string) => {
    const question = (value ?? input).trim()
    if (!question) return

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: question,
      },
      {
        role: "ai",
        text: createWidgetAnswer(question),
      },
    ])

    setInput("")
  }

  const startResize = (
    event: React.MouseEvent<HTMLDivElement>,
    direction: ResizeDirection,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    resizeStateRef.current = {
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height,
      startRight: position.right,
      startBottom: position.bottom,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) return

      const deltaX = moveEvent.clientX - state.startX
      const deltaY = moveEvent.clientY - state.startY

      let nextWidth = state.startWidth
      let nextHeight = state.startHeight
      let nextRight = state.startRight
      let nextBottom = state.startBottom

      if (state.direction.includes("right")) {
        nextWidth = state.startWidth + deltaX
      }

      if (state.direction.includes("left")) {
        nextWidth = state.startWidth - deltaX
        nextRight = state.startRight + deltaX
      }

      if (state.direction.includes("bottom")) {
        nextHeight = state.startHeight + deltaY
      }

      if (state.direction.includes("top")) {
        nextHeight = state.startHeight - deltaY
        nextBottom = state.startBottom + deltaY
      }

      const viewportMaxWidth = Math.min(MAX_WIDTH, window.innerWidth - 36)
      const viewportMaxHeight = Math.min(MAX_HEIGHT, window.innerHeight - 36)

      const clampedWidth = clamp(nextWidth, MIN_WIDTH, viewportMaxWidth)
      const clampedHeight = clamp(nextHeight, MIN_HEIGHT, viewportMaxHeight)

      if (state.direction.includes("left")) {
        nextRight = state.startRight + (state.startWidth - clampedWidth)
      }

      if (state.direction.includes("top")) {
        nextBottom = state.startBottom + (state.startHeight - clampedHeight)
      }

      setSize({
        width: clampedWidth,
        height: clampedHeight,
      })

      setPosition({
        right: clamp(nextRight, 12, window.innerWidth - clampedWidth - 12),
        bottom: clamp(nextBottom, 12, window.innerHeight - clampedHeight - 12),
      })
    }

    const handleMouseUp = () => {
      resizeStateRef.current = null
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }

  return (
    <>
      <style>
        {`
          .ff-ai-widget-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .ff-ai-widget-scroll::-webkit-scrollbar {
            display: none;
          }

          .ff-ai-resize-handle {
            position: absolute;
            z-index: 4;
            background: transparent;
          }

          .ff-ai-resize-right {
            top: 18px;
            right: -5px;
            width: 10px;
            height: calc(100% - 36px);
            cursor: ew-resize;
          }

          .ff-ai-resize-left {
            top: 18px;
            left: -5px;
            width: 10px;
            height: calc(100% - 36px);
            cursor: ew-resize;
          }

          .ff-ai-resize-top {
            top: -5px;
            left: 18px;
            width: calc(100% - 36px);
            height: 10px;
            cursor: ns-resize;
          }

          .ff-ai-resize-bottom {
            bottom: -5px;
            left: 18px;
            width: calc(100% - 36px);
            height: 10px;
            cursor: ns-resize;
          }

          .ff-ai-resize-top-left {
            top: -7px;
            left: -7px;
            width: 18px;
            height: 18px;
            cursor: nwse-resize;
          }

          .ff-ai-resize-top-right {
            top: -7px;
            right: -7px;
            width: 18px;
            height: 18px;
            cursor: nesw-resize;
          }

          .ff-ai-resize-bottom-left {
            bottom: -7px;
            left: -7px;
            width: 18px;
            height: 18px;
            cursor: nesw-resize;
          }

          .ff-ai-resize-bottom-right {
            bottom: -7px;
            right: -7px;
            width: 18px;
            height: 18px;
            cursor: nwse-resize;
          }
        `}
      </style>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="FactoFit AI 열기"
          style={{
            position: "fixed",
            right: "28px",
            bottom: "28px",
            zIndex: 300,
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,.22)",
            background:
              "linear-gradient(135deg, #08162e 0%, #1f2b63 48%, #d6b15a 100%)",
            color: "#FFFFFF",
            fontSize: "24px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 24px 60px rgba(6,27,52,.28)",
          }}
        >
          AI
        </button>
      )}

      {open && (
        <section
          style={{
            position: "fixed",
            right: `${position.right}px`,
            bottom: `${position.bottom}px`,
            zIndex: 301,
            width: `${size.width}px`,
            height: `${size.height}px`,
            maxWidth: "calc(100vw - 36px)",
            maxHeight: "calc(100vh - 36px)",
            borderRadius: "28px",
            border: "1px solid rgba(201,151,63,.32)",
            background: "#F8FAFC",
            boxShadow: "0 34px 100px rgba(6,27,52,.28)",
            overflow: "hidden",
            display: "grid",
            gridTemplateRows: "104px 1fr",
          }}
        >
          <div
            className="ff-ai-resize-handle ff-ai-resize-right"
            onMouseDown={(event) => startResize(event, "right")}
          />
          <div
            className="ff-ai-resize-handle ff-ai-resize-left"
            onMouseDown={(event) => startResize(event, "left")}
          />
          <div
            className="ff-ai-resize-handle ff-ai-resize-top"
            onMouseDown={(event) => startResize(event, "top")}
          />
          <div
            className="ff-ai-resize-handle ff-ai-resize-bottom"
            onMouseDown={(event) => startResize(event, "bottom")}
          />
          <div
            className="ff-ai-resize-handle ff-ai-resize-top-left"
            onMouseDown={(event) => startResize(event, "top-left")}
          />
          <div
            className="ff-ai-resize-handle ff-ai-resize-top-right"
            onMouseDown={(event) => startResize(event, "top-right")}
          />
          <div
            className="ff-ai-resize-handle ff-ai-resize-bottom-left"
            onMouseDown={(event) => startResize(event, "bottom-left")}
          />
          <div
            className="ff-ai-resize-handle ff-ai-resize-bottom-right"
            onMouseDown={(event) => startResize(event, "bottom-right")}
          />

          <div
            style={{
              padding: "22px 24px",
              background:
                "linear-gradient(135deg, #061B34 0%, #1E2A61 72%, #283A7A 100%)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  borderRadius: "17px",
                  background: "#FFFFFF",
                  color: "#4D57B8",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "30px",
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                F
              </div>

              <div>
                <strong
                  style={{
                    display: "block",
                    fontSize: "24px",
                    lineHeight: 1.05,
                    fontWeight: 900,
                    letterSpacing: "-1px",
                  }}
                >
                  FactoFit AI
                </strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "6px",
                    color: "#E4C66D",
                    fontSize: "15px",
                    fontWeight: 900,
                  }}
                >
                  {widgetTitle}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="FactoFit AI 닫기"
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,.18)",
                background: "rgba(255,255,255,.1)",
                color: "#FFFFFF",
                fontSize: "34px",
                lineHeight: 1,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              minHeight: 0,
              padding: "22px 24px 20px",
              display: "grid",
              gridTemplateRows: "1fr auto",
              gap: "18px",
            }}
          >
            <div
              className="ff-ai-widget-scroll"
              style={{
                overflowY: "auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                paddingRight: "0",
              }}
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "92%",
                    padding: "15px 17px",
                    borderRadius:
                      message.role === "user"
                        ? "20px 20px 6px 20px"
                        : "20px 20px 20px 6px",
                    background: message.role === "user" ? "#061B34" : "#FFFFFF",
                    color: message.role === "user" ? "#FFFFFF" : "#344054",
                    border:
                      message.role === "user"
                        ? "0"
                        : "1px solid rgba(6,27,52,.1)",
                    boxShadow:
                      message.role === "user"
                        ? "0 18px 42px rgba(6,27,52,.18)"
                        : "0 16px 38px rgba(6,27,52,.06)",
                    fontSize: "14px",
                    lineHeight: 1.68,
                    fontWeight: 800,
                    wordBreak: "keep-all",
                  }}
                >
                  {message.text}
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "9px",
                  marginTop: "6px",
                }}
              >
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => handleSend(question)}
                    style={{
                      height: "38px",
                      padding: "0 15px",
                      borderRadius: "999px",
                      border: "1px solid rgba(201,151,63,.42)",
                      background: "#FFF9EA",
                      color: "#1F2A44",
                      fontSize: "13px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(6,27,52,.1)",
                paddingTop: "16px",
                display: "grid",
                gap: "12px",
              }}
            >
              {!isPublicPage && (
                <button
                  type="button"
                  onClick={() => navigate("/advisor")}
                  style={{
                    height: "48px",
                    borderRadius: "16px",
                    border: "1px solid rgba(201,151,63,.36)",
                    background: "#FFFDF6",
                    color: "#061B34",
                    fontSize: "15px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  전체 AI Advisor 열기 →
                </button>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 86px",
                  gap: "10px",
                }}
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSend()
                    }
                  }}
                  placeholder="질문 입력..."
                  style={{
                    height: "50px",
                    borderRadius: "16px",
                    border: "1px solid rgba(6,27,52,.12)",
                    background: "#FFFFFF",
                    padding: "0 17px",
                    color: "#061B34",
                    fontSize: "14px",
                    fontWeight: 800,
                    outline: "none",
                  }}
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  style={{
                    height: "50px",
                    borderRadius: "16px",
                    border: "0",
                    background: "#283A7A",
                    color: "#FFFFFF",
                    fontSize: "16px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  )
}