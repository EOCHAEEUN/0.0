import { loginFeatureCards } from "../login.parts"

export function LoginHeroSection() {
  return (
    <div className="ff-login-hero">
      <div className="ff-login-hero-brand">
        <div className="ff-login-hero-brand-mark">F</div>

        <div>
          <strong>FactoFit</strong>
          <span>Manufacturing AI Advisor</span>
        </div>
      </div>

      <h1 className="ff-login-hero-title">
        제조업 의사결정을 위한
        <br />
        AI CFO + 정부지원금 비서
      </h1>

      <p className="ff-login-hero-copy">
        흩어진 제조업 지원 정보를 모아
        <br />
        우리 기업에 맞는 지원사업을 추천하고,
        <br />
        ROI 분석과 신청서 생성까지 도와드립니다.
      </p>

      <div className="ff-login-hero-cards">
        {loginFeatureCards.map(({ icon, line1, line2 }) => (
          <div key={`${line1}-${line2}`} className="ff-login-hero-card">
            <div className="ff-login-hero-card-icon">{icon}</div>
            <strong>
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
