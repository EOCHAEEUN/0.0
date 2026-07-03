import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { OnboardingStepper } from "./OnboardingStepper"

type OnboardingSetupLayoutProps = {
  step: 1 | 2 | 3
  eyebrow: string
  title: string
  description: ReactNode
  note?: ReactNode
  headerRight?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function OnboardingSetupLayout({
  step,
  eyebrow,
  title,
  description,
  note,
  headerRight,
  children,
  footer,
}: OnboardingSetupLayoutProps) {
  const navigate = useNavigate()

  return (
    <main className="ff-onboarding-page">
      <header className="ff-setup-header">
        <button type="button" className="ff-logo-button" onClick={() => navigate("/dashboard")}>
          FactoFit
        </button>
        {headerRight}
      </header>

      <section className="ff-setup-shell">
        <OnboardingStepper currentStep={step} variant="setup" />

        <div className="ff-setup-grid">
          <aside className="ff-setup-intro">
            <p className="ff-onboarding-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
            {note ? <div className="ff-setup-note">{note}</div> : null}
          </aside>

          <div className="ff-setup-form-column">
            {children}
            {footer}
          </div>
        </div>
      </section>
    </main>
  )
}

export function OnboardingFormCard({
  title,
  badge,
  description,
  children,
}: {
  title: string
  badge?: ReactNode
  description?: string
  children: ReactNode
}) {
  return (
    <section className="ff-setup-form-card" aria-label={title}>
      <div className="ff-setup-form-card__header">
        <div>
          <div className="ff-setup-form-card__title-row">
            <h2>{title}</h2>
            {badge}
          </div>
          {description ? <p className="ff-setup-form-card__description">{description}</p> : null}
        </div>
      </div>
      <div className="ff-setup-form-card__body">{children}</div>
    </section>
  )
}
