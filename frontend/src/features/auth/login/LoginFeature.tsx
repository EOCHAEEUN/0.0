import SignupModal from "../../../components/auth/SignupModal"

import { LoginHeroSection } from "./components/LoginHeroSection"
import { LoginFormPanel } from "./components/LoginFormPanel"
import { LoginPreviewDialog, SsoDialog } from "./components/LoginDialogs"
import { useLoginForm } from "./hooks/useLoginForm"

export default function LoginFeature() {
  const login = useLoginForm()

  return (
    <main
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        color: "#FFFFFF",
        fontFamily: `"Noto Sans KR", "Pretendard", system-ui, sans-serif`,
        backgroundColor: "#273142",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/images/login-factory-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "52% center",
          backgroundRepeat: "no-repeat",
          filter: "saturate(1.03) contrast(1.05) brightness(1.12)",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(6,27,52,.68) 0%, rgba(6,27,52,.42) 44%, rgba(6,27,52,.12) 100%)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 62% 50%, rgba(255,255,255,.08) 0%, rgba(6,27,52,.06) 40%, rgba(6,27,52,.20) 100%)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      <button
        type="button"
        onClick={login.handleBackToMain}
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          zIndex: 30,
          height: "38px",
          padding: "0 16px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,.26)",
          background: "rgba(255,255,255,.16)",
          color: "#FFFFFF",
          fontSize: "13px",
          fontWeight: 900,
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          boxShadow: "0 12px 30px rgba(0,0,0,.18)",
        }}
      >
        ← 메인으로
      </button>

      <section
        style={{
          position: "relative",
          zIndex: 3,
          width: "100%",
          minHeight: "100vh",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(540px, 760px) minmax(420px, 470px)",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "clamp(56px, 7vw, 150px)",
          padding: "clamp(72px, 8vh, 110px) clamp(64px, 5vw, 86px)",
        }}
      >
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
