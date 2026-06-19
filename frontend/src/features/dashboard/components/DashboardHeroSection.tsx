import { getToneColor, type KpiCard, type OpenPanel } from "../dashboard.parts"
import type {
  CompanySummaryRow,
  EquipmentSummaryRow,
} from "../mappers/dashboardMapper"

type DashboardHeroSectionProps = {
  openPanel: OpenPanel
  togglePanel: (panel: Exclude<OpenPanel, null>) => void
  companyRows: CompanySummaryRow[]
  equipmentRows: EquipmentSummaryRow[]
  kpiCards: KpiCard[]
}

export function DashboardHeroSection({
  openPanel,
  togglePanel,
  companyRows,
  equipmentRows,
  kpiCards,
}: DashboardHeroSectionProps) {
  return (
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
                  {companyRows.map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        padding: "13px 0",
                        borderTop: "1px solid rgba(255,255,255,.12)",
                        color: "#E5EEF8",
                        fontSize: "15px",
                        fontWeight: 900,
                      }}
                    >
                      <span>{row.label}</span>
                      <strong style={{ textAlign: "right" }}>{row.value}</strong>
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
                  {equipmentRows.map((equipment) => (
                    <div
                      key={equipment.title}
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
                          {equipment.title}
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
                          {equipment.subtitle}
                        </span>
                      </div>

                      <span
                        style={{
                          color: "#E5EEF8",
                          fontSize: "13px",
                          fontWeight: 900,
                        }}
                      >
                        {equipment.status}
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
  )
}
