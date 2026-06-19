import type { ServiceCard } from "../dashboard.parts"

type ServiceShortcutSectionProps = {
  serviceCards: ServiceCard[]
  onNavigate: (path: string) => void
}

export function ServiceShortcutSection({
  serviceCards,
  onNavigate,
}: ServiceShortcutSectionProps) {
  return (
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
                  onClick={() => onNavigate(service.path)}
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
                      onNavigate(service.path)
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
  )
}
