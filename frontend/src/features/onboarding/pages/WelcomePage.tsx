import { useNavigate } from "react-router-dom"
import { updateUserOnboardingState } from "../onboardingState"

const guideCards = [
  ["1단계 기업 정보", "기업명, 업종, 지역, 규모", "약 2분"],
  ["2단계 설비 및 투자 정보", "설비 종류, 투자 예산, 목적", "약 3분"],
  ["맞춤 결과 확인", "ROI 분석 · 지원사업 추천", "자동 생성"],
]

export default function WelcomePage() {
  const navigate = useNavigate()

  const handleLater = () => {
    updateUserOnboardingState({ welcomeDismissed: true })
    navigate("/dashboard")
  }

  return (
    <main className="ff-onboarding-page ff-welcome-page">
      <section className="ff-welcome-hero">
        <div className="ff-welcome-copy">
          <div className="ff-onboarding-logo">FactoFit</div>
          <p className="ff-onboarding-eyebrow">가입 완료</p>
          <h1>맞춤 투자 분석을 위한 정보를 알려주세요.</h1>
          <p>
            기업 규모와 업종, 설비 정보를 바탕으로 투자 ROI와
            받을 수 있는 지원사업을 더 정확하게 분석해드립니다.
          </p>
          <div className="ff-welcome-actions">
            <button
              type="button"
              className="ff-primary-action"
              onClick={() => navigate("/setup/company")}
            >
              맞춤 분석 설정 시작하기
            </button>
            <button type="button" className="ff-ghost-action" onClick={handleLater}>
              나중에 입력하고 둘러보기
            </button>
          </div>
        </div>

        <div className="ff-welcome-panel" aria-label="진단 준비 안내">
          {guideCards.map(([title, desc, time], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
              <small style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", display: "block", marginTop: "2px" }}>{desc}</small>
              <em>{time}</em>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
