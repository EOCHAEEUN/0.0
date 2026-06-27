import { useNavigate } from "react-router-dom"
import { updateUserOnboardingState } from "../onboardingState"

const guideCards = [
  ["기업 조건 등록", "약 2분"],
  ["투자 설비·예산 입력", "약 3분"],
  ["ROI·맞춤 지원사업 확인", "자동 생성"],
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
          <p className="ff-onboarding-eyebrow">WELCOME</p>
          <h1>첫 투자 분석을 바로 시작해볼까요?</h1>
          <p>
            기업 정보와 검토할 설비 조건을 입력하면 예상 ROI, 지원사업,
            신청서 준비 우선순위를 한 흐름으로 정리해드립니다.
          </p>
          <div className="ff-welcome-actions">
            <button
              type="button"
              className="ff-primary-action"
              onClick={() => navigate("/setup/company")}
            >
              기업 진단 시작하기
            </button>
            <button type="button" className="ff-ghost-action" onClick={handleLater}>
              나중에 입력하기
            </button>
          </div>
        </div>

        <div className="ff-welcome-panel" aria-label="진단 준비 안내">
          {guideCards.map(([title, time], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{title}</strong>
              <em>{time}</em>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
