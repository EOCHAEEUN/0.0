import { Bell, UserRound } from "lucide-react"

type MobileTopBarProps = {
  companyName?: string
  subtitle?: string
  showSubtitle?: boolean
}

export function MobileTopBar({ companyName, subtitle, showSubtitle = false }: MobileTopBarProps) {
  const initial = (companyName || "F").trim().charAt(0).toUpperCase()

  return (
    <header className="ff-mobile-topbar">
      <div className="ff-mobile-brand">
        <span className="ff-mobile-brand-mark" aria-hidden="true">
          F
        </span>
        <div>
          <strong>FactoFit</strong>
          {showSubtitle && subtitle ? <span>{subtitle}</span> : null}
        </div>
      </div>
      <div className="ff-mobile-topbar-actions">
        <button type="button" className="ff-mobile-icon-btn" aria-label="알림">
          <Bell size={18} />
        </button>
        <button type="button" className="ff-mobile-profile-btn" aria-label="프로필">
          <UserRound size={16} />
          <span>{initial}</span>
        </button>
      </div>
    </header>
  )
}
