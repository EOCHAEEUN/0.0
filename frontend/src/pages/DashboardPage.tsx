import { useState } from "react"
import { useNavigate } from "react-router-dom"
import AppHeader from "../components/AppHeader"

type Tone = "green" | "blue" | "orange" | "red"

type OpenPanel = "company" | "equipment" | null

type KpiCard = {
  label: string
  value: string
  description: string
  tone: Tone
}

type ServiceCard = {
  title: string
  description: string
  badge: string
  path: string
  tone: Tone
}

type ProcessItem = {
  step: string
  title: string
  status: string
  description: string
  score: number
  grade: string
  tone: Tone
  icon: string
  supportProgram: string
  expectedSupport: string
  applicationStatus: string
  nextStep: string
  roi: string
  payback: string
}

type ReasonItem = {
  title: string
  description: string
}

type DdayItem = {
  title: string
  amount: string
  dday: string
}

const kpiCards: KpiCard[] = [
  {
    label: "예상 지원금",
    value: "8,200만원",
    description: "기업 조건 기준 산정",
    tone: "green",
  },
  {
    label: "지원사업",
    value: "8건",
    description: "우선 검토 3건 포함",
    tone: "blue",
  },
  {
    label: "예상 ROI",
    value: "98%",
    description: "투자효과 시뮬레이션",
    tone: "orange",
  },
  {
    label: "회수기간",
    value: "1.3년",
    description: "지원금 적용 기준",
    tone: "red",
  },
]

const serviceCards: ServiceCard[] = [
  {
    title: "지원사업 추천",
    description:
      "기업 조건과 설비투자 목적에 맞는 정부지원사업을 우선순위로 정리합니다.",
    badge: "POLICY",
    path: "/support-projects",
    tone: "green",
  },
  {
    title: "ROI 시뮬레이션",
    description:
      "총 투자금, 지원금, 절감액을 기준으로 실부담금과 회수기간을 계산합니다.",
    badge: "ROI",
    path: "/roi",
    tone: "blue",
  },
  {
    title: "안전 진단",
    description:
      "노후 설비, 유지보수 이력, 불량률을 바탕으로 안전 리스크를 점검합니다.",
    badge: "SAFETY",
    path: "/safety",
    tone: "orange",
  },
  {
    title: "AI Advisor",
    description:
      "설비투자, 지원사업, 신청서 작성 과정에서 필요한 질문에 답변합니다.",
    badge: "AI",
    path: "/advisor",
    tone: "red",
  },
]

const processItems: ProcessItem[] = [
  {
    step: "01",
    title: "원자재 투입",
    status: "정상",
    description: "기초 항목 2건",
    score: 76,
    grade: "B등급",
    tone: "orange",
    icon: "▦",
    supportProgram: "원자재 공정 개선 지원",
    expectedSupport: "2,000만원",
    applicationStatus: "보완 후 가능",
    nextStep: "공정 자료 정리",
    roi: "112%",
    payback: "2.1년",
  },
  {
    step: "02",
    title: "CNC 가공",
    status: "검토 필요",
    description: "관련 항목 1건",
    score: 88,
    grade: "A등급",
    tone: "green",
    icon: "⚙",
    supportProgram: "고효율 설비 교체 지원사업",
    expectedSupport: "4,000만원",
    applicationStatus: "검토 추천",
    nextStep: "설비 견적 확인",
    roi: "241%",
    payback: "1.6년",
  },
  {
    step: "03",
    title: "프레스 성형",
    status: "우선 대상",
    description: "핵심 카드 5건",
    score: 96,
    grade: "S등급",
    tone: "blue",
    icon: "▣",
    supportProgram: "스마트공장 고도화 지원사업",
    expectedSupport: "5,000만원",
    applicationStatus: "즉시 준비 가능",
    nextStep: "ROI 계산",
    roi: "347%",
    payback: "1.3년",
  },
  {
    step: "04",
    title: "품질 검사",
    status: "개선 가능",
    description: "연계 항목 2건",
    score: 92,
    grade: "S등급",
    tone: "blue",
    icon: "▤",
    supportProgram: "품질관리 자동화 지원사업",
    expectedSupport: "3,800만원",
    applicationStatus: "신청 가능",
    nextStep: "검사 데이터 정리",
    roi: "298%",
    payback: "1.5년",
  },
  {
    step: "05",
    title: "포장 / 출하",
    status: "안정",
    description: "연계 항목 1건",
    score: 74,
    grade: "B등급",
    tone: "orange",
    icon: "↗",
    supportProgram: "물류 자동화 개선 지원",
    expectedSupport: "2,500만원",
    applicationStatus: "보완 필요",
    nextStep: "자동화 범위 검토",
    roi: "86%",
    payback: "2.8년",
  },
]

const reasonItems: ReasonItem[] = [
  {
    title: "노후설비 교체 지원 대상",
    description:
      "유압 프레스 라인 A는 15년 사용 설비로 교체 권고 기준에 진입했습니다.",
  },
  {
    title: "업종 평균 교체주기 초과",
    description:
      "금속 가공업의 주요 생산설비 교체주기와 비교했을 때 점검 및 교체 검토가 필요합니다.",
  },
  {
    title: "에너지효율화 사업 신청 가능",
    description:
      "전기요금 절감 목적이 명확해 고효율 설비 교체 지원사업과도 연결됩니다.",
  },
  {
    title: "예상 지원금 확보 가능성 높음",
    description:
      "스마트공장 고도화 및 에너지 효율 개선 계열 사업에서 지원 가능성이 높습니다.",
  },
  {
    title: "ROI 우수",
    description:
      "예상 ROI가 높고 회수기간이 짧아 투자효과 설명 근거로 활용하기 좋습니다.",
  },
]

const ddayItems: DdayItem[] = [
  {
    title: "KIAT 스마트공정개선",
    amount: "최대 8,000만원",
    dday: "D-42",
  },
  {
    title: "에너지공단 노후설비교체",
    amount: "최대 1억 2,000만원",
    dday: "D-67",
  },
  {
    title: "KICOX 스마트공장 구축",
    amount: "최대 1억 5,000만원",
    dday: "D-112",
  },
]

function getToneColor(tone: Tone) {
  if (tone === "green") return "#0B7A53"
  if (tone === "blue") return "#344BA0"
  if (tone === "orange") return "#E65F00"
  return "#CD2E3A"
}

function getToneSoftColor(tone: Tone) {
  if (tone === "green") return "#E8F5EF"
  if (tone === "blue") return "#EEF6FF"
  if (tone === "orange") return "#FFF2DF"
  return "#FDE8E9"
}

function getEquipmentGradient(tone: Tone) {
  if (tone === "green") {
    return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #E8F5EF 45%, #F8FAFC 100%)"
  }

  if (tone === "blue") {
    return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #EAF1FF 45%, #F8FAFC 100%)"
  }

  if (tone === "orange") {
    return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FFF2DF 45%, #F8FAFC 100%)"
  }

  return "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FDE8E9 45%, #F8FAFC 100%)"
}

function getProcessTooltipLeft(step: string) {
  if (step === "01") return "12%"
  if (step === "02") return "28%"
  if (step === "03") return "50%"
  if (step === "04") return "72%"
  return "88%"
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [showGradeGuide, setShowGradeGuide] = useState(false)
  const [hoveredProcessStep, setHoveredProcessStep] = useState<string | null>(
    null,
  )
  const [showAllReasons, setShowAllReasons] = useState(false)
  const [showAllDdays, setShowAllDdays] = useState(false)

  const selectedProcess =
    processItems.find((item) => item.step === hoveredProcessStep) ?? null

  const summaryProcess =
    processItems.find((item) => item.step === hoveredProcessStep) ??
    processItems[2]

  const visibleReasons = showAllReasons ? reasonItems : reasonItems.slice(0, 1)
  const visibleDdays = showAllDdays ? ddayItems : ddayItems.slice(0, 1)

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  return (
    <main className="page">
      <AppHeader />

      <section
        style={{
          padding: "44px clamp(22px,5vw,80px) 44px",
          background: "#F8FAFC",
        }}
      >
        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "0 auto",
            background: "#061B34",
            color: "#FFFFFF",
            borderRadius: "32px",
            padding: "56px",
            boxShadow: "0 28px 74px rgba(6,27,52,.16)",
          }}
        >
          <div>
            <div
              style={{
                color: "#A9CDF7",
                fontSize: "13px",
                letterSpacing: "3px",
                fontWeight: 900,
                marginBottom: "18px",
              }}
            >
              FACTOFIT INTELLIGENCE
            </div>

            <h1
              style={{
                maxWidth: "760px",
                fontSize: "56px",
                lineHeight: 1.14,
                letterSpacing: "-2px",
                fontWeight: 900,
                marginBottom: "28px",
              }}
            >
              기업 조건에 맞는 <br />
              지원사업을 AI가 매칭합니다
            </h1>

            <p
              style={{
                maxWidth: "560px",
                color: "#D8E4F2",
                fontSize: "18px",
                lineHeight: 1.8,
                fontWeight: 800,
              }}
            >
              설비 현황과 기업 정보를 기반으로 지원금 · ROI · 신청 우선순위를
              함께 분석합니다.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: openPanel === null ? "1fr 1fr" : "1fr",
              gap: "22px",
              marginTop: "42px",
            }}
          >
            {(openPanel === null || openPanel === "company") && (
              <div
                style={{
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.16)",
                  borderRadius: "26px",
                  padding: "28px",
                }}
              >
                <button
                  type="button"
                  onClick={() => togglePanel("company")}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "0",
                    color: "#FFFFFF",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <h3
                    style={{
                      color: "#FFFFFF",
                      fontSize: "20px",
                      fontWeight: 900,
                    }}
                  >
                    🏢 기업정보 보기
                  </h3>

                  <span style={{ color: "#FFFFFF", fontWeight: 900 }}>
                    {openPanel === "company" ? "−" : "+"}
                  </span>
                </button>

                {openPanel === "company" && (
                  <div style={{ marginTop: "22px" }}>
                    {[
                      ["업종", "금속 가공업"],
                      ["지역", "경기 안산시"],
                      ["종업원", "45명"],
                      ["기업규모", "중소기업"],
                      ["주요목적", "설비 교체 / 에너지 절감"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "13px 0",
                          borderTop: "1px solid rgba(255,255,255,.12)",
                          color: "#E5EEF8",
                          fontSize: "15px",
                          fontWeight: 900,
                        }}
                      >
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(openPanel === null || openPanel === "equipment") && (
              <div
                style={{
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.16)",
                  borderRadius: "26px",
                  padding: "28px",
                }}
              >
                <button
                  type="button"
                  onClick={() => togglePanel("equipment")}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "0",
                    color: "#FFFFFF",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <h3
                    style={{
                      color: "#FFFFFF",
                      fontSize: "20px",
                      fontWeight: 900,
                    }}
                  >
                    ⚙ 설비현황 보기
                  </h3>

                  <span style={{ color: "#FFFFFF", fontWeight: 900 }}>
                    {openPanel === "equipment" ? "−" : "+"}
                  </span>
                </button>

                {openPanel === "equipment" && (
                  <div style={{ marginTop: "22px" }}>
                    {[
                      ["유압 프레스 라인 A", "15년 · 교체 권고"],
                      ["CNC 선반 B-3호기", "11년 · 점검 필요"],
                      ["자동 용접기 W-2", "4년 · 정상"],
                    ].map(([title, status]) => (
                      <div
                        key={title}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "16px",
                          padding: "15px 0",
                          borderTop: "1px solid rgba(255,255,255,.12)",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display: "block",
                              color: "#FFFFFF",
                              fontSize: "16px",
                              fontWeight: 900,
                            }}
                          >
                            {title}
                          </strong>

                          <span
                            style={{
                              display: "block",
                              color: "#BFD0E3",
                              marginTop: "4px",
                              fontSize: "12px",
                              fontWeight: 800,
                            }}
                          >
                            주요 공정 설비
                          </span>
                        </div>

                        <span
                          style={{
                            color: "#E5EEF8",
                            fontSize: "13px",
                            fontWeight: 900,
                          }}
                        >
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "28px auto 0",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "18px",
          }}
        >
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="card"
              style={{
                padding: "26px",
                borderRadius: "26px",
                borderLeft: `7px solid ${getToneColor(card.tone)}`,
              }}
            >
              <span
                style={{
                  display: "block",
                  color: "#667085",
                  fontSize: "13px",
                  fontWeight: 900,
                  marginBottom: "12px",
                }}
              >
                {card.label}
              </span>

              <b
                style={{
                  display: "block",
                  color: getToneColor(card.tone),
                  fontFamily: "DM Mono, monospace",
                  fontSize: "34px",
                  fontWeight: 500,
                  letterSpacing: "-1px",
                }}
              >
                {card.value}
              </b>

              <p
                style={{
                  marginTop: "10px",
                  color: "#667085",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: "#F3F6FA",
          padding: "76px clamp(22px,5vw,80px)",
        }}
      >
        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.9fr",
              gap: "40px",
              alignItems: "end",
              marginBottom: "34px",
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  width: "122px",
                  height: "4px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, #C68B3C 50%, rgba(255,255,255,0) 100%)",
                  marginBottom: "18px",
                }}
              />

              <div className="screen-tag">POLICY MATCHING FLOW</div>

              <div
                className="label"
                style={{
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                PROCESS BASED MATCHING
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                <h2
                  style={{
                    color: "#061B34",
                    fontSize: "52px",
                    lineHeight: 1.12,
                    fontWeight: 900,
                    letterSpacing: "-1.8px",
                    margin: 0,
                  }}
                >
                  지원사업 매칭 현황
                </h2>

                <button
                  type="button"
                  onMouseEnter={() => setShowGradeGuide(true)}
                  onMouseLeave={() => setShowGradeGuide(false)}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    border: "1px solid #BFDBFE",
                    background: "#EEF6FF",
                    color: "#344BA0",
                    fontSize: "20px",
                    fontWeight: 900,
                    cursor: "help",
                    flexShrink: 0,
                  }}
                >
                  i
                </button>

                {showGradeGuide && (
                  <div
                    style={{
                      position: "absolute",
                      top: "54px",
                      left: "250px",
                      zIndex: 50,
                      width: "370px",
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "22px",
                      padding: "24px",
                      boxShadow: "0 24px 64px rgba(6,27,52,.16)",
                    }}
                  >
                    <h3
                      style={{
                        color: "#061B34",
                        fontSize: "20px",
                        fontWeight: 900,
                        marginBottom: "14px",
                      }}
                    >
                      적합도 등급 기준
                    </h3>

                    <p
                      style={{
                        color: "#344BA0",
                        fontSize: "17px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      S등급: 90~100% / 즉시 추천
                    </p>

                    <p
                      style={{
                        color: "#0B7A53",
                        fontSize: "17px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      A등급: 80~89% / 검토 추천
                    </p>

                    <p
                      style={{
                        color: "#E65F00",
                        fontSize: "17px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      B등급: 70~79% / 보완 필요
                    </p>

                    <p
                      style={{
                        color: "#CD2E3A",
                        fontSize: "17px",
                        fontWeight: 900,
                      }}
                    >
                      C등급: 70% 미만 / 낮은 적합도
                    </p>
                  </div>
                )}
              </div>

              <div
                style={{
                  width: "130px",
                  height: "3px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, rgba(52,75,160,0) 100%)",
                  marginTop: "24px",
                }}
              />
            </div>

            <p
              style={{
                color: "#667085",
                fontSize: "16px",
                lineHeight: 1.8,
                fontWeight: 900,
                margin: 0,
              }}
            >
              설비별로 연결 가능한 지원사업과 신청 우선순위를 확인하세요.
              마우스를 올리면 해당 설비 근처에 상세 매칭 정보가 표시됩니다.
            </p>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "34px",
              padding: "34px",
              boxShadow: "0 24px 64px rgba(6,27,52,.10)",
              overflow: "visible",
            }}
          >
            <div
              onMouseLeave={() => setHoveredProcessStep(null)}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: "16px",
                position: "relative",
                minHeight: "420px",
              }}
            >
              {processItems.map((item) => {
                const selected = item.step === hoveredProcessStep
                const color = getToneColor(item.tone)
                const softColor = getToneSoftColor(item.tone)

                return (
                  <article
                    key={item.step}
                    onMouseEnter={() => setHoveredProcessStep(item.step)}
                    onClick={() => setHoveredProcessStep(item.step)}
                    style={{
                      position: "relative",
                      background: "#FFFFFF",
                      border: selected
                        ? "4px solid #344BA0"
                        : "1px solid #E2E8F0",
                      borderRadius: "28px",
                      padding: "24px",
                      minHeight: "400px",
                      boxShadow: selected
                        ? "0 24px 58px rgba(52,75,160,.18)"
                        : "0 10px 25px rgba(0,0,0,0.04)",
                      transition: "all .18s ease",
                      cursor: "pointer",
                      zIndex: selected ? 3 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "20px",
                      }}
                    >
                      <b
                        style={{
                          color: "#667085",
                          fontFamily: "DM Mono, monospace",
                          fontSize: "28px",
                          fontWeight: 500,
                        }}
                      >
                        {item.step}
                      </b>

                      <span
                        style={{
                          background: softColor,
                          color,
                          padding: "8px 11px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 900,
                        }}
                      >
                        {item.grade} {item.score}%
                      </span>
                    </div>

                    <div
                      style={{
                        height: "150px",
                        borderRadius: "24px",
                        background: getEquipmentGradient(item.tone),
                        border: "1px solid #E2E8F0",
                        display: "grid",
                        placeItems: "center",
                        marginBottom: "28px",
                        boxShadow: "inset 0 -36px 60px rgba(6,27,52,.04)",
                      }}
                    >
                      <div
                        style={{
                          width: "82px",
                          height: "82px",
                          borderRadius: "24px",
                          background: "#061B34",
                          color: "#FFFFFF",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "36px",
                          boxShadow: `0 22px 44px ${color}33`,
                        }}
                      >
                        {item.icon}
                      </div>
                    </div>

                    <h3
                      style={{
                        color: "#061B34",
                        fontSize: "24px",
                        lineHeight: 1.25,
                        fontWeight: 900,
                        letterSpacing: "-0.5px",
                        marginBottom: "12px",
                      }}
                    >
                      {item.title}
                    </h3>

                    <strong
                      style={{
                        display: "block",
                        color,
                        fontSize: "15px",
                        fontWeight: 900,
                        marginBottom: "8px",
                      }}
                    >
                      {item.status}
                    </strong>

                    <p
                      style={{
                        color: "#667085",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        fontWeight: 800,
                      }}
                    >
                      {item.description}
                    </p>
                  </article>
                )
              })}

              {selectedProcess && (
                <div
                  style={{
                    position: "absolute",
                    top: "58px",
                    left: getProcessTooltipLeft(selectedProcess.step),
                    transform: "translateX(-50%)",
                    width: "330px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "28px",
                    padding: "26px",
                    zIndex: 20,
                    boxShadow: "0 34px 76px rgba(6,27,52,.18)",
                    pointerEvents: "none",
                  }}
                >
                  <h3
                    style={{
                      color: "#061B34",
                      fontSize: "30px",
                      lineHeight: 1.2,
                      fontWeight: 900,
                      letterSpacing: "-0.8px",
                      marginBottom: "18px",
                    }}
                  >
                    {selectedProcess.title}
                  </h3>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginBottom: "20px",
                    }}
                  >
                    <span className="badge green">지원 가능</span>
                    <span className="badge blue">우선 추천</span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: "999px",
                        padding: "7px 11px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        color: "#667085",
                        fontSize: "12px",
                        fontWeight: 900,
                      }}
                    >
                      추천 대상
                    </span>
                  </div>

                  {[
                    ["지원사업", selectedProcess.supportProgram],
                    ["예상 지원금", selectedProcess.expectedSupport],
                    ["적합도", `${selectedProcess.score}%`],
                    ["신청 가능", selectedProcess.applicationStatus],
                    ["다음 단계", selectedProcess.nextStep],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "110px 1fr",
                        gap: "16px",
                        padding: "14px 0",
                        borderTop: "1px solid #E2E8F0",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          color: "#667085",
                          fontSize: "16px",
                          fontWeight: 900,
                        }}
                      >
                        {label}
                      </span>

                      <strong
                        style={{
                          color: "#061B34",
                          fontSize: "18px",
                          fontWeight: 900,
                          textAlign: "right",
                          lineHeight: 1.35,
                        }}
                      >
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className="summary-hero-card"
            style={{
              marginTop: "28px",
              borderLeftColor: "#344BA0",
              padding: "30px 34px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
                gap: "20px",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  color: "#061B34",
                  fontSize: "28px",
                  fontWeight: 900,
                  letterSpacing: "-0.6px",
                }}
              >
                AI 추천 요약
              </h3>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  추천 설비
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#061B34",
                    fontSize: "26px",
                    fontWeight: 900,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.title}
                </b>
              </div>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  예상 지원금
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#344BA0",
                    fontFamily: "DM Mono, monospace",
                    fontSize: "30px",
                    fontWeight: 500,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.expectedSupport}
                </b>
              </div>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  예상 ROI
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#061B34",
                    fontFamily: "DM Mono, monospace",
                    fontSize: "30px",
                    fontWeight: 500,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.roi}
                </b>
              </div>

              <div>
                <span
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                    fontWeight: 900,
                  }}
                >
                  회수기간
                </span>

                <b
                  style={{
                    display: "block",
                    color: "#061B34",
                    fontFamily: "DM Mono, monospace",
                    fontSize: "30px",
                    fontWeight: 500,
                    marginTop: "8px",
                  }}
                >
                  {summaryProcess.payback}
                </b>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              marginTop: "28px",
            }}
          >
            <div
              className="card"
              style={{
                padding: "32px",
                borderRadius: "32px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <h3
                  style={{
                    color: "#061B34",
                    fontSize: "28px",
                    fontWeight: 900,
                    letterSpacing: "-0.6px",
                  }}
                >
                  추천 근거
                </h3>

                <button
                  type="button"
                  onClick={() => setShowAllReasons((prev) => !prev)}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#667085",
                    fontSize: "22px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {showAllReasons ? "−" : "+"}
                </button>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {visibleReasons.map((reason) => (
                  <div
                    key={reason.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px 1fr",
                      gap: "14px",
                      alignItems: "start",
                    }}
                  >
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "50%",
                        background: "#E8F5EF",
                        color: "#0B7A53",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                      }}
                    >
                      ✓
                    </span>

                    <div>
                      <strong
                        style={{
                          display: "block",
                          color: "#061B34",
                          fontSize: "17px",
                          fontWeight: 900,
                          marginBottom: "6px",
                        }}
                      >
                        {reason.title}
                      </strong>

                      <p
                        style={{
                          color: "#667085",
                          fontSize: "14px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                        }}
                      >
                        {reason.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: "32px",
                borderRadius: "32px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center",
                  marginBottom: "24px",
                }}
              >
                <h3
                  style={{
                    color: "#061B34",
                    fontSize: "28px",
                    fontWeight: 900,
                    letterSpacing: "-0.6px",
                  }}
                >
                  🚨 D-DAY 공고
                </h3>

                <button
                  type="button"
                  onClick={() => setShowAllDdays((prev) => !prev)}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#667085",
                    fontSize: "22px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {showAllDdays ? "−" : "+"}
                </button>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {visibleDdays.map((item) => (
                  <div
                    key={item.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "16px",
                      alignItems: "center",
                      padding: "18px 0",
                      borderTop: "1px solid #E2E8F0",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          display: "block",
                          color: "#061B34",
                          fontSize: "18px",
                          fontWeight: 900,
                          marginBottom: "6px",
                        }}
                      >
                        {item.title}
                      </strong>

                      <span
                        style={{
                          color: "#667085",
                          fontSize: "15px",
                          fontWeight: 900,
                        }}
                      >
                        {item.amount}
                      </span>
                    </div>

                    <b
                      style={{
                        color: "#E65F00",
                        fontFamily: "DM Mono, monospace",
                        fontSize: "28px",
                        fontWeight: 500,
                      }}
                    >
                      {item.dday}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#FFFFFF",
          padding: "76px clamp(22px,5vw,80px) 100px",
        }}
      >
        <div
          style={{
            width: "min(1180px, 100%)",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 0.9fr",
              gap: "40px",
              alignItems: "end",
              marginBottom: "34px",
            }}
          >
            <div>
              <div
                style={{
                  width: "122px",
                  height: "4px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, #C68B3C 50%, rgba(255,255,255,0) 100%)",
                  marginBottom: "18px",
                }}
              />

              <div className="screen-tag">FACTOFIT SERVICE MENU</div>

              <div
                className="label"
                style={{
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
              >
                QUICK ACCESS
              </div>

              <h2
                style={{
                  color: "#061B34",
                  fontSize: "52px",
                  lineHeight: 1.12,
                  fontWeight: 900,
                  letterSpacing: "-1.8px",
                  margin: 0,
                }}
              >
                서비스 바로가기
              </h2>

              <div
                style={{
                  width: "130px",
                  height: "3px",
                  borderRadius: "999px",
                  background:
                    "linear-gradient(90deg, #344BA0 0%, rgba(52,75,160,0) 100%)",
                  marginTop: "24px",
                }}
              />
            </div>

            <p
              style={{
                color: "#667085",
                fontSize: "16px",
                lineHeight: 1.8,
                fontWeight: 900,
                margin: 0,
              }}
            >
              ROI 분석, 지원사업 추천, 안전 진단, AI 상담 화면으로 바로
              이동할 수 있습니다.
            </p>
          </div>

          <div
            className="card"
            style={{
              borderRadius: "32px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "34px",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "18px",
              }}
            >
              {serviceCards.map((service) => (
                <article
                  className="card"
                  key={service.title}
                  style={{
                    padding: "28px",
                    borderRadius: "28px",
                    cursor: "pointer",
                    minHeight: "260px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                  onClick={() => navigate(service.path)}
                >
                  <div>
                    <span className={`badge ${service.tone}`}>
                      {service.badge}
                    </span>

                    <h3
                      style={{
                        marginTop: "18px",
                        color: "#061B34",
                        fontSize: "24px",
                        lineHeight: 1.3,
                        fontWeight: 900,
                        letterSpacing: "-0.6px",
                      }}
                    >
                      {service.title}
                    </h3>

                    <p
                      style={{
                        marginTop: "12px",
                        color: "#667085",
                        fontSize: "14px",
                        lineHeight: 1.75,
                        fontWeight: 800,
                      }}
                    >
                      {service.description}
                    </p>
                  </div>

                  <button
                    className="btn blue"
                    type="button"
                    style={{
                      marginTop: "24px",
                      width: "100%",
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      navigate(service.path)
                    }}
                  >
                    바로가기
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}