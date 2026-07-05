import { useEffect, useState } from "react"
import SignupModal from "../../../components/auth/SignupModal"
import { consumeAuthExpiredMessage } from "../../../services/auth"

import { LoginHeroSection } from "./components/LoginHeroSection"
import { LoginFormPanel } from "./components/LoginFormPanel"
import { LoginPreviewDialog, SsoDialog } from "./components/LoginDialogs"
import { useLoginForm } from "./hooks/useLoginForm"
import "./login.responsive.css"

export default function LoginFeature() {
  const login = useLoginForm()
  const [authExpiredMessage, setAuthExpiredMessage] = useState("")

  useEffect(() => {
    const message = consumeAuthExpiredMessage()
    if (message) setAuthExpiredMessage(message)
  }, [])

  return (
    <main className="ff-login-page">
      <div className="ff-login-bg" aria-hidden="true" />
      <div className="ff-login-gradient" aria-hidden="true" />
      <div className="ff-login-vignette" aria-hidden="true" />

      <button type="button" className="ff-login-back-btn" onClick={login.handleBackToMain}>
        ← 메인으로
      </button>

      <section className="ff-login-layout">
        {authExpiredMessage ? (
          <div className="ff-login-expired-banner" role="status">
            {authExpiredMessage}
          </div>
        ) : null}
        <LoginHeroSection />

        <LoginFormPanel
          email={login.email}
          password={login.password}
          remember={login.remember}
          isLoggingIn={login.isLoggingIn}
          onEmailChange={login.setEmail}
          onPasswordChange={login.setPassword}
          onRememberChange={login.setRemember}
          onLogin={login.handleLogin}
          onOpenSignup={() => login.setModalType("signup")}
          onOpenSso={() => login.setModalType("sso")}
        />
      </section>

      {login.modalType === "preview" && (
        <LoginPreviewDialog
          onClose={() => login.setModalType(null)}
          onContinue={login.handleContinue}
        />
      )}

      {login.modalType === "signup" && (
        <SignupModal
          onClose={() => login.setModalType(null)}
          onLoginClick={() => login.setModalType(null)}
        />
      )}

      {login.modalType === "sso" && (
        <SsoDialog
          onClose={() => login.setModalType(null)}
          onContinue={() => login.setModalType("preview")}
        />
      )}
    </main>
  )
}
