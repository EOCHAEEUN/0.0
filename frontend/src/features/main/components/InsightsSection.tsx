import { insightChips } from "../main.parts"

type InsightsSectionProps = {
  newsletterEmail: string
  onNewsletterEmailChange: (value: string) => void
  onNewsletterSubmit: () => void
}

export function InsightsSection({
  newsletterEmail,
  onNewsletterEmailChange,
  onNewsletterSubmit,
}: InsightsSectionProps) {
  return (
    <section className="ff-insights-section" id="insights">
      <div className="ff-insights-panel">
        <div className="ff-insights-copy">
          <p className="ff-section-label">FACTOFIT INSIGHTS</p>

          <h2>
            흩어진 제조업 지원정보,
            <br />
            팩토핏이 정리합니다.
          </h2>

          <p>
            정부지원금 매칭부터 설비 진단, ROI 시뮬레이션까지 제조업
            의사결정 흐름을 하나로 연결합니다.
          </p>

          <div className="ff-insight-chip-grid">
            {insightChips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        </div>

        <div className="ff-newsletter-card">
          <h3>뉴스레터 신청</h3>
          <p>이메일을 남기면 팩토핏 인사이트 구독 완료 팝업이 표시됩니다.</p>

          <div className="ff-newsletter-form">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(event) => onNewsletterEmailChange(event.target.value)}
              placeholder="company@example.com"
            />

            <button type="button" onClick={onNewsletterSubmit}>
              구독하기
            </button>
          </div>

          <div className="ff-contact-line">
            <strong>Contact us</strong>
            <span>서비스 제휴 · 공공데이터 협력 · 제조기업 PoC 문의</span>
          </div>
        </div>
      </div>
    </section>
  )
}
