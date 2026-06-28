import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { submitLogin } from "../login.api"
import type { LoginModalType } from "../login.contract"
import { resolvePostLoginPath } from "../../../onboarding/onboardingState"
import { hydrateAccountData } from "../../../../services/accountHydration"

export function useLoginForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [modalType, setModalType] = useState<LoginModalType>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLogin = async () => {
    if (isLoggingIn) return

    try {
      setIsLoggingIn(true)
      await submitLogin({ email, password })
      // 재로그인 시 서버에서 기업·설비·ROI 데이터를 복원한다 (토큰 저장 직후 실행)
      try {
        await hydrateAccountData()
      } catch {
        // hydrate 실패는 로그인 흐름을 막지 않는다
      }
      setModalType("preview")
    } catch (error) {
      alert(error instanceof Error ? error.message : "로그인에 실패했습니다.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleContinue = () => {
    setModalType(null)
    // ?redirect= 파라미터가 있으면 원래 접근하려던 경로로 복귀
    const redirectParam = searchParams.get("redirect")
    const destination = redirectParam ? decodeURIComponent(redirectParam) : resolvePostLoginPath()
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
    setEmail,
    setPassword,
    setRemember,
    setModalType,
    handleLogin,
    handleContinue,
    handleBackToMain,
  }
}
