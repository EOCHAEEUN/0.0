import { useMemo, useState } from "react"
import {
  saveAuthSession,
  sendSignupEmailCode,
  signupWithProfile,
  verifySignupEmailCode,
} from "../../../services/auth"
import type {
  PasswordLevel,
  UseSignupFormParams,
} from "./signup.types"
import {
  formatPhoneNumber,
  normalizePhoneNumber,
} from "./signup.utils"

export function useSignupForm({
  onClose,
  onSignupComplete,
}: UseSignupFormParams) {
  const [email, setEmail] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  const [password, setPassword] = useState("")
  const [passwordCheck, setPasswordCheck] = useState("")

  const [userName, setUserName] = useState("")
  const [phone, setPhone] = useState("")

  const [agreeService, setAgreeService] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  const passwordChecks = useMemo(() => {
    return [
      { label: "8자 이상", valid: password.length >= 8 },
      { label: "영문 포함", valid: /[A-Za-z]/.test(password) },
      { label: "숫자 포함", valid: /\d/.test(password) },
      { label: "특수문자 포함", valid: /[^A-Za-z0-9]/.test(password) },
    ]
  }, [password])

  const passwordScore = passwordChecks.filter((item) => item.valid).length

  const passwordLevel: PasswordLevel =
    password.length === 0
      ? "empty"
      : passwordScore <= 1
        ? "weak"
        : passwordScore <= 3
          ? "normal"
          : "strong"

  const passwordLabel =
    passwordLevel === "empty"
      ? "비밀번호 보안 수준"
      : passwordLevel === "weak"
        ? "약함"
        : passwordLevel === "normal"
          ? "보통"
          : "안전"

  const isPasswordMatched =
    password.length > 0 && passwordCheck.length > 0 && password === passwordCheck

  const isPasswordMismatch =
    password.length > 0 && passwordCheck.length > 0 && password !== passwordCheck

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setEmailCode("")
    setIsCodeSent(false)
    setIsEmailVerified(false)
  }

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhoneNumber(value))
  }

  const handleSendEmailCode = async () => {
    if (isSendingCode) return

    const trimmedEmail = email.trim()

    if (!trimmedEmail.includes("@")) {
      alert("이메일 형식을 확인해주세요.")
      return
    }

    try {
      setIsSendingCode(true)
      await sendSignupEmailCode(trimmedEmail)
      setIsCodeSent(true)
      setIsEmailVerified(false)
      alert("인증번호를 이메일로 발송했습니다.")
    } catch (error) {
      alert(error instanceof Error ? error.message : "인증번호 발송에 실패했습니다.")
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (isVerifyingCode) return

    const trimmedEmail = email.trim()
    const trimmedCode = emailCode.trim()

    if (!isCodeSent) {
      alert("먼저 인증번호를 받아주세요.")
      return
    }

    if (trimmedCode.length < 4) {
      alert("인증번호를 입력해주세요.")
      return
    }

    try {
      setIsVerifyingCode(true)
      const session = await verifySignupEmailCode(trimmedEmail, trimmedCode)
      saveAuthSession(session)
      setIsEmailVerified(true)
      alert("이메일 인증이 완료되었습니다.")
    } catch (error) {
      alert(error instanceof Error ? error.message : "이메일 인증에 실패했습니다.")
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    const trimmedEmail = email.trim()
    const trimmedUserName = userName.trim()
    const normalizedPhone = normalizePhoneNumber(phone)

    if (!trimmedEmail || !password || !passwordCheck || !trimmedUserName || !normalizedPhone) {
      alert("필수 계정 정보와 사용자 정보를 입력해주세요.")
      return
    }

    if (!isEmailVerified) {
      alert("이메일 인증을 완료해주세요.")
      return
    }

    if (passwordLevel !== "strong") {
      alert("비밀번호 보안 수준을 안전 단계로 맞춰주세요.")
      return
    }

    if (password !== passwordCheck) {
      alert("비밀번호가 일치하지 않습니다.")
      return
    }

    if (!agreeService || !agreePrivacy) {
      alert("필수 약관에 동의해주세요.")
      return
    }

    const signupPayload = {
      email: trimmedEmail,
      password,
      name: trimmedUserName,
      phone: normalizedPhone,
      business_registration_no: null,
      agreements: {
        service_terms: agreeService,
        privacy_policy: agreePrivacy,
      },
    }

    try {
      setIsSubmitting(true)

      const session = await signupWithProfile(signupPayload)
      saveAuthSession(session)

      alert("회원가입이 완료되었습니다.")
      if (onSignupComplete) {
        onSignupComplete()
      } else {
        onClose()
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "회원가입에 실패했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    email,
    emailCode,
    isCodeSent,
    isEmailVerified,
    password,
    passwordCheck,
    userName,
    phone,
    agreeService,
    agreePrivacy,
    isSubmitting,
    isSendingCode,
    isVerifyingCode,

    passwordChecks,
    passwordLevel,
    passwordLabel,
    isPasswordMatched,
    isPasswordMismatch,

    setEmailCode,
    setPassword,
    setPasswordCheck,
    setUserName,
    setAgreeService,
    setAgreePrivacy,

    handleEmailChange,
    handlePhoneChange,
    handleSendEmailCode,
    handleVerifyEmail,
    handleSubmit,
  }
}
