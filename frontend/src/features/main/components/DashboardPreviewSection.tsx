import {
  dashboardAfterLoginCard,
  dashboardPreviewCard,
  dashboardSummaryCards,
} from "../main.parts"

type DashboardPreviewSectionProps = {
  onOpenDashboard: () => void
}

export function DashboardPreviewSection({ onOpenDashboard }: DashboardPreviewSectionProps) {
  return (
    <>
      <div className="ff-section-transition">
        <span>FROM SERVICE TO DASHBOARD</span>
      </div>

      <section className="ff-dashboard-section" id="dashboard">
        <div className="ff-section-container">
          <div className="ff-split-head">
            <div>
              <p className="ff-section-label">DASHBOARD EXPERIENCE</p>
              <h2>
                로그인 전엔 핵심만,
                <br />
                로그인 후엔 전체 관리.
              </h2>
            </div>

            <p>
              로그인 전에는 핵심 결과를 빠르게 확인하고, 로그인 후에는
              지원사업·ROI·신청 준비·안전점검을 한 화면에서 관리합니다.
            </p>
          </div>

          <div className="ff-dashboard-summary-shell">
            <div className="ff-dashboard-summary-grid">
              {dashboardSummaryCards.map((card) => (
                <article className="ff-dashboard-summary-card" key={card.title}>
                  <strong>{card.value}</strong>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="ff-dashboard-section-gap">
            <span>Preview to Dashboard</span>
          </div>

          <div className="ff-dashboard-compare-shell">
            <article className="ff-dashboard-compare-card ff-dashboard-compare-card-light">
              <span>{dashboardPreviewCard.label}</span>
              <h3>{dashboardPreviewCard.title}</h3>

              <ul>
                {dashboardPreviewCard.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="ff-dashboard-compare-card ff-dashboard-compare-card-dark">
              <span>{dashboardAfterLoginCard.label}</span>
              <h3>
                {Array.isArray(dashboardAfterLoginCard.title) ? (
                  <>
                    {dashboardAfterLoginCard.title[0]}
                    <br />
                    {dashboardAfterLoginCard.title[1]}
                  </>
                ) : (
                  dashboardAfterLoginCard.title
                )}
              </h3>

              <ul>
                {dashboardAfterLoginCard.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <button
                type="button"
                className="ff-dashboard-compare-button"
                onClick={onOpenDashboard}
              >
                대시보드 자세히 보기
              </button>
            </article>
          </div>
        </div>
      </section>
    </>
  )
}
