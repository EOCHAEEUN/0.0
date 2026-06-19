import { heroMetrics } from "../main.parts"

type MainHeroSectionProps = {
  onScrollToWhy: () => void
}

export function MainHeroSection({ onScrollToWhy }: MainHeroSectionProps) {
  return (
    <section className="ff-hero-section">
      <div className="ff-hero-video-placeholder" aria-hidden="true">
        <video
          className="ff-hero-video"
          src="/videos/main-hero-video.mp4"
          poster="/images/factofit-main-hero-video-15s-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="ff-hero-video-overlay" />
      </div>

      <div className="ff-hero-content">
        <p className="ff-hero-kicker">FACTOFIT ONE-PAGE AI DIAGNOSIS</p>

        <h1>
          지원사업을 찾기 전에,
          <br />
          <span>우리 공장에 맞게</span>
          <br />
          먼저 해석합니다
        </h1>

        <p className="ff-hero-description">
          <span>흩어진 제조업 지원정보를 모아 지원사업 추천,</span>
          <span>ROI 분석, 신청 준비까지 하나의 흐름으로 연결합니다.</span>
        </p>

        <div className="ff-hero-metrics">
          {heroMetrics.map((metric) => (
            <div key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="ff-scroll-arrow"
        onClick={onScrollToWhy}
        aria-label="Why FactoFit 섹션으로 이동"
      >
        ↓
      </button>
    </section>
  )
}
