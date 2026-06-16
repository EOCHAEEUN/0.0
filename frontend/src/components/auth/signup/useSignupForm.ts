import { useMemo, useState } from "react"
import {
  createCompanyOnboarding,
  saveAuthSession,
  sendSignupEmailCode,
  signupWithProfile,
  verifySignupEmailCode,
} from "../../../services/auth"
import { INDUSTRY_OPTIONS } from "./signup.constants"
import type {
  IndustryInputRow,
  IndustryOption,
  NormalizedIndustry,
  PasswordLevel,
  UseSignupFormParams,
} from "./signup.types"
import {
  createIndustryInputRow,
  formatBusinessNumber,
  formatPhoneNumber,
  normalizeBusinessNumber,
  normalizePhoneNumber,
} from "./signup.utils"

export function useSignupForm({ onClose }: UseSignupFormParams) {
  const [email, setEmail] = useState("")
  const [emailCode, setEmailCode] = useState("")
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  const [password, setPassword] = useState("")
  const [passwordCheck, setPasswordCheck] = useState("")

  const [userName, setUserName] = useState("")
  const [phone, setPhone] = useState("")
  const [businessNumber, setBusinessNumber] = useState("")

  const [companyName, setCompanyName] = useState("")
  const [industryRows, setIndustryRows] = useState<IndustryInputRow[]>(() => [
    createIndustryInputRow(),
  ])
  const [openIndustryRowId, setOpenIndustryRowId] = useState<string | null>(null)

  const [region, setRegion] = useState("")
  const [companySize, setCompanySize] = useState("선택 필요")
  const [mainPurpose, setMainPurpose] = useState("지원사업 추천")

  const [agreeService, setAgreeService] = useState(true)
  const [agreePrivacy, setAgreePrivacy] = useState(true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)

  const passwordChecks = useMemo(() => {
    return [
      {
        label: "8자 이상",
        valid: password.length >= 8,
      },
      {
        label: "영문 포함",
        valid: /[A-Za-z]/.test(password),
      },
      {
        label: "숫자 포함",
        valid: /\d/.test(password),
      },
      {
        label: "특수문자 포함",
        valid: /[^A-Za-z0-9]/.test(password),
      },
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
    setIsEmailVerified(false)
  }

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhoneNumber(value))
  }

  const handleBusinessNumberChange = (value: string) => {
    setBusinessNumber(formatBusinessNumber(value))
  }

  const getFilteredIndustries = (row: IndustryInputRow) => {
    const keyword = `${row.industryName} ${row.industryCode}`
      .trim()
      .toLowerCase()

    if (!keyword) return INDUSTRY_OPTIONS.slice(0, 8)

    return INDUSTRY_OPTIONS.filter((item) => {
      const nameMatched = item.name.toLowerCase().includes(keyword)
      const codeMatched = item.codes.some((code) =>
        code.toLowerCase().includes(keyword),
      )

      return nameMatched || codeMatched
    }).slice(0, 8)
  }

  const handleSendEmailCode = async () => {
    if (isSendingCode) return

    if (!email.includes("@")) {
      alert("이메일 형식을 확인해주세요.")
      return
    }

    try {
      setIsSendingCode(true)
      await sendSignupEmailCode(email)
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

    if (!isCodeSent) {
      alert("먼저 인증번호를 받아주세요.")
      return
    }

    if (emailCode.trim().length < 4) {
      alert("인증번호를 입력해주세요.")
      return
    }

    try {
      setIsVerifyingCode(true)
      const session = await verifySignupEmailCode(email, emailCode.trim())
      saveAuthSession(session)
      setIsEmailVerified(true)
      alert("이메일 인증이 완료되었습니다.")
    } catch (error) {
      alert(error instanceof Error ? error.message : "이메일 인증에 실패했습니다.")
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleAddIndustryRow = () => {
    setIndustryRows((prev) => [...prev, createIndustryInputRow()])
  }

  const handleRemoveIndustryRow = (rowId: string) => {
    setIndustryRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.id !== rowId)
    })

    if (openIndustryRowId === rowId) {
      setOpenIndustryRowId(null)
    }
  }

  const handleOpenIndustrySuggestion = (rowId: string) => {
    setOpenIndustryRowId(rowId)
  }

  const handleSelectIndustry = (rowId: string, industry: IndustryOption) => {
    setIndustryRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              selectedIndustry: industry,
              industryName: industry.name,
              industryCode: industry.codes.join(", "),
            }
          : row,
      ),
    )

    setOpenIndustryRowId(null)
  }

  const handleIndustryNameChange = (rowId: string, value: string) => {
    setIndustryRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row

        const exact = INDUSTRY_OPTIONS.find((item) => item.name === value)

        if (exact) {
          return {
            ...row,
            industryName: value,
            industryCode: exact.codes.join(", "),
            selectedIndustry: exact,
          }
        }

        return {
          ...row,
          industryName: value,
          selectedIndustry: null,
        }
      }),
    )

    setOpenIndustryRowId(rowId)
  }

  const handleIndustryCodeChange = (rowId: string, value: string) => {
    const nextValue = value.toUpperCase()
    const normalizedValue = nextValue.replace(/\s/g, "")

    setIndustryRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row

        const exact = INDUSTRY_OPTIONS.find((item) =>
          item.codes.some((code) => code === normalizedValue),
        )

        if (exact) {
          return {
            ...row,
            industryName: exact.name,
            industryCode: nextValue,
            selectedIndustry: exact,
          }
        }

        return {
          ...row,
          industryCode: nextValue,
          selectedIndustry: null,
        }
      }),
    )

    setOpenIndustryRowId(rowId)
  }

  const getNormalizedIndustries = (): NormalizedIndustry[] => {
    return industryRows
      .map((row) => {
        const industryName = row.selectedIndustry?.name ?? row.industryName.trim()
        const industryCodes =
          row.selectedIndustry?.codes ??
          row.industryCode
            .split(",")
            .map((code) => code.trim().toUpperCase())
            .filter(Boolean)

        return {
          industry_name: industryName,
          industry_code: industryCodes,
        }
      })
      .filter((item) => item.industry_name || item.industry_code.length > 0)
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    if (!email || !password || !passwordCheck || !userName || !phone) {
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

    const normalizedIndustries = getNormalizedIndustries()

    if (!companyName || !region) {
      alert("기업명, 지역을 입력해주세요.")
      return
    }

    if (normalizedIndustries.length === 0) {
      alert("업종을 1개 이상 입력해주세요.")
      return
    }

    const hasIncompleteIndustry = normalizedIndustries.some(
      (item) => !item.industry_name || item.industry_code.length === 0,
    )

    if (hasIncompleteIndustry) {
      alert("추가한 업종의 업종명과 업종코드를 모두 입력해주세요.")
      return
    }

    if (!agreeService || !agreePrivacy) {
      alert("필수 약관에 동의해주세요.")
      return
    }

    const uniqueIndustryCodes = Array.from(
      new Set(normalizedIndustries.flatMap((item) => item.industry_code)),
    )

    const companyPayload = {
      company_name: companyName,

      /**
       * 기존 단일 업종 저장 구조와의 호환을 위해 유지합니다.
       * 여러 업종을 추가하면 쉼표로 묶어서 저장됩니다.
       */
      industry_name: normalizedIndustries
        .map((item) => item.industry_name)
        .join(", "),
      industry_code: uniqueIndustryCodes,

      /**
       * 신규 다중 업종 저장용 필드입니다.
       * DB 연결 시 이 배열을 기준으로 별도 테이블에 저장하면 됩니다.
       */
      industries: normalizedIndustries,

      region,
      company_size: companySize,
      main_purpose: mainPurpose,
      max_employee_count: null,
      min_revenue_manwon: null,
      max_revenue_manwon: null,
    }

    const agreementsPayload = {
      service_terms: agreeService,
      privacy_policy: agreePrivacy,
    }

    const signupPayload = {
      email,
      password,
      name: userName,
      phone: normalizePhoneNumber(phone),
      business_registration_no: normalizeBusinessNumber(businessNumber) || null,
      company: companyPayload,
      agreements: agreementsPayload,
    }

    /**
     * FactoFit 최종 기준:
     * - /auth/signup은 user_profile 중심
     * - /onboarding에서 company 기본정보 저장
     * - employee_count는 optional이므로 회원가입 시점에는 보내지 않음
     * - annual_revenue는 required이므로 기본값 0 저장
     */
    const onboardingPayload = {
      company_name: companyName,
      business_registration_no: normalizeBusinessNumber(businessNumber) || null,
      industry_name: companyPayload.industry_name,
      industry_code: companyPayload.industry_code,
      region,
      company_size: companySize,
      primary_purpose: mainPurpose ? [mainPurpose] : [],
      annual_revenue: 0,
    }

    try {
      setIsSubmitting(true)
      const session = await signupWithProfile(signupPayload)
      saveAuthSession(session)

      const onboarding = await createCompanyOnboarding(onboardingPayload)
      localStorage.setItem("factofit_company_id", onboarding.company_id)

      alert("회원가입이 완료되었습니다.")
      onClose()
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
    businessNumber,
    companyName,
    industryRows,
    openIndustryRowId,
    region,
    companySize,
    mainPurpose,
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
    setCompanyName,
    setRegion,
    setCompanySize,
    setMainPurpose,
    setAgreeService,
    setAgreePrivacy,

    handleEmailChange,
    handlePhoneChange,
    handleBusinessNumberChange,
    handleSendEmailCode,
    handleVerifyEmail,
    handleAddIndustryRow,
    handleRemoveIndustryRow,
    handleOpenIndustrySuggestion,
    handleSelectIndustry,
    handleIndustryNameChange,
    handleIndustryCodeChange,
    getFilteredIndustries,
    handleSubmit,
  }
}