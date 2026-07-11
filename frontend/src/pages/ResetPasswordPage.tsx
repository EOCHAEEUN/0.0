import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { saveAuthSession, updatePassword } from "../services/auth"
import {
  inputStyle,
  primaryButtonStyle,
} from "../features/auth/login/login.parts"

function readRecoveryTokensFromHash(): {
  accessToken: string | null
  refreshToken: string | null
} {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(hash)

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  }
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  useEffect(() => {
    const { accessToken, refreshToken } = readRecoveryTokensFromHash()
    if (accessToken) {
      saveAuthSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: null,
        user: { id: null, email: null },
      })
      setHasRecoverySession(true)
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  const handleSubmit = async () => {
    if (isSubmitting) return

    if (password.length < 8) {
      setStatusMessage("비밀번호는 8자 이상이어야 합니다.")
      return
    }
    if (password !== confirmPassword) {
      setStatusMessage("비밀번호가 일치하지 않습니다.")
      return
    }

    try {
      setIsSubmitting(true)
      setStatusMessage("")
      const result = await updatePassword(password)
      setStatusMessage(result.message || "비밀번호가 변경되었습니다.")
      setTimeout(() => navigate("/login"), 1500)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8FAFC",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "40px 32px",
          borderRadius: "20px",
          background: "#FFFFFF",
          boxShadow: "0 18px 38px rgba(6,27,52,.08)",
          display: "grid",
          gap: "18px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#061B34" }}>
            새 비밀번호 설정
          </h1>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "#475467" }}>
            {hasRecoverySession
              ? "새로 사용할 비밀번호를 입력해 주세요."
              : "비밀번호 재설정 메일의 링크를 통해 접속해 주세요."}
          </p>
        </div>

        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 900, color: "#475467" }}>
            새 비밀번호
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상 입력해 주세요"
            style={inputStyle}
            disabled={!hasRecoverySession}
          />
        </label>

        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 900, color: "#475467" }}>
            새 비밀번호 확인
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="비밀번호를 다시 입력해 주세요"
            style={inputStyle}
            disabled={!hasRecoverySession}
          />
        </label>

        {statusMessage ? (
          <p style={{ fontSize: "13px", color: "#344BA0", fontWeight: 700 }}>
            {statusMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          style={primaryButtonStyle}
          disabled={!hasRecoverySession || isSubmitting}
        >
          {isSubmitting ? "변경 중..." : "비밀번호 변경"}
        </button>
      </section>
    </main>
  )
}
