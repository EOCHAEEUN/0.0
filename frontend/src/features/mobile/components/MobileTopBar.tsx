import { Bell, Factory } from "lucide-react"

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
        <Factory size={22} strokeWidth={2.1} className="ff-mobile-brand-icon" aria-hidden="true" />
        <div className="ff-mobile-brand-copy">
          <strong>FactoFit</strong>
          {showSubtitle && subtitle ? <span>{subtitle}</span> : null}
        </div>
      </div>
      <div className="ff-mobile-topbar-actions">
        <button type="button" className="ff-mobile-icon-btn" aria-label="알림">
          <Bell size={18} strokeWidth={2.1} />
        </button>
        <button type="button" className="ff-mobile-profile-avatar" aria-label="프로필">
          <span>{initial}</span>
        </button>
      </div>
    </header>
  )
}
