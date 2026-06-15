import { useMemo, useState } from "react"
import {
  createCompanyOnboarding,
  saveAuthSession,
  sendSignupEmailCode,
  signupWithProfile,
  verifySignupEmailCode,
} from "../../services/auth"
import "./SignupModal.css"

type IndustryOption = {
  name: string
  codes: string[]
}

type IndustryInputRow = {
  id: string
  industryName: string
  industryCode: string
  selectedIndustry: IndustryOption | null
}

type SignupModalProps = {
  onClose: () => void
  onLoginClick?: () => void
}

type PasswordLevel = "empty" | "weak" | "normal" | "strong"

const INDUSTRY_OPTIONS: IndustryOption[] = [
  { name: "스마트공장", codes: ["C"] },
  { name: "스마트제조", codes: ["C"] },

  { name: "식품", codes: ["C10"] },
  { name: "섬유", codes: ["C13"] },
  { name: "화학", codes: ["C20"] },
  { name: "바이오", codes: ["C21"] },
  { name: "의약", codes: ["C21"] },
  { name: "고무", codes: ["C22"] },
  { name: "플라스틱", codes: ["C22"] },

  { name: "금속", codes: ["C24", "C25"] },
  { name: "금속가공", codes: ["C25"] },

  { name: "전자", codes: ["C26"] },
  { name: "반도체", codes: ["C26"] },
  { name: "의료기기", codes: ["C27"] },

  { name: "전기", codes: ["C28"] },
  { name: "기계", codes: ["C29"] },
  { name: "장비", codes: ["C29"] },
  { name: "로봇", codes: ["C29"] },

  { name: "자동차", codes: ["C30"] },
  { name: "부품", codes: ["C30"] },

  { name: "소부장", codes: ["C20", "C24", "C25", "C26", "C28", "C29"] },
  { name: "뿌리", codes: ["C24", "C25", "C28", "C29"] },
]

const COMPANY_SIZE_OPTIONS = ["소상공인", "소기업", "중소기업", "중견기업"]

const PURPOSE_OPTIONS = [
  "지원사업 추천",
  "ROI 분석",
  "설비 교체 검토",
  "신청서 초안 작성",
  "안전점검 관리",
]

const createIndustryInputRow = (): IndustryInputRow => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  industryName: "",
  industryCode: "",
  selectedIndustry: null,
})

export default function SignupModal({ onClose, onLoginClick }: SignupModalProps) {
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
  const [isOptionalOpen, setIsOptionalOpen] = useState(false)

  const [region, setRegion] = useState("")
  const [companySize, setCompanySize] = useState("중소기업")
  const [mainPurpose, setMainPurpose] = useState("지원사업 추천")

  const [maxEmployeeCount, setMaxEmployeeCount] = useState("")
  const [minRevenueManwon, setMinRevenueManwon] = useState("")
  const [maxRevenueManwon, setMaxRevenueManwon] = useState("")

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

  const toNullableNumber = (value: string) => {
    if (!value.trim()) return null
    return Number(value)
  }

  const getNormalizedIndustries = () => {
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

    const payload = {
      account: {
        email,
        email_verified: isEmailVerified,
      },
      user: {
        name: userName,
        phone,
        business_number: businessNumber || null,
      },
      company: {
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
        max_employee_count: toNullableNumber(maxEmployeeCount),
        min_revenue_manwon: toNullableNumber(minRevenueManwon),
        max_revenue_manwon: toNullableNumber(maxRevenueManwon),
      },
      agreements: {
        service_terms: agreeService,
        privacy_policy: agreePrivacy,
      },
    }

    const signupPayload = {
      email,
      password,
      name: userName,
      phone,
      business_registration_no: businessNumber || null,
      company: payload.company,
      agreements: payload.agreements,
    }

    const onboardingPayload = {
      company_name: companyName,
      business_registration_no: businessNumber || null,
      industry_name: payload.company.industry_name,
      industry_code: payload.company.industry_code,
      region,
      company_type: companySize,
      company_size: companySize,
      primary_purpose: mainPurpose ? [mainPurpose] : [],
      employee_count: toNullableNumber(maxEmployeeCount) ?? 0,
      annual_revenue: toNullableNumber(maxRevenueManwon) ?? 0,
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
      return
    }

    alert("회원가입 정보가 저장되었습니다. 이후 DB API와 연결하면 마이페이지에서 불러올 수 있습니다.")
  }

  return (
    <div className="ff-signup-overlay" onClick={onClose}>
      <section
        className="ff-signup-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="ff-signup-close" onClick={onClose}>
          ×
        </button>

        <header className="ff-signup-header">
          <h2>회원가입</h2>
          <p>필수 정보를 입력하면 FactoFit 맞춤형 추천을 시작할 수 있습니다.</p>

          <div className="ff-signup-guide">
            <span>
              <b>*</b> 필수 입력
            </span>
            <span>선택 정보는 지원사업 조건 매칭에 활용됩니다.</span>
          </div>
        </header>

        <div className="ff-signup-section">
          <h3>1. 계정 정보</h3>

          <div className="ff-signup-field">
            <FieldLabel text="이메일" required />
            <div className="ff-signup-inline">
              <input
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setIsEmailVerified(false)
                }}
              />
              <button
                type="button"
                onClick={handleSendEmailCode}
                disabled={isSendingCode}
              >
                {isSendingCode ? "발송 중..." : "인증번호 받기"}
              </button>
            </div>

            {email && !email.includes("@") && (
              <p className="ff-signup-message is-error">
                이메일 형식으로 입력해주세요.
              </p>
            )}
          </div>

          <div className="ff-signup-field">
            <FieldLabel text="이메일 인증번호" required />
            <div className="ff-signup-inline">
              <input
                placeholder="인증번호 입력"
                value={emailCode}
                onChange={(event) => setEmailCode(event.target.value)}
              />
              <button
                type="button"
                onClick={handleVerifyEmail}
                disabled={isVerifyingCode}
              >
                {isVerifyingCode ? "확인 중..." : "인증 확인"}
              </button>
            </div>

            {isEmailVerified && (
              <p className="ff-signup-message is-success">
                이메일 인증이 완료되었습니다.
              </p>
            )}
          </div>

          <div className="ff-signup-two-col ff-signup-password-row">
            <div className="ff-signup-field">
              <FieldLabel text="비밀번호" required />
              <input
                type="password"
                placeholder="영문, 숫자, 특수문자 포함 8자 이상"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <div className={`ff-password-meter is-${passwordLevel}`}>
                <div className="ff-password-meter-track">
                  <span />
                  <span />
                  <span />
                </div>
                <p>{passwordLabel}</p>
              </div>

              <ul className="ff-password-check-list">
                {passwordChecks.map((item) => (
                  <li
                    key={item.label}
                    className={item.valid ? "is-valid" : undefined}
                  >
                    {item.valid ? "✓" : "•"} {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="ff-signup-field ff-signup-password-confirm-field">
              <FieldLabel text="비밀번호 확인" required />
              <input
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={passwordCheck}
                onChange={(event) => setPasswordCheck(event.target.value)}
              />

              {passwordCheck.length === 0 && (
                <p className="ff-signup-message is-muted">
                  비밀번호를 한 번 더 입력해주세요.
                </p>
              )}

              {isPasswordMatched && (
                <p className="ff-signup-message is-success">
                  비밀번호가 일치합니다.
                </p>
              )}

              {isPasswordMismatch && (
                <p className="ff-signup-message is-error">
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="ff-signup-section">
          <h3>2. 사용자 정보</h3>

          <div className="ff-signup-two-col">
            <div className="ff-signup-field">
              <FieldLabel text="이름" required />
              <input
                placeholder="이름"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
              />
            </div>

            <div className="ff-signup-field">
              <FieldLabel text="연락처" required />
              <input
                placeholder="010-0000-0000"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </div>

          <div className="ff-signup-field">
            <FieldLabel text="사업자등록번호" optional />
            <input
              placeholder="예: 123-45-67890"
              value={businessNumber}
              onChange={(event) => setBusinessNumber(event.target.value)}
            />
          </div>
        </div>

        <div className="ff-signup-section">
          <h3>3. 기업 정보</h3>

          <div className="ff-signup-field">
            <FieldLabel text="기업명" required />
            <input
              placeholder="기업명을 입력하세요"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>

          <div className="ff-signup-industry-list">
            {industryRows.map((row, index) => {
              const filteredIndustries = getFilteredIndustries(row)
              const isSuggestionOpen =
                openIndustryRowId === row.id &&
                Boolean(row.industryName || row.industryCode) &&
                filteredIndustries.length > 0

              return (
                <div className="ff-signup-industry-row" key={row.id}>
                  {industryRows.length > 1 && (
                    <div className="ff-signup-industry-row-top">
                      <span>업종 {index + 1}</span>

                      <button
                        type="button"
                        onClick={() => handleRemoveIndustryRow(row.id)}
                      >
                        삭제
                      </button>
                    </div>
                  )}

                  <div className="ff-signup-two-col">
                    <div className="ff-signup-field ff-signup-combo">
                      <FieldLabel text="업종명" required />
                      <input
                        placeholder="예: 금속가공"
                        value={row.industryName}
                        onFocus={() => setOpenIndustryRowId(row.id)}
                        onChange={(event) =>
                          handleIndustryNameChange(row.id, event.target.value)
                        }
                      />

                      {isSuggestionOpen && (
                        <div className="ff-signup-suggest-box">
                          {filteredIndustries.map((item) => (
                            <button
                              type="button"
                              key={`${row.id}-${item.name}-${item.codes.join(
                                "-",
                              )}`}
                              onClick={() => handleSelectIndustry(row.id, item)}
                            >
                              <span>{item.name}</span>
                              <b>{item.codes.join(", ")}</b>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="ff-signup-field">
                      <FieldLabel text="업종코드" required />
                      <input
                        placeholder="예: C25"
                        value={row.industryCode}
                        onFocus={() => setOpenIndustryRowId(row.id)}
                        onChange={(event) =>
                          handleIndustryCodeChange(row.id, event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="ff-signup-add-industry"
            onClick={handleAddIndustryRow}
          >
            + 업종 추가하기
          </button>

          <div className="ff-signup-field">
            <FieldLabel text="지역" required />
            <input
              placeholder="예: 경기 안산시"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            />
          </div>

          <div className="ff-signup-two-col">
            <div className="ff-signup-field">
              <FieldLabel text="기업 규모" optional />
              <select
                value={companySize}
                onChange={(event) => setCompanySize(event.target.value)}
              >
                {COMPANY_SIZE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="ff-signup-field">
              <FieldLabel text="주요 목적" optional />
              <select
                value={mainPurpose}
                onChange={(event) => setMainPurpose(event.target.value)}
              >
                {PURPOSE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <section
          className={
            isOptionalOpen
              ? "ff-signup-optional is-open"
              : "ff-signup-optional"
          }
        >
          <button
            type="button"
            className="ff-signup-optional-summary"
            onClick={() => setIsOptionalOpen((prev) => !prev)}
          >
            <span>4. 선택 정보</span>
            <em>종업원 수·매출액 기준이 있는 지원사업 매칭에 활용됩니다.</em>
            <b>{isOptionalOpen ? "닫기" : "열기"}</b>
          </button>

          {isOptionalOpen && (
            <div className="ff-signup-optional-body">
              <div className="ff-signup-field">
                <FieldLabel text="최대 종업원 수" optional />
                <input
                  type="number"
                  placeholder="예: 50"
                  value={maxEmployeeCount}
                  onChange={(event) => setMaxEmployeeCount(event.target.value)}
                />
              </div>

              <div className="ff-signup-two-col">
                <div className="ff-signup-field">
                  <FieldLabel text="최소 매출액, 만원 단위" optional />
                  <input
                    type="number"
                    placeholder="예: 10000"
                    value={minRevenueManwon}
                    onChange={(event) => setMinRevenueManwon(event.target.value)}
                  />
                </div>

                <div className="ff-signup-field">
                  <FieldLabel text="최대 매출액, 만원 단위" optional />
                  <input
                    type="number"
                    placeholder="예: 500000"
                    value={maxRevenueManwon}
                    onChange={(event) => setMaxRevenueManwon(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="ff-signup-agree-box">
          <label>
            <input
              type="checkbox"
              checked={agreeService}
              onChange={(event) => setAgreeService(event.target.checked)}
            />
            <span>
              서비스 이용약관에 동의합니다. <b>필수</b>
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(event) => setAgreePrivacy(event.target.checked)}
            />
            <span>
              개인정보 수집 및 이용에 동의합니다. <b>필수</b>
            </span>
          </label>
        </div>

        <button
          type="button"
          className="ff-signup-submit"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "저장 중..." : "회원가입 완료"}
        </button>

        <button
          type="button"
          className="ff-signup-login-link"
          onClick={onLoginClick ?? onClose}
        >
          이미 계정이 있으신가요? 로그인으로 돌아가기
        </button>
      </section>
    </div>
  )
}

function FieldLabel({
  text,
  required,
  optional,
}: {
  text: string
  required?: boolean
  optional?: boolean
}) {
  return (
    <div className="ff-signup-label-row">
      <label>
        {text}
        {required && <b>*</b>}
      </label>

      {optional && <span>선택</span>}
    </div>
  )
}
