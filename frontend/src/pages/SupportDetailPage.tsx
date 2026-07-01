import { useLocation, useNavigate } from "react-router-dom"

import { resolveApplicationDraftNavigationPath } from "../features/roi/roiNavigation"

type Requirement = {
  label: string
  status: "충족" | "확인 필요" | "보완 필요"
  score: number
  tone: "green" | "orange" | "red"
  description: string
}

type TimelineItem = {
  step: string
  title: string
  date: string
  description: string
  tone: "green" | "blue" | "orange" | "red"
}

type DocumentItem = {
  title: string
  description: string
  status: "준비 완료" | "확인 필요" | "작성 필요"
  tone: "green" | "orange" | "red"
}

const requirements: Requirement[] = [
  {
    label: "업종 적합성",
    status: "충족",
    score: 96,
    tone: "green",
    description: "금속가공 제조업으로 스마트공장 고도화 지원 대상에 적합합니다.",
  },
  {
    label: "투자 목적",
    status: "충족",
    score: 94,
    tone: "green",
    description: "프레스 설비 교체와 스마트 모니터링 도입 목적이 명확합니다.",
  },
  {
    label: "ROI 근거",
    status: "충족",
    score: 92,
    tone: "green",
    description: "예상 회수기간 14개월로 사업성 근거를 제시하기 좋습니다.",
  },
  {
    label: "증빙자료",
    status: "확인 필요",
    score: 64,
    tone: "orange",
    description: "견적서, 설비 사진, 유지보수 내역 첨부가 필요합니다.",
  },
]

const timelineItems: TimelineItem[] = [
  {
    step: "01",
    title: "사업 공고 확인",
    date: "06.10 ~ 06.14",
    description: "신청 자격, 지원 한도, 제출 서류를 확인합니다.",
    tone: "green",
  },
  {
    step: "02",
    title: "견적서 및 증빙자료 준비",
    date: "06.15 ~ 06.18",
    description: "도입 설비 견적서와 기존 설비 사진을 정리합니다.",
    tone: "blue",
  },
  {
    step: "03",
    title: "사업계획서 초안 작성",
    date: "06.18 ~ 06.19",
    description: "ROI 분석 결과를 바탕으로 신청 사유와 기대효과를 작성합니다.",
    tone: "orange",
  },
  {
    step: "04",
    title: "최종 제출",
    date: "06.20",
    description: "필수 서류를 첨부하고 신청서를 제출합니다.",
    tone: "red",
  },
]

const documents: DocumentItem[] = [
  {
    title: "사업자등록증",
    description: "기업 기본정보 확인을 위한 필수 서류입니다.",
    status: "준비 완료",
    tone: "green",
  },
  {
    title: "설비 견적서",
    description: "도입 예정 설비의 금액, 사양, 납품 조건이 포함되어야 합니다.",
    status: "확인 필요",
    tone: "orange",
  },
  {
    title: "기존 설비 사진",
    description: "노후 설비 상태와 교체 필요성을 보여주는 자료입니다.",
    status: "확인 필요",
    tone: "orange",
  },
  {
    title: "사업계획서",
    description: "도입 목적, 기대효과, 비용 절감 근거를 문장으로 정리합니다.",
    status: "작성 필요",
    tone: "red",
  },
]

function getToneColor(tone: "green" | "blue" | "orange" | "red") {
  if (tone === "green") return "#0B7A53"
  if (tone === "blue") return "#0047A0"
  if (tone === "orange") return "#E65F00"
  return "#CD2E3A"
}

function getToneSoftColor(tone: "green" | "blue" | "orange" | "red") {
  if (tone === "green") return "#E8F5EF"
  if (tone === "blue") return "#EEF6FF"
  if (tone === "orange") return "#FFF2DF"
  return "#FDE8E9"
}

export default function SupportDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleApplicationDraftNavigation = async () => {
    navigate(await resolveApplicationDraftNavigationPath(location.pathname, location.search))
  }

  return (
    <main className="page">
      <section className="section white">
        <div className="container">
          <button
            type="button"
            onClick={() => navigate("/support-projects")}
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
            ← 지원사업 목록으로 돌아가기
          </button>

          <div className="section-head">
            <div>
              <div className="screen-tag">FACTOFIT SUPPORT DETAIL</div>
              <div className="label">PROJECT DETAIL</div>
              <h2>
                스마트공장 고도화 지원사업, <br />
                신청 가능성을 상세 분석합니다.
              </h2>
            </div>

            <p className="section-desc">
              지원사업의 신청 조건, 예상 지원금, 제출 준비도, 사업계획서 작성
              포인트를 한 화면에서 확인할 수 있습니다.
            </p>
          </div>

          <div
            className="summary-hero-card"
            style={{
              borderLeftColor: "#0B7A53",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 300px",
                gap: "34px",
                alignItems: "center",
              }}
            >
              <div>
                <span className="badge green">1순위 추천</span>

                <h3 style={{ marginTop: "18px" }}>
                  스마트공장 구축 및 <br />
                  고도화 지원사업
                </h3>

                <p>
                  프레스 설비 교체와 스마트 모니터링 시스템 도입 목적에 가장
                  적합한 지원사업입니다. 현재 ROI 분석 결과와 설비 교체
                  필요성이 명확해 신청서 작성 근거를 구성하기 좋은 상태입니다.
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
                    onClick={() => void handleApplicationDraftNavigation()}
                  >
                    신청서 초안 만들기
                  </button>

                  <button
                    className="btn dark"
                    type="button"
                    onClick={() => navigate("/roi")}
                  >
                    ROI 다시 보기
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "30px",
                  padding: "28px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: "190px",
                    height: "190px",
                    margin: "0 auto",
                    borderRadius: "50%",
                    background:
                      "conic-gradient(#344BA0 0deg 331.2deg, #E8EEF5 331.2deg 360deg)",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 18px 38px rgba(52,75,160,.12)",
                  }}
                >
                  <div
                    style={{
                      width: "142px",
                      height: "142px",
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <b
                        style={{
                          display: "block",
                          color: "#344BA0",
                          fontFamily: "DM Mono, monospace",
                          fontSize: "56px",
                          lineHeight: 1,
                          fontWeight: 500,
                          letterSpacing: "-3px",
                        }}
                      >
                        92
                      </b>

                      <span
                        style={{
                          display: "block",
                          color: "#667085",
                          fontSize: "18px",
                          fontWeight: 900,
                          marginTop: "4px",
                        }}
                      >
                        /100
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "24px", textAlign: "center" }}>
                  <span className="badge green">매우 적합</span>

                  <p
                    style={{
                      marginTop: "12px",
                      color: "#667085",
                      fontSize: "14px",
                      lineHeight: 1.7,
                      fontWeight: 800,
                    }}
                  >
                    지원사업 적합도와 신청 준비도를 종합한 결과입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="policy-summary">
            <div className="mini-stat">
              <span>예상 지원금</span>
              <b>1억</b>
            </div>

            <div className="mini-stat">
              <span>마감일</span>
              <b>06/20</b>
            </div>

            <div className="mini-stat">
              <span>신청 준비도</span>
              <b>73%</b>
            </div>

            <div className="mini-stat">
              <span>적합도</span>
              <b>92%</b>
            </div>
          </div>

          <div className="details-wrap">
            <details open>
              <summary>신청 적합성 평가</summary>

              <div className="detail-body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "18px",
                  }}
                >
                  {requirements.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "24px",
                        padding: "22px",
                        borderLeft: `6px solid ${getToneColor(item.tone)}`,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "14px",
                          alignItems: "center",
                          marginBottom: "14px",
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              color: "#061B34",
                              fontSize: "18px",
                              fontWeight: 900,
                              marginBottom: "6px",
                            }}
                          >
                            {item.label}
                          </h4>

                          <span
                            style={{
                              color: getToneColor(item.tone),
                              fontSize: "13px",
                              fontWeight: 900,
                            }}
                          >
                            {item.status}
                          </span>
                        </div>

                        <b
                          style={{
                            color: getToneColor(item.tone),
                            fontFamily: "DM Mono, monospace",
                            fontSize: "30px",
                            fontWeight: 500,
                          }}
                        >
                          {item.score}%
                        </b>
                      </div>

                      <div
                        style={{
                          height: "10px",
                          background: "#E8EEF5",
                          borderRadius: "999px",
                          overflow: "hidden",
                          marginBottom: "14px",
                        }}
                      >
                        <i
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${item.score}%`,
                            background: getToneColor(item.tone),
                            borderRadius: "999px",
                          }}
                        />
                      </div>

                      <p
                        style={{
                          color: "#667085",
                          fontSize: "14px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                        }}
                      >
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <details open>
              <summary>신청 일정 로드맵</summary>

              <div className="detail-body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "16px",
                  }}
                >
                  {timelineItems.map((item) => (
                    <article
                      key={item.step}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderTop: `6px solid ${getToneColor(item.tone)}`,
                        borderRadius: "24px",
                        padding: "24px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          background: getToneSoftColor(item.tone),
                          color: getToneColor(item.tone),
                          fontFamily: "DM Mono, monospace",
                          fontSize: "16px",
                          fontWeight: 500,
                          marginBottom: "18px",
                        }}
                      >
                        {item.step}
                      </span>

                      <h4
                        style={{
                          color: "#061B34",
                          fontSize: "18px",
                          lineHeight: 1.35,
                          fontWeight: 900,
                          marginBottom: "8px",
                        }}
                      >
                        {item.title}
                      </h4>

                      <strong
                        style={{
                          display: "block",
                          color: getToneColor(item.tone),
                          fontSize: "13px",
                          fontWeight: 900,
                          marginBottom: "10px",
                        }}
                      >
                        {item.date}
                      </strong>

                      <p
                        style={{
                          color: "#667085",
                          fontSize: "13px",
                          lineHeight: 1.7,
                          fontWeight: 800,
                        }}
                      >
                        {item.description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </details>

            <details>
              <summary>필수 제출 서류</summary>

              <div className="detail-body">
                <div className="check-grid">
                  {documents.map((doc) => (
                    <div
                      className={`check-card ${
                        doc.tone === "orange"
                          ? "orange"
                          : doc.tone === "red"
                            ? "red"
                            : ""
                      }`}
                      key={doc.title}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          alignItems: "flex-start",
                          marginBottom: "10px",
                        }}
                      >
                        <h4>{doc.title}</h4>

                        <span
                          style={{
                            flexShrink: 0,
                            padding: "6px 9px",
                            borderRadius: "999px",
                            background: getToneSoftColor(doc.tone),
                            color: getToneColor(doc.tone),
                            fontSize: "11px",
                            fontWeight: 900,
                          }}
                        >
                          {doc.status}
                        </span>
                      </div>

                      <p>{doc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <details>
              <summary>신청서 작성 포인트</summary>

              <div className="detail-body">
                <div className="scenario-grid">
                  <div className="scenario best">
                    <h4>강조할 내용</h4>
                    <p>
                      단순 설비 구매가 아니라 노후 프레스 설비 교체와 스마트
                      모니터링 시스템 도입을 통한 생산성 향상, 에너지 절감,
                      불량률 개선 목적을 명확히 쓰는 것이 좋습니다.
                    </p>

                    <div className="saving-list">
                      <div className="saving">
                        <span>투자 회수기간</span>
                        <b>14개월</b>
                      </div>

                      <div className="saving">
                        <span>예상 지원금</span>
                        <b>1억원</b>
                      </div>

                      <div className="saving">
                        <span>지원사업 적합도</span>
                        <b>92%</b>
                      </div>
                    </div>
                  </div>

                  <div className="scenario">
                    <h4>주의할 내용</h4>
                    <p>
                      지원사업 신청서에서는 “설비가 오래되었다”는 설명만으로는
                      부족합니다. 전기요금, 유지보수비, 불량 손실, 생산 중단
                      위험처럼 수치화 가능한 근거를 함께 제시해야 합니다.
                    </p>

                    <div className="saving-list">
                      <div className="saving">
                        <span>필수 첨부</span>
                        <b>견적서</b>
                      </div>

                      <div className="saving">
                        <span>보완 자료</span>
                        <b>설비 사진</b>
                      </div>

                      <div className="saving">
                        <span>작성 필요</span>
                        <b>사업계획서</b>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="hero-actions"
                  style={{
                    justifyContent: "center",
                    marginTop: "30px",
                  }}
                >
                  <button
                    className="btn blue"
                    type="button"
                    onClick={() => void handleApplicationDraftNavigation()}
                  >
                    이 내용으로 신청서 초안 만들기
                  </button>

                  <button
                    className="btn dark"
                    type="button"
                    onClick={() => navigate("/support-projects")}
                  >
                    다른 지원사업 비교하기
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}