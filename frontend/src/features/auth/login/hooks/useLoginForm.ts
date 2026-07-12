import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { submitLogin } from "../login.api"
import type { LoginModalType } from "../login.contract"
import { resolvePostLoginPath } from "../../../onboarding/onboardingState"
import { hydrateAccountData } from "../../../../services/accountHydration"
import { requestPasswordReset } from "../../../../services/auth"

const MOBILE_VIEWPORT_MAX_WIDTH = 768

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH
}

export function useLoginForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [modalType, setModalType] = useState<LoginModalType>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false)

  const handleLogin = async () => {
    if (isLoggingIn) return

    try {
      setIsLoggingIn(true)
      await submitLogin({ email, password })
      // 재로그인 시 서버에서 기업·설비·ROI 데이터를 복원한다 (토큰 저장 직후 실행)
      try {
        void hydrateAccountData().catch((error) => {
          console.warn("[login] account hydration skipped after login", error)
        })
      } catch {
        // hydrate 실패는 로그인 흐름을 막지 않는다
      }
      if (isMobileViewport()) {
        navigate("/mobile", { replace: true })
        return
      }
      setModalType("preview")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "로그인에 실패했습니다."
      const normalized = message.toLowerCase()
      if (normalized.includes("invalid login credentials")) {
        alert("이메일 또는 비밀번호가 올바르지 않습니다.")
        return
      }
      alert(message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handlePasswordReset = async () => {
    if (isRequestingPasswordReset) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      alert("이메일을 입력해 주세요.")
      return
    }

    try {
      setIsRequestingPasswordReset(true)
      const result = await requestPasswordReset(trimmedEmail)
      alert(result.message || "비밀번호 재설정 메일을 발송했습니다.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "비밀번호 재설정 메일을 발송하지 못했습니다."
      alert(message)
    } finally {
      setIsRequestingPasswordReset(false)
    }
  }

  const handleContinue = () => {
    setModalType(null)
    const redirectParam = searchParams.get("redirect")
    const destination = redirectParam
      ? decodeURIComponent(redirectParam)
      : resolvePostLoginPath()
    navigate(destination, { replace: true })
  }

  const handleBackToMain = () => {
    navigate("/")
  }

  return {
    email,
    password,
    remember,
    modalType,
    isLoggingIn,
    isRequestingPasswordReset,
    setEmail,
    setPassword,
    setRemember,
    setModalType,
    handleLogin,
    handlePasswordReset,
    handleContinue,
    handleBackToMain,
  }
}
