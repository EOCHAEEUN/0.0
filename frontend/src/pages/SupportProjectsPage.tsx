import { useNavigate } from "react-router-dom"

const supportProjects = [
  {
    title: "KIAT 스마트 제조혁신 공정개선",
    desc: "설비투자 · 제조혁신 · 공정개선",
    org: "KIAT",
    amount: "8,000만원",
    deadline: "D-42",
    match: "92%",
    type: "urgent",
  },
  {
    title: "에너지공단 노후설비교체 지원",
    desc: "설비투자 · 제조혁신 · 공정개선",
    org: "에너지공단",
    amount: "1억 2,000만원",
    deadline: "D-67",
    match: "88%",
    type: "energy",
  },
  {
    title: "KOTRA 수출 인큐베이팅 프로그램",
    desc: "설비투자 · 제조혁신 · 공정개선",
    org: "KOTRA",
    amount: "컨설팅",
    deadline: "D-89",
    match: "74%",
    type: "export",
  },
  {
    title: "KICOX 산업단지 스마트공장 구축",
    desc: "설비투자 · 제조혁신 · 공정개선",
    org: "KICOX",
    amount: "1억 5,000만원",
    deadline: "D-112",
    match: "84%",
    type: "smart",
  },
]

const calendarItems = [
  {
    title: "KIAT 스마트공장",
    subtitle: "마감 일정 확인 필요",
    deadline: "D-42",
    className: "red",
  },
  {
    title: "에너지공단",
    subtitle: "마감 일정 확인 필요",
    deadline: "D-67",
    className: "amber",
  },
  {
    title: "KOTRA",
    subtitle: "마감 일정 확인 필요",
    deadline: "D-89",
    className: "blue",
  },
  {
    title: "KICOX",
    subtitle: "마감 일정 확인 필요",
    deadline: "D-112",
    className: "green",
  },
]

export default function SupportProjectsPage() {
  const navigate = useNavigate()

  return (
    <main className="factofit-page">
      <section className="factofit-section">
        <div className="factofit-container">
          <button
            type="button"
            onClick={() => navigate("/?screen=dashboard")}
            className="factofit-back-button"
          >
            ← 이전으로 돌아가기
          </button>

          <div className="mt-10">
            <p className="factofit-label">FactoFit Support Projects</p>

            <h1 className="factofit-title">지원사업 현황</h1>

            <p className="factofit-desc">
              안산금속(주)의 설비 상태와 투자 조건에 맞는 지원사업을
              마감일, 지원금액, 적합도 기준으로 정리했습니다.
            </p>
          </div>

          <div className="support-kpi-grid">
            <div className="support-kpi-card green">
              <span>매칭된 공고</span>
              <b>7건</b>
              <p>이번 분기 신규 3건 포함</p>
            </div>

            <div className="support-kpi-card blue">
              <span>예상 확보 가능 금액</span>
              <b>2.0억원</b>
              <p>보조금 합산 최대 기준</p>
            </div>

            <div className="support-kpi-card red">
              <span>가장 빠른 마감</span>
              <b>D-42</b>
              <p>KIAT 스마트 제조혁신</p>
            </div>
          </div>

          <div className="support-layout">
            <section className="support-calendar-card">
              <div className="support-card-header">
                <div>
                  <p className="support-eyebrow">Closing Schedule</p>
                  <h2>지원사업 캘린더</h2>
                </div>

                <span className="support-status-badge">2026 하반기</span>
              </div>

              <div className="support-calendar-list">
                {calendarItems.map((item) => (
                  <div
                    key={item.title}
                    className={`support-calendar-item ${item.className}`}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </div>

                    <b>{item.deadline}</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="support-ai-card">
              <p className="support-eyebrow">AI Matching Insight</p>

              <h2>팩토핏 추천 기준</h2>

              <p>
                유압 프레스 라인 A는 설비 연식, 에너지 비용, 교체 필요성
                측면에서 노후설비 교체형 지원사업과 가장 높은 적합도를
                보입니다.
              </p>

              <div className="support-ai-list">
                <div>
                  <span>최우선 검토</span>
                  <strong>KIAT 스마트 제조혁신 공정개선</strong>
                </div>

                <div>
                  <span>보조 매칭</span>
                  <strong>에너지공단 노후설비교체 지원</strong>
                </div>
              </div>
            </section>
          </div>

          <section className="support-table-card">
            <div className="support-card-header">
              <div>
                <p className="support-eyebrow">Matched Policies</p>
                <h2>추천 지원사업 목록</h2>
              </div>

              <span className="support-status-badge green">
                적합도 기준 정렬
              </span>
            </div>

            <div className="support-table">
              <div className="support-table-head">
                <div>지원사업명</div>
                <div>주관기관</div>
                <div>지원금액</div>
                <div>마감일</div>
                <div>적합도</div>
              </div>

              {supportProjects.map((item) => (
                <div
                  key={item.title}
                  onClick={() => navigate("/support-detail")}
                  className="support-table-row"
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.desc}</span>
                  </div>

                  <div>{item.org}</div>

                  <div className="amount">{item.amount}</div>

                  <div>
                    <span className={`deadline-badge ${item.type}`}>
                      {item.deadline}
                    </span>
                  </div>

                  <div className="match">{item.match}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}