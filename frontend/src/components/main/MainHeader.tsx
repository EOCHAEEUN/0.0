type MainHeaderProps = {
  onLoginClick: () => void
  onWhyClick: () => void
  onServicesClick: () => void
  onDashboardClick: () => void
  onSupportClick: () => void
}

export default function MainHeader({
  onLoginClick,
  onWhyClick,
  onServicesClick,
  onDashboardClick,
  onSupportClick,
}: MainHeaderProps) {
  return (
    <header className="ff-main-header">
      <button
        type="button"
        className="ff-main-logo"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="ff-main-logo-mark">F</span>

        <span className="ff-main-logo-copy">
          <strong>FactoFit</strong>
          <small>Manufacturing AI Advisor</small>
        </span>
      </button>

      <nav className="ff-main-nav">
        <button type="button" onClick={onWhyClick}>
          Why FactoFit
        </button>

        <button type="button" onClick={onServicesClick}>
          주요 서비스
        </button>

        <button type="button" onClick={onDashboardClick}>
          Dashboard Experience
        </button>

        <a href="#sustainability">지속가능경영</a>
        <a href="#insights">Insights</a>
      </nav>

      <div className="ff-main-header-actions">
        <button
          type="button"
          className="ff-main-icon-button"
          onClick={onLoginClick}
          aria-label="로그인"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 12.2a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Z" />
            <path d="M4.8 20.4c1-3.7 3.7-5.9 7.2-5.9s6.2 2.2 7.2 5.9" />
          </svg>
        </button>

        <button
          type="button"
          className="ff-main-icon-button"
          onClick={onSupportClick}
          aria-label="고객 지원"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </div>
    </header>
  )
}