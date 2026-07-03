import type { RefObject } from "react"

type WhyTeaserSectionProps = {
  sectionRef: RefObject<HTMLElement | null>
  onOpenWhy: () => void
}

export function WhyTeaserSection({ sectionRef, onOpenWhy }: WhyTeaserSectionProps) {
  return (
    <section ref={sectionRef} className="ff-why-teaser-section">
      <div className="ff-why-teaser-media" aria-hidden="true">
        <video
          className="ff-why-teaser-video"
          src="/videos/why-factofit-bg-v2-35s-final.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="ff-why-teaser-video-overlay" />
      </div>

      <div className="ff-section-container">
        <div className="ff-why-teaser-copy">
          <p className="ff-section-label">WHY FACTOFIT</p>

          <h2>
            우리 공장의 설비투자 ROI와
            <br />
            숨은 정부 지원금을 1분 만에
            <br />
            확인하세요
          </h2>

          <p>
            노후 설비·에너지 비용·불량률을 입력하면 AI가 투자 시나리오,
            예상 지원금, 회수기간, 안전점검 리스크까지 한 번에 진단합니다.
          </p>

          <button type="button" className="ff-pill-button" onClick={onOpenWhy}>
            Why FactoFit 자세히 보기
          </button>
        </div>
      </div>
    </section>
  )
}
