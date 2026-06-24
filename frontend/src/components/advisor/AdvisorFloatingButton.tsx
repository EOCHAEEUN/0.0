export function AdvisorFloatingButton({
  open,
  onClick,
}: {
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`factofit-advisor-fab ${open ? "is-open" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={open ? "FactoFit AI 닫기" : "FactoFit AI 열기"}
    >
      <span className="factofit-advisor-fab-mark">AI</span>
    </button>
  )
}
