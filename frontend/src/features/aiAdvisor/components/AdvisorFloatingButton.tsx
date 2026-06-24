import botIcon from "../../../assets/aiAdvisor/factofit-ai-bot.png"

export function AdvisorFloatingButton({
  open,
  onClick,
}: {
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`ff-advisor-floating-button ${open ? "is-open" : ""}`}
      onClick={onClick}
      aria-label={open ? "AI Advisor 닫기" : "AI Advisor 열기"}
    >
      <span className="ff-advisor-floating-ring">
        <img src={botIcon} alt="" />
      </span>
    </button>
  )
}
