import { sustainabilityValues } from "../main.parts"

type SustainabilitySectionProps = {
  onOpenDashboard: () => void
}

export function SustainabilitySection({ onOpenDashboard }: SustainabilitySectionProps) {
  return (
    <section className="ff-sustainability-section" id="sustainability">
      <div className="ff-sustainability-head">
        <div>
          <div className="ff-gold-line" />
          <p className="ff-section-label">SUSTAINABILITY</p>
          <h2>
            팩토핏이 만드는
            <br />
            지속가능경영
          </h2>
        </div>

        <p>
          팩토핏의 지속가능경영은 선언이 아니라, 현장의 비용·생산성·재무·안전
          리스크를 숫자로 관리하는 방식입니다.
        </p>
      </div>

      <div className="ff-sustainability-board">
        <div className="ff-sustainability-media">
          <div>
            <h3>
              지속가능한 제조업은
              <br />
              정확한 투자 판단에서 시작됩니다.
            </h3>
            <button type="button" onClick={onOpenDashboard}>
              대시보드 보기
            </button>
          </div>
        </div>

        <div className="ff-sustainability-value-grid">
          {sustainabilityValues.map((value) => (
            <article key={value.title}>
              <h3>{value.title}</h3>
              <span>{value.subtitle}</span>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
