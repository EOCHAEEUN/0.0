import { businessCards } from "../main.parts"

type BusinessSectionProps = {
  onOpenServices: () => void
}

export function BusinessSection({ onOpenServices }: BusinessSectionProps) {
  return (
    <section className="ff-business-section">
      <div className="ff-wide-container">
        <div className="ff-business-head">
          <h2>OUR BUSINESS</h2>

          <button type="button" className="ff-pill-button" onClick={onOpenServices}>
            주요서비스 보기
          </button>
        </div>

        <div className="ff-business-card-grid">
          {businessCards.map((card) => (
            <button
              type="button"
              className="ff-business-card"
              onClick={onOpenServices}
              key={card.label}
            >
              <div className={`ff-business-media ${card.mediaClassName}`} />
              <div className="ff-business-card-copy">
                <span>{card.label}</span>
                <h3>
                  {card.titleLines[0]}
                  <br />
                  {card.titleLines[1]}
                </h3>
                <p>{card.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
