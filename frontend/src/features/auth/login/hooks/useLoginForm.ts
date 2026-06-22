import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { submitLogin } from "../login.api"
import type { LoginModalType } from "../login.contract"

export function useLoginForm() {
  const navigate = useNavigate()

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
      setModalType("preview")
    } catch (error) {
      alert(error instanceof Error ? error.message : "로그인에 실패했습니다.")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleContinue = () => {
    setModalType(null)
    navigate("/")
  }

  const handleBackToMain = () => {
    navigate("/main")
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
