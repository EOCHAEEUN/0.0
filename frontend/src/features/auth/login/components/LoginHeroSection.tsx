import { loginFeatureCards } from "../login.parts"

export function LoginHeroSection() {
  return (
    <div
      style={{
        maxWidth: "720px",
        justifySelf: "start",
        transform: "translateY(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "48px",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: "#FFFFFF",
            color: "#344BA0",
            display: "grid",
            placeItems: "center",
            fontSize: "28px",
            fontWeight: 900,
            boxShadow: "0 14px 34px rgba(0,0,0,.16)",
          }}
        >
          F
        </div>

        <div>
          <strong
            style={{
              display: "block",
              fontSize: "28px",
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-.8px",
            }}
          >
            FactoFit
          </strong>

          <span
            style={{
              display: "block",
              marginTop: "6px",
              color: "#DCE7F5",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            Manufacturing AI Advisor
          </span>
        </div>
      </div>

      <h1
        style={{
          margin: "0 0 34px",
          color: "#FFFFFF",
          fontSize: "clamp(52px, 5vw, 78px)",
          lineHeight: 1.12,
          letterSpacing: "-3.2px",
          fontWeight: 900,
          textShadow: "0 18px 48px rgba(0,0,0,.24)",
        }}
      >
        제조업 의사결정을 위한
        <br />
        AI CFO + 정부지원금 비서
      </h1>

      <p
        style={{
          margin: "0 0 48px",
          color: "#E9F0FA",
          fontSize: "19px",
          lineHeight: 1.85,
          fontWeight: 800,
          textShadow: "0 10px 32px rgba(0,0,0,.22)",
        }}
      >
        흩어진 제조업 지원 정보를 모아
        <br />
        우리 기업에 맞는 지원사업을 추천하고,
        <br />
        ROI 분석과 신청서 생성까지 도와드립니다.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "14px",
          maxWidth: "640px",
        }}
      >
        {loginFeatureCards.map(({ icon, line1, line2 }) => (
          <div
            key={`${line1}-${line2}`}
            style={{
              minHeight: "108px",
              borderRadius: "18px",
              border: "1px solid rgba(255,255,255,.16)",
              background: "rgba(10,24,46,.46)",
              backdropFilter: "blur(10px)",
              display: "grid",
              placeItems: "center",
              alignContent: "center",
              textAlign: "center",
              padding: "18px 12px",
              boxShadow: "0 18px 42px rgba(0,0,0,.20)",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                background: "rgba(255,255,255,.14)",
                display: "grid",
                placeItems: "center",
                marginBottom: "12px",
                color: "#FFFFFF",
                fontSize: "18px",
                fontWeight: 900,
              }}
            >
              {icon}
            </div>

            <strong
              style={{
                color: "#FFFFFF",
                fontSize: "14px",
                lineHeight: 1.45,
                fontWeight: 900,
              }}
            >
              {line1}
              <br />
              {line2}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}
