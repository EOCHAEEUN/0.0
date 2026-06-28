import { useState } from "react"
import { useNavigate } from "react-router-dom"

function getAnalysisDataForCurrentUser(): Record<string, unknown> | null {
  try {
    const authRaw = window.localStorage.getItem("factofit_auth_session")
    const userId = authRaw
      ? String((JSON.parse(authRaw) as Record<string, unknown>)?.userId ?? "")
      : ""
    const raw = window.localStorage.getItem("factofit_analysis_result")
    if (!raw) return null
    const data = JSON.parse(raw) as Record<string, unknown>
    if (userId && data.ownerId && String(data.ownerId) !== userId) return null
    return data
  } catch {
    return null
  }
}

type AdvisorMessage = {
  role: "user" | "ai"
  content: string
}

type QuickQuestion = {
  label: string
  prompt: string
}

type AdvisorAction = {
  title: string
  description: string
  path: string
  badge: string
  tone: "blue" | "green" | "orange" | "red"
}

type InsightItem = {
  label: string
  value: string
  score: number
  tone: "green" | "orange" | "red"
  description: string
}

const quickQuestions: QuickQuestion[] = [
  {
    label: "ROI가 괜찮은지 알려줘",
    prompt: "현재 프레스 설비 교체 ROI가 괜찮은지 알려줘.",
  },
  {
    label: "어떤 지원사업이 맞아?",
    prompt: "우리 설비투자 조건에 맞는 지원사업을 추천해줘.",
  },
  {
    label: "안전 리스크 요약해줘",
    prompt: "현재 설비의 안전 리스크를 요약해줘.",
  },
  {
    label: "신청서 문장 만들어줘",
    prompt: "지원사업 신청서에 넣을 사업 필요성 문장을 만들어줘.",
  },
]

const advisorActions: AdvisorAction[] = [
  {
    title: "ROI 분석",
    description: "투자금, 지원금, 절감액을 기준으로 회수기간을 계산합니다.",
    path: "/roi",
    badge: "ROI",
    tone: "blue",
  },
  {
    title: "지원사업 추천",
    description: "설비투자 조건에 맞는 정부지원사업을 우선순위로 보여줍니다.",
    path: "/support-projects",
    badge: "POLICY",
    tone: "green",
  },
  {
    title: "안전 진단",
    description: "노후 설비의 안전 리스크와 점검 우선순위를 확인합니다.",
    path: "/safety",
    badge: "SAFETY",
    tone: "orange",
  },
  {
    title: "신청서 초안",
    description: "ROI 분석 결과를 바탕으로 지원사업 신청서 초안을 만듭니다.",
    path: "/application-draft",
    badge: "DRAFT",
    tone: "red",
  },
]

const insightItems: InsightItem[] = [
  {
    label: "ROI",
    value: "85%",
    score: 85,
    tone: "green",
    description: "실부담금 대비 회수기간이 짧아 투자 적합도가 높습니다.",
  },
  {
    label: "지원사업 적합도",
    value: "92%",
    score: 92,
    tone: "green",
    description: "스마트공장 고도화 지원사업과 가장 잘 맞습니다.",
  },
  {
    label: "안전 리스크",
    value: "72점",
    score: 72,
    tone: "orange",
    description: "즉시 중단 수준은 아니지만 정밀점검이 필요합니다.",
  },
  {
    label: "신청 준비도",
    value: "73%",
    score: 73,
    tone: "orange",
    description: "견적서와 사업계획서 문장 보완이 필요합니다.",
  },
]

function getToneColor(tone: "green" | "orange" | "red") {
  if (tone === "green") return "#0B7A53"
  if (tone === "orange") return "#E65F00"
  return "#CD2E3A"
}

function getToneSoftColor(tone: "green" | "orange" | "red") {
  if (tone === "green") return "#E8F5EF"
  if (tone === "orange") return "#FFF2DF"
  return "#FDE8E9"
}

function createAdvisorAnswer(input: string) {
  const normalized = input.toLowerCase()

  if (
    normalized.includes("roi") ||
    normalized.includes("회수") ||
    normalized.includes("투자")
  ) {
    return "현재 입력값 기준으로 프레스 설비 교체 예상 ROI는 약 85% 수준입니다. 총 투자금 3.2억원, 예상 지원금 1.2억원을 적용하면 실부담금은 약 2.0억원이며, 예상 회수기간은 약 14개월입니다. 투자 회수기간이 짧은 편이므로 지원사업과 함께 검토하기 좋은 상태입니다."
  }

  if (
    normalized.includes("지원") ||
    normalized.includes("사업") ||
    normalized.includes("정책")
  ) {
    return "현재 조건에서는 스마트공장 구축 및 고도화 지원사업이 1순위로 적합합니다. 프레스 설비 교체와 스마트 모니터링 도입 목적이 명확하고, ROI 분석 결과 투자 회수기간도 짧기 때문에 신청서 작성 근거를 만들기 좋습니다."
  }

  if (
    normalized.includes("안전") ||
    normalized.includes("리스크") ||
    normalized.includes("노후")
  ) {
    return "현재 설비 안전 점수는 72/100 수준입니다. 즉시 중단이 필요한 단계는 아니지만, 설비 사용연수 11년, 불량률 5.8%, 유지보수비 증가 흐름을 고려하면 정밀점검과 설비 교체 검토가 필요합니다."
  }

  if (
    normalized.includes("신청서") ||
    normalized.includes("문장") ||
    normalized.includes("초안")
  ) {
    return "신청서에는 ‘노후 프레스 설비 교체를 통해 에너지 비용 절감, 불량률 개선, 생산성 향상을 달성하고자 한다’는 방향으로 작성하는 것이 좋습니다. 특히 ROI 분석 결과, 예상 회수기간, 지원금 적용 후 실부담금 감소를 근거로 넣으면 설득력이 높아집니다."
  }

  return "현재 FactoFit 분석 결과를 종합하면, 프레스 설비 교체는 ROI, 지원사업 적합도, 안전 리스크 측면에서 검토 가치가 높습니다. 다음 단계로는 견적서와 설비 사진을 준비하고, 스마트공장 고도화 지원사업 신청서 초안을 작성하는 흐름을 추천합니다."
}

export default function AiAdvisorPage() {
  const navigate = useNavigate()
  const hasAnalysisData = Boolean(getAnalysisDataForCurrentUser())

  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      role: "ai",
      content:
        "안녕하세요. FactoFit AI Advisor입니다. ROI, 지원사업, 안전진단, 신청서 초안에 대해 질문해보세요.",
    },
  ])

  const handleSend = (customPrompt?: string) => {
    const userInput = customPrompt ?? input

    if (!userInput.trim()) {
      return
    }

    const answer = createAdvisorAnswer(userInput)

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userInput,
      },
      {
        role: "ai",
        content: answer,
      },
    ])

    setInput("")
  }

  if (!hasAnalysisData) {
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
                <div className="screen-tag">Engi AI Advisor</div>
                <div className="label">AI DECISION ASSISTANT</div>
                <h2>
                  맞춤 투자 조언을 <br />
                  준비하고 있습니다.
                </h2>
              </div>
              <p className="section-desc">
                기업과 설비 정보를 입력하면 ROI, 지원사업, 안전 리스크를 종합해
                다음 행동을 안내해드립니다.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "8px",
                marginBottom: "48px",
              }}
            >
              <button
                type="button"
                className="btn blue"
                onClick={() => navigate("/setup/company")}
              >
                기업 정보 입력하기
              </button>
              <button
                type="button"
                className="btn dark"
                onClick={() => navigate("/company")}
              >
                설비 정보 등록하기
              </button>
            </div>
          </div>
        </section>
      </main>
    )
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
              <div className="screen-tag">FACTOFIT AI ADVISOR</div>
              <div className="label">AI DECISION ASSISTANT</div>
              <h2>
                설비투자 의사결정을 <br />
                AI 상담으로 연결합니다.
              </h2>
            </div>

            <p className="section-desc">
              ROI 분석, 지원사업 추천, 안전 리스크, 신청서 초안까지 사용자의
              질문에 맞춰 다음 행동을 안내합니다.
            </p>
          </div>

          <div
            className="summary-hero-card"
            style={{
              borderLeftColor: "#0047A0",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "0.95fr 1.05fr",
                gap: "28px",
                alignItems: "stretch",
              }}
            >
              <div>
                <span className="badge blue">AI 상담 준비 완료</span>

                <h3 style={{ marginTop: "18px" }}>
                  지금 가장 먼저 할 일은 <br />
                  지원사업 신청 준비입니다.
                </h3>

                <p>
                  ROI 분석 결과와 안전진단 결과를 종합하면, 프레스 설비 교체는
                  지원사업 신청 근거를 구성하기 좋은 상태입니다. 견적서와 설비
                  사진을 준비한 뒤 신청서 초안을 작성하는 흐름을 추천합니다.
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
                    onClick={() => navigate("/application-draft")}
                  >
                    신청서 초안 만들기
                  </button>

                  <button
                    className="btn dark"
                    type="button"
                    onClick={() => navigate("/support-projects")}
                  >
                    지원사업 다시 보기
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "14px",
                }}
              >
                {insightItems.map((item) => {
                  const color = getToneColor(item.tone)
                  const softColor = getToneSoftColor(item.tone)
                  const degree = item.score * 3.6

                  return (
                    <div
                      key={item.label}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "24px",
                        padding: "20px",
                        borderTop: `5px solid ${color}`,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "92px 1fr",
                          gap: "16px",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "92px",
                            height: "92px",
                            borderRadius: "50%",
                            background: `conic-gradient(${color} 0deg ${degree}deg, #E8EEF5 ${degree}deg 360deg)`,
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <div
                            style={{
                              width: "68px",
                              height: "68px",
                              borderRadius: "50%",
                              background: "#FFFFFF",
                              display: "grid",
                              placeItems: "center",
                              border: "1px solid #E2E8F0",
                            }}
                          >
                            <b
                              style={{
                                color,
                                fontFamily: "DM Mono, monospace",
                                fontSize: "20px",
                                fontWeight: 500,
                              }}
                            >
                              {item.score}
                            </b>
                          </div>
                        </div>

                        <div>
                          <strong
                            style={{
                              display: "block",
                              color: "#061B34",
                              fontSize: "16px",
                              fontWeight: 900,
                              marginBottom: "7px",
                            }}
                          >
                            {item.label}
                          </strong>

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              minHeight: "28px",
                              padding: "0 10px",
                              borderRadius: "999px",
                              background: softColor,
                              color,
                              fontSize: "12px",
                              fontWeight: 900,
                              marginBottom: "8px",
                            }}
                          >
                            {item.value}
                          </span>

                          <p
                            style={{
                              color: "#667085",
                              fontSize: "12px",
                              lineHeight: 1.6,
                              fontWeight: 800,
                            }}
                          >
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 360px",
              gap: "24px",
              alignItems: "start",
            }}
          >
            <section
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "32px",
                boxShadow: "0 24px 64px rgba(6,27,52,.10)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "26px 30px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "24px",
                      fontWeight: 900,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    AI Advisor 상담
                  </h3>

                  <p
                    style={{
                      marginTop: "8px",
                      color: "#667085",
                      fontSize: "14px",
                      fontWeight: 800,
                    }}
                  >
                    질문을 입력하거나 빠른 질문을 선택해보세요.
                  </p>
                </div>

                <span className="badge green">온라인</span>
              </div>

              <div
                style={{
                  padding: "28px",
                  display: "grid",
                  gap: "14px",
                  minHeight: "420px",
                  alignContent: "start",
                  background: "#F8FAFC",
                }}
              >
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent:
                        message.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "78%",
                        padding: "16px 18px",
                        borderRadius:
                          message.role === "user"
                            ? "22px 22px 6px 22px"
                            : "22px 22px 22px 6px",
                        background:
                          message.role === "user" ? "#344BA0" : "#FFFFFF",
                        color: message.role === "user" ? "#FFFFFF" : "#334155",
                        border:
                          message.role === "user"
                            ? "1px solid #344BA0"
                            : "1px solid #E2E8F0",
                        boxShadow: "0 10px 24px rgba(6,27,52,.06)",
                        fontSize: "14px",
                        lineHeight: 1.75,
                        fontWeight: 800,
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: "22px",
                  borderTop: "1px solid #E2E8F0",
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginBottom: "14px",
                  }}
                >
                  {quickQuestions.map((question) => (
                    <button
                      key={question.label}
                      type="button"
                      onClick={() => handleSend(question.prompt)}
                      style={{
                        border: "1px solid #BFDBFE",
                        background: "#EFF6FF",
                        color: "#0047A0",
                        padding: "9px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {question.label}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 110px",
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
                    placeholder="예: 이 설비 교체해도 괜찮을까?"
                    style={{
                      height: "54px",
                      border: "1px solid #E2E8F0",
                      borderRadius: "18px",
                      padding: "0 16px",
                      color: "#061B34",
                      fontSize: "15px",
                      fontWeight: 800,
                      outline: "none",
                    }}
                  />

                  <button
                    className="btn blue"
                    type="button"
                    onClick={() => handleSend()}
                  >
                    보내기
                  </button>
                </div>
              </div>
            </section>

            <aside
              style={{
                display: "grid",
                gap: "16px",
              }}
            >
              {advisorActions.map((action) => (
                <article
                  key={action.title}
                  className="card"
                  onClick={() => navigate(action.path)}
                  style={{
                    padding: "24px",
                    borderRadius: "26px",
                    cursor: "pointer",
                  }}
                >
                  <span className={`badge ${action.tone}`}>{action.badge}</span>

                  <h4
                    style={{
                      marginTop: "16px",
                      color: "#061B34",
                      fontSize: "20px",
                      lineHeight: 1.35,
                      fontWeight: 900,
                    }}
                  >
                    {action.title}
                  </h4>

                  <p
                    style={{
                      marginTop: "10px",
                      color: "#667085",
                      fontSize: "13px",
                      lineHeight: 1.7,
                      fontWeight: 800,
                    }}
                  >
                    {action.description}
                  </p>
                </article>
              ))}
            </aside>
          </div>

          <div className="details-wrap">
            <details open>
              <summary>AI가 추천하는 다음 액션</summary>

              <div className="detail-body">
                <div className="check-grid">
                  <div className="check-card">
                    <h4>신청서 초안 작성</h4>
                    <p>
                      ROI와 지원사업 적합도 근거가 충분하므로 신청서 초안을 먼저
                      작성하는 것이 좋습니다.
                    </p>
                  </div>

                  <div className="check-card orange">
                    <h4>견적서 준비</h4>
                    <p>
                      도입 예정 설비의 금액, 사양, 납품 조건이 포함된 견적서를
                      준비해야 합니다.
                    </p>
                  </div>

                  <div className="check-card red">
                    <h4>설비 사진 첨부</h4>
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